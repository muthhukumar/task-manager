import React, { useEffect, useState, useCallback } from 'react';
import type { Sprint, Task, TaskFilter, TaskInput, TaskStatus } from '../types';
import {
  getTasks,
  getSprints,
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
import { Plus, Search, RotateCcw } from 'lucide-react';

export const AllTasks: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<number>>(new Set());

  // Filters
  const [statusFilter, setStatusFilter] = useState<TaskStatus | ''>('');
  const [sprintFilter, setSprintFilter] = useState<number | ''>('');
  const [workTypeFilter, setWorkTypeFilter] = useState<'all' | 'adhoc' | 'tech'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [includeDone, setIncludeDone] = useState(true);

  // Modals
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [subtaskParentId, setSubtaskParentId] = useState<number | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const fetchTasks = useCallback(async (initialLoad = false) => {
    try {
      if (initialLoad) setLoading(true);
      const filter: TaskFilter = {
        top_level_only: true,
        include_done: includeDone,
      };
      if (statusFilter) filter.status = statusFilter;
      if (sprintFilter !== '') filter.sprint_id = sprintFilter;
      if (workTypeFilter === 'adhoc') filter.adhoc = true;
      if (workTypeFilter === 'tech') filter.tech = true;

      const data = await getTasks(filter);
      setTasks(data);
    } catch (err: any) {
      console.error('Failed to load tasks:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, sprintFilter, workTypeFilter, includeDone]);

  useEffect(() => {
    getSprints().then(setSprints).catch(console.error);
  }, []);

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
    await fetchTasks(false);
  };

  const resetFilters = () => {
    setStatusFilter('');
    setSprintFilter('');
    setWorkTypeFilter('all');
    setSearchQuery('');
    setIncludeDone(true);
  };

  const filteredTasks = tasks.filter((t) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.title.toLowerCase().includes(q) ||
      (t.description && t.description.toLowerCase().includes(q)) ||
      (t.sprint_name && t.sprint_name.toLowerCase().includes(q)) ||
      (t.card_title && t.card_title.toLowerCase().includes(q))
    );
  });

  return (
    <div>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--foreground)', letterSpacing: '-0.025em', margin: '0 0 0.25rem 0' }}>
            All Tasks
          </h1>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>
            Inspect, filter, and track all work items across sprints and backlogs
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
          <span>New Task</span>
        </button>
      </div>

      {/* Filter Toolbar (shadcn card) */}
      <div
        className="card"
        style={{
          padding: '1rem',
          marginBottom: '1.5rem',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.75rem',
          alignItems: 'center',
        }}
      >
        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', position: 'relative', flex: '1 1 220px' }}>
          <Search size={15} style={{ position: 'absolute', left: '10px', color: 'var(--muted-foreground)' }} />
          <input
            type="text"
            className="input"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '32px' }}
          />
        </div>

        {/* Status Filter */}
        <select
          className="select"
          style={{ width: 'auto', minWidth: '130px' }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as TaskStatus | '')}
        >
          <option value="">All Statuses</option>
          <option value="not_started">Not Started</option>
          <option value="in_progress">In Progress</option>
          <option value="blocked">Blocked</option>
          <option value="done">Done</option>
        </select>

        {/* Sprint Filter */}
        <select
          className="select"
          style={{ width: 'auto', minWidth: '130px' }}
          value={sprintFilter}
          onChange={(e) => setSprintFilter(e.target.value ? Number(e.target.value) : '')}
        >
          <option value="">All Sprints</option>
          {sprints.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        {/* Work Type Filter */}
        <select
          className="select"
          style={{ width: 'auto', minWidth: '130px' }}
          value={workTypeFilter}
          onChange={(e) => setWorkTypeFilter(e.target.value as any)}
        >
          <option value="all">All Types</option>
          <option value="adhoc">Ad-hoc Only</option>
          <option value="tech">Tech Tasks Only</option>
        </select>

        {/* Include Done */}
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', color: 'var(--muted-foreground)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          <input
            type="checkbox"
            checked={includeDone}
            onChange={(e) => setIncludeDone(e.target.checked)}
          />
          <span>Include completed</span>
        </label>

        {/* Reset */}
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={resetFilters}
          title="Reset filters"
        >
          <RotateCcw size={13} />
          <span>Reset</span>
        </button>
      </div>

      {/* Tasks List */}
      {loading && tasks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted-foreground)', fontSize: '0.875rem' }}>
          Loading tasks...
        </div>
      ) : filteredTasks.length === 0 ? (
        <div
          className="card"
          style={{
            padding: '3rem',
            textAlign: 'center',
            color: 'var(--muted-foreground)',
            fontSize: '0.875rem',
          }}
        >
          No tasks found matching your filter criteria.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ fontSize: '0.8125rem', color: 'var(--muted-foreground)', fontWeight: 500, marginBottom: '0.25rem' }}>
            Showing {filteredTasks.length} {filteredTasks.length === 1 ? 'task' : 'tasks'}
          </div>
          {filteredTasks.map((task) => (
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
