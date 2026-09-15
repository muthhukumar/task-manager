import React, { useEffect, useState } from 'react';
import type { Card, Sprint, Task, TaskInput, TaskStatus } from '../types';
import { getCards, getSprints } from '../api/client';
import { X } from 'lucide-react';

interface Props {
  initialTask?: Task | null;
  parentTaskId?: number | null;
  defaultDate?: string;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: TaskInput) => Promise<void>;
}

export const TaskForm: React.FC<Props> = ({
  initialTask,
  parentTaskId,
  defaultDate,
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];

  const [formData, setFormData] = useState<TaskInput>({
    title: '',
    description: '',
    sprint_id: null,
    card_id: null,
    parent_task_id: parentTaskId || null,
    status: 'not_started',
    is_adhoc: false,
    is_tech_task: false,
    is_deferred: false,
    assigned_date: defaultDate || todayStr,
  });

  useEffect(() => {
    if (isOpen) {
      getSprints().then(setSprints).catch(console.error);
    }
  }, [isOpen]);

  useEffect(() => {
    if (initialTask) {
      setFormData({
        title: initialTask.title,
        description: initialTask.description || '',
        sprint_id: initialTask.sprint_id,
        card_id: initialTask.card_id,
        parent_task_id: initialTask.parent_task_id,
        status: initialTask.status,
        is_adhoc: initialTask.is_adhoc,
        is_tech_task: initialTask.is_tech_task,
        is_deferred: initialTask.is_deferred,
        assigned_date: initialTask.assigned_date,
      });
      if (initialTask.sprint_id) {
        getCards(initialTask.sprint_id).then(setCards).catch(console.error);
      }
    } else {
      setFormData({
        title: '',
        description: '',
        sprint_id: null,
        card_id: null,
        parent_task_id: parentTaskId || null,
        status: 'not_started',
        is_adhoc: false,
        is_tech_task: false,
        is_deferred: false,
        assigned_date: defaultDate || todayStr,
      });
      setCards([]);
    }
  }, [initialTask, parentTaskId, defaultDate, isOpen]);

  const handleSprintChange = (sprintIdNum: number | null) => {
    setFormData((prev) => ({ ...prev, sprint_id: sprintIdNum, card_id: null }));
    if (sprintIdNum) {
      getCards(sprintIdNum).then(setCards).catch(console.error);
    } else {
      setCards([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      alert('Task title is required');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit(formData);
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to save task');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const isSubtask = Boolean(parentTaskId || formData.parent_task_id);

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
          <div>
            <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.125rem', fontWeight: 600, color: 'var(--foreground)', letterSpacing: '-0.02em' }}>
              {initialTask ? 'Edit Task' : isSubtask ? 'Create Subtask' : 'Create Task'}
            </h3>
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}>
              Fill in the details below to schedule your task.
            </p>
          </div>
          <button
            type="button"
            className="btn-ghost btn-icon-sm"
            onClick={onClose}
            style={{ borderRadius: '4px', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Title */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: 'var(--foreground)', marginBottom: '0.375rem' }}>
              Title
            </label>
            <input
              type="text"
              required
              className="input"
              placeholder="e.g. Implement user authentication flow"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
          </div>

          {/* Description */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: 'var(--foreground)', marginBottom: '0.375rem' }}>
              Description <span style={{ color: 'var(--muted-foreground)', fontWeight: 400 }}>(Optional)</span>
            </label>
            <textarea
              rows={3}
              className="textarea"
              placeholder="Add any context, links, or criteria..."
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          {/* Assigned Date & Status */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: 'var(--foreground)', marginBottom: '0.375rem' }}>
                Assigned Date
              </label>
              <input
                type="date"
                required
                className="input"
                value={formData.assigned_date}
                onChange={(e) => setFormData({ ...formData, assigned_date: e.target.value })}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: 'var(--foreground)', marginBottom: '0.375rem' }}>
                Status
              </label>
              <select
                className="select"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as TaskStatus })}
              >
                <option value="not_started">Not Started</option>
                <option value="in_progress">In Progress</option>
                <option value="blocked">Blocked</option>
                <option value="done">Done</option>
              </select>
            </div>
          </div>

          {/* Sprint & Card */}
          {!isSubtask && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: 'var(--foreground)', marginBottom: '0.375rem' }}>
                  Sprint
                </label>
                <select
                  className="select"
                  value={formData.sprint_id ?? ''}
                  onChange={(e) => handleSprintChange(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">No Sprint (Standalone)</option>
                  {sprints.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: 'var(--foreground)', marginBottom: '0.375rem' }}>
                  Card Grouping
                </label>
                <select
                  className="select"
                  disabled={!formData.sprint_id || cards.length === 0}
                  value={formData.card_id ?? ''}
                  onChange={(e) => setFormData({ ...formData, card_id: e.target.value ? Number(e.target.value) : null })}
                  style={{ opacity: !formData.sprint_id ? 0.6 : 1 }}
                >
                  <option value="">No Card</option>
                  {cards.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Flags */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', padding: '0.75rem', backgroundColor: 'var(--muted)', border: '1px solid var(--border)', borderRadius: '0.375rem', marginBottom: '1.25rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', color: 'var(--foreground)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.is_adhoc}
                onChange={(e) => setFormData({ ...formData, is_adhoc: e.target.checked })}
              />
              <span>Ad-hoc</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', color: 'var(--foreground)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.is_tech_task}
                onChange={(e) => setFormData({ ...formData, is_tech_task: e.target.checked })}
              />
              <span>Tech Task</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', color: 'var(--foreground)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.is_deferred}
                onChange={(e) => setFormData({ ...formData, is_deferred: e.target.checked })}
              />
              <span>Do later (Backlog)</span>
            </label>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary"
            >
              {isSubmitting ? 'Saving...' : initialTask ? 'Update Task' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
