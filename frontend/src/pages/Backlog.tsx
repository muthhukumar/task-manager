import React, { useEffect, useState, useCallback } from 'react';
import type { Task, TaskInput, TaskStatus } from '../types';
import {
  getTasks,
  updateTask,
  deleteTask,
  addComment,
  updateComment,
  deleteComment,
  uploadAttachment,
  deleteAttachment,
  createTask,
} from '../api/client';
import { TaskCard } from '../components/TaskCard';
import { TaskForm } from '../components/TaskForm';
import { Archive, Calendar } from 'lucide-react';

export const Backlog: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [subtaskParentId, setSubtaskParentId] = useState<number | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<number>>(new Set());

  // Date re-assign modal state
  const [reassigningTask, setReassigningTask] = useState<Task | null>(null);
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);

  const fetchDeferredTasks = useCallback(async (initialLoad = false) => {
    try {
      if (initialLoad) setLoading(true);
      const data = await getTasks({
        deferred: true,
        include_done: false,
        top_level_only: true,
      });
      setTasks(data);
    } catch (err: any) {
      console.error('Failed to load backlog tasks:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDeferredTasks(true);

    const handleUpdate = () => fetchDeferredTasks(false);
    window.addEventListener('task-updated', handleUpdate);
    return () => window.removeEventListener('task-updated', handleUpdate);
  }, [fetchDeferredTasks]);

  const toggleTaskExpand = (taskId: number, force?: boolean) => {
    setExpandedTaskIds((prev) => {
      const next = new Set(prev);
      const shouldExpand = force !== undefined ? force : !next.has(taskId);
      if (shouldExpand) {
        next.add(taskId);
      } else {
        next.delete(taskId);
      }
      return next;
    });
  };

  // Helper: update a specific task in local state (handles both top-level and subtask nesting)
  const updateTaskLocally = useCallback((taskId: number, updater: (t: Task) => Task) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) return updater(t);
        if (t.subtasks && t.subtasks.some((st) => st.id === taskId)) {
          return {
            ...t,
            subtasks: t.subtasks.map((st) => (st.id === taskId ? updater(st) : st)),
          };
        }
        return t;
      })
    );
  }, []);

  const handleUpdateStatus = async (taskId: number, newStatus: TaskStatus) => {
    updateTaskLocally(taskId, (t) => ({ ...t, status: newStatus }));
    await updateTask(taskId, { status: newStatus });
    fetchDeferredTasks(false);
  };

  const handleUpdateTask = async (taskId: number, input: Partial<TaskInput>) => {
    await updateTask(taskId, input);
    await fetchDeferredTasks(false);
  };

  const handleDeleteTask = async (taskId: number) => {
    await deleteTask(taskId);
    setExpandedTaskIds((prev) => {
      const next = new Set(prev);
      next.delete(taskId);
      return next;
    });
    setTasks((prev) =>
      prev
        .filter((t) => t.id !== taskId)
        .map((t) => {
          if (!t.subtasks) return t;
          const filtered = t.subtasks.filter((st) => st.id !== taskId);
          if (filtered.length !== t.subtasks.length) {
            return { ...t, subtasks: filtered };
          }
          return t;
        })
    );
  };

  const handleAddComment = async (taskId: number, body: string) => {
    const newComment = await addComment(taskId, body);
    updateTaskLocally(taskId, (t) => ({
      ...t,
      comments: [...(t.comments || []), newComment],
    }));
    setExpandedTaskIds((prev) => new Set(prev).add(taskId));
  };

  const handleUpdateComment = async (commentId: number, body: string) => {
    const updated = await updateComment(commentId, body);
    setTasks((prev) =>
      prev.map((t) => {
        let updatedHere = false;
        const updatedComments = t.comments?.map((c) => {
          if (c.id === commentId) {
            updatedHere = true;
            return updated;
          }
          return c;
        });
        const updatedSubtasks = t.subtasks?.map((st) => {
          let subUpdated = false;
          const subComments = st.comments?.map((c) => {
            if (c.id === commentId) {
              subUpdated = true;
              return updated;
            }
            return c;
          });
          return subUpdated ? { ...st, comments: subComments } : st;
        });

        let res = t;
        if (updatedHere) res = { ...res, comments: updatedComments };
        if (updatedSubtasks && updatedSubtasks !== t.subtasks) res = { ...res, subtasks: updatedSubtasks };
        return res;
      })
    );
  };

  const handleDeleteComment = async (commentId: number) => {
    await deleteComment(commentId);
    setTasks((prev) =>
      prev.map((t) => {
        const filtered = t.comments?.filter((c) => c.id !== commentId);
        const subtasksFiltered = t.subtasks?.map((st) => {
          const sf = st.comments?.filter((c) => c.id !== commentId);
          if (sf && sf.length !== (st.comments?.length ?? 0)) {
            return { ...st, comments: sf };
          }
          return st;
        });

        let res = t;
        if (filtered && filtered.length !== (t.comments?.length ?? 0)) {
          res = { ...res, comments: filtered };
        }
        if (subtasksFiltered && subtasksFiltered !== t.subtasks) {
          res = { ...res, subtasks: subtasksFiltered };
        }
        return res;
      })
    );
  };

  const handleUploadAttachment = async (taskId: number, file: File) => {
    const newAttachment = await uploadAttachment(taskId, file);
    updateTaskLocally(taskId, (t) => ({
      ...t,
      attachments: [...(t.attachments || []), newAttachment],
    }));
    setExpandedTaskIds((prev) => new Set(prev).add(taskId));
  };

  const handleDeleteAttachment = async (attachmentId: number) => {
    await deleteAttachment(attachmentId);
    setTasks((prev) =>
      prev.map((t) => {
        const filtered = t.attachments?.filter((a) => a.id !== attachmentId);
        if (filtered && filtered.length !== (t.attachments?.length ?? 0)) {
          return { ...t, attachments: filtered };
        }
        if (t.subtasks) {
          const updatedSubs = t.subtasks.map((st) => {
            const stFiltered = st.attachments?.filter((a) => a.id !== attachmentId);
            if (stFiltered && stFiltered.length !== (st.attachments?.length ?? 0)) {
              return { ...st, attachments: stFiltered };
            }
            return st;
          });
          return { ...t, subtasks: updatedSubs };
        }
        return t;
      })
    );
  };

  const handleFormSubmit = async (input: TaskInput) => {
    if (editingTask) {
      await updateTask(editingTask.id, input);
    } else {
      await createTask(input);
    }
    await fetchDeferredTasks(false);
  };

  const handleReassignDate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reassigningTask || !newDate) return;

    try {
      await updateTask(reassigningTask.id, {
        assigned_date: newDate,
        is_deferred: false,
      });
      setReassigningTask(null);
      await fetchDeferredTasks(false);
    } catch (err: any) {
      alert(err.message || 'Failed to reassign task');
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--foreground)', letterSpacing: '-0.025em', margin: '0 0 0.25rem 0' }}>
          Backlog / Do Later
        </h1>
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>
          Deferred tasks removed from daily carry-over until scheduled for a specific date
        </p>
      </div>

      {/* Task List */}
      {loading && tasks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted-foreground)', fontSize: '0.875rem' }}>
          Loading backlog...
        </div>
      ) : tasks.length === 0 ? (
        <div
          className="card"
          style={{
            borderStyle: 'dashed',
            padding: '3rem 2rem',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '9999px',
              backgroundColor: 'var(--secondary)',
              color: 'var(--muted-foreground)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 0.75rem auto',
            }}
          >
            <Archive size={22} />
          </div>
          <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1rem', fontWeight: 600, color: 'var(--foreground)' }}>
            Backlog is empty
          </h3>
          <p style={{ margin: 0, color: 'var(--muted-foreground)', fontSize: '0.8125rem' }}>
            Any task marked with "Do Later" will be parked here without cluttering your daily view.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--muted-foreground)', marginBottom: '0.25rem' }}>
            {tasks.length} deferred {tasks.length === 1 ? 'task' : 'tasks'} waiting for rescheduling
          </div>
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              isExpanded={expandedTaskIds.has(task.id)}
              onToggleExpand={(force) => toggleTaskExpand(task.id, force)}
              isTaskExpanded={(id) => expandedTaskIds.has(id)}
              onToggleExpandTask={toggleTaskExpand}
              onUpdateStatus={handleUpdateStatus}
              onUpdateTask={handleUpdateTask}
              onDeleteTask={handleDeleteTask}
              onAddComment={handleAddComment}
              onUpdateComment={handleUpdateComment}
              onDeleteComment={handleDeleteComment}
              onUploadAttachment={handleUploadAttachment}
              onDeleteAttachment={handleDeleteAttachment}
              onEditTask={(t) => {
                setEditingTask(t);
                setSubtaskParentId(null);
                setIsFormOpen(true);
              }}
              onAddSubtask={(pId) => {
                setEditingTask(null);
                setSubtaskParentId(pId);
                setIsFormOpen(true);
              }}
              extraActions={
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => {
                    setReassigningTask(task);
                    setNewDate(new Date().toISOString().split('T')[0]);
                  }}
                  style={{
                    gap: '0.375rem',
                    fontSize: '0.75rem',
                    height: '1.75rem',
                    padding: '0 0.625rem',
                  }}
                >
                  <Calendar size={13} />
                  <span>Assign to Date</span>
                </button>
              }
            />
          ))}
        </div>
      )}

      {/* Reassign Date Modal */}
      {reassigningTask && (
        <div className="dialog-overlay">
          <div className="dialog-content" style={{ maxWidth: '420px', padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 0.375rem 0', fontSize: '1.125rem', fontWeight: 600, color: 'var(--foreground)', letterSpacing: '-0.02em' }}>
              Assign Task to Date
            </h3>
            <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>
              Move <span style={{ fontWeight: 500, color: 'var(--foreground)' }}>"{reassigningTask.title}"</span> back into active daily tracking.
            </p>

            <form onSubmit={handleReassignDate}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--foreground)', marginBottom: '0.375rem' }}>
                  Target Date
                </label>
                <input
                  type="date"
                  required
                  className="input"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setReassigningTask(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                >
                  Schedule Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task Form Modal */}
      <TaskForm
        isOpen={isFormOpen}
        initialTask={editingTask}
        parentTaskId={subtaskParentId}
        onClose={() => {
          setIsFormOpen(false);
          setEditingTask(null);
          setSubtaskParentId(null);
        }}
        onSubmit={handleFormSubmit}
      />
    </div>
  );
};
