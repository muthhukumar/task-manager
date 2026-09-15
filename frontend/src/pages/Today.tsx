import React, { useEffect, useState, useCallback } from 'react';
import type { Task, TaskInput, TaskStatus } from '../types';
import {
  getTodayTasks,
  updateTask,
  deleteTask,
  addComment,
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

  const todayStr = new Date().toISOString().split('T')[0];

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getTodayTasks(todayStr);
      setTasks(data);
    } catch (err: any) {
      console.error('Failed to load today tasks:', err);
    } finally {
      setLoading(false);
    }
  }, [todayStr]);

  useEffect(() => {
    fetchTasks();

    const handleUpdate = () => fetchTasks();
    window.addEventListener('task-updated', handleUpdate);
    return () => window.removeEventListener('task-updated', handleUpdate);
  }, [fetchTasks]);

  const handleUpdateStatus = async (taskId: number, newStatus: TaskStatus) => {
    await updateTask(taskId, { status: newStatus });
    await fetchTasks();
  };

  const handleUpdateTask = async (taskId: number, input: Partial<TaskInput>) => {
    await updateTask(taskId, input);
    await fetchTasks();
  };

  const handleDeleteTask = async (taskId: number) => {
    await deleteTask(taskId);
    await fetchTasks();
  };

  const handleAddComment = async (taskId: number, body: string) => {
    await addComment(taskId, body);
    await fetchTasks();
  };

  const handleUploadAttachment = async (taskId: number, file: File) => {
    await uploadAttachment(taskId, file);
    await fetchTasks();
  };

  const handleDeleteAttachment = async (attachmentId: number) => {
    await deleteAttachment(attachmentId);
    await fetchTasks();
  };

  const handleFormSubmit = async (input: TaskInput) => {
    if (editingTask) {
      await updateTask(editingTask.id, input);
    } else {
      await createTask(input);
    }
    await fetchTasks();
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
      {loading ? (
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
              onUpdateStatus={handleUpdateStatus}
              onUpdateTask={handleUpdateTask}
              onDeleteTask={handleDeleteTask}
              onAddComment={handleAddComment}
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
