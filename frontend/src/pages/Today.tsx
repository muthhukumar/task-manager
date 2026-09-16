import React, { useEffect, useState, useCallback } from 'react';
import type { Task, TaskInput, TaskStatus } from '../types';
import {
  getTodayTasks,
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
import { Plus, CheckCircle2, Clock, AlertCircle, CircleDot } from 'lucide-react';

export const Today: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [subtaskParentId, setSubtaskParentId] = useState<number | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<number>>(new Set());

  const todayStr = new Date().toISOString().split('T')[0];

  const fetchTasks = useCallback(async (initialLoad = false) => {
    try {
      if (initialLoad) setLoading(true);
      const data = await getTodayTasks(todayStr);
      setTasks(data);
    } catch (err: any) {
      console.error('Failed to load today tasks:', err);
    } finally {
      setLoading(false);
    }
  }, [todayStr]);

  useEffect(() => {
    fetchTasks(true);

    const handleUpdate = () => fetchTasks(false);
    window.addEventListener('task-updated', handleUpdate);
    return () => window.removeEventListener('task-updated', handleUpdate);
  }, [fetchTasks]);

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
    fetchTasks(false);
  };

  const handleUpdateTask = async (taskId: number, input: Partial<TaskInput>) => {
    await updateTask(taskId, input);
    await fetchTasks(false);
  };

  const handleDeleteTask = async (taskId: number) => {
    await deleteTask(taskId);
    setExpandedTaskIds((prev) => {
      const next = new Set(prev);
      next.delete(taskId);
      return next;
    });
    // Remove if top-level, or filter out of subtasks if nested
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
    // Optimistic: append the new comment to the task's comments array locally
    updateTaskLocally(taskId, (t) => ({
      ...t,
      comments: [...(t.comments || []), newComment],
    }));
    // Ensure card stays expanded
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
    // Optimistic: append the new attachment locally
    updateTaskLocally(taskId, (t) => ({
      ...t,
      attachments: [...(t.attachments || []), newAttachment],
    }));
    // Ensure card stays expanded
    setExpandedTaskIds((prev) => new Set(prev).add(taskId));
  };

  const handleDeleteAttachment = async (attachmentId: number) => {
    await deleteAttachment(attachmentId);
    // Optimistic: remove the attachment locally
    setTasks((prev) =>
      prev.map((t) => {
        const filtered = t.attachments?.filter((a) => a.id !== attachmentId);
        if (filtered && filtered.length !== (t.attachments?.length ?? 0)) {
          return { ...t, attachments: filtered };
        }
        // Check subtasks
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
    await fetchTasks(false);
  };

  const inProgressCount = tasks.filter((t) => t.status === 'in_progress').length;
  const blockedCount = tasks.filter((t) => t.status === 'blocked').length;
  const notStartedCount = tasks.filter((t) => t.status === 'not_started').length;

  return (
    <div>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--foreground)', letterSpacing: '-0.025em', margin: '0 0 0.25rem 0' }}>
            Today's Focus
          </h1>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>
            Active tasks scheduled for today or automatically rolled over from previous days
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setEditingTask(null);
            setSubtaskParentId(null);
            setIsFormOpen(true);
          }}
        >
          <Plus size={16} />
          <span>Add Task</span>
        </button>
      </div>

      {/* Summary KPI Metric Cards (shadcn card style) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--muted-foreground)' }}>In Progress</span>
            <Clock size={16} style={{ color: '#2563eb' }} />
          </div>
          <div style={{ fontSize: '1.875rem', fontWeight: 700, color: 'var(--foreground)', letterSpacing: '-0.025em', marginTop: '0.5rem' }}>
            {inProgressCount}
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--muted-foreground)' }}>Blocked</span>
            <AlertCircle size={16} style={{ color: '#dc2626' }} />
          </div>
          <div style={{ fontSize: '1.875rem', fontWeight: 700, color: 'var(--foreground)', letterSpacing: '-0.025em', marginTop: '0.5rem' }}>
            {blockedCount}
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--muted-foreground)' }}>Not Started</span>
            <CircleDot size={16} style={{ color: 'var(--muted-foreground)' }} />
          </div>
          <div style={{ fontSize: '1.875rem', fontWeight: 700, color: 'var(--foreground)', letterSpacing: '-0.025em', marginTop: '0.5rem' }}>
            {notStartedCount}
          </div>
        </div>
      </div>

      {/* Task List */}
      {loading && tasks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted-foreground)', fontSize: '0.875rem' }}>
          Loading tasks...
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
              width: '40px',
              height: '40px',
              borderRadius: '9999px',
              backgroundColor: '#f0fdf4',
              color: '#16a34a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 0.75rem auto',
            }}
          >
            <CheckCircle2 size={24} />
          </div>
          <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1rem', fontWeight: 600, color: 'var(--foreground)' }}>
            All caught up!
          </h3>
          <p style={{ margin: '0 0 1rem 0', color: 'var(--muted-foreground)', fontSize: '0.8125rem' }}>
            No unfinished tasks due today or rolled over.
          </p>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              setEditingTask(null);
              setSubtaskParentId(null);
              setIsFormOpen(true);
            }}
          >
            <Plus size={14} />
            <span>Add a task</span>
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
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
            />
          ))}
        </div>
      )}

      {/* Modal Form */}
      <TaskForm
        isOpen={isFormOpen}
        initialTask={editingTask}
        parentTaskId={subtaskParentId}
        defaultDate={todayStr}
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
