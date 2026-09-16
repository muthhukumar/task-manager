import React, { useState } from 'react';
import type { Task, TaskInput, TaskStatus } from '../types';
import { StatusBadge } from './StatusBadge';
import { CommentThread } from './CommentThread';
import { AttachmentGallery } from './AttachmentGallery';
import {
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Plus,
  Calendar,
  AlertCircle,
  Tag,
  Layers,
  Sparkles,
  Wrench,
  Bookmark,
  CheckSquare2,
} from 'lucide-react';

interface Props {
  task: Task;
  onUpdateStatus: (taskId: number, newStatus: TaskStatus) => Promise<void>;
  onUpdateTask: (taskId: number, input: Partial<TaskInput>) => Promise<void>;
  onDeleteTask: (taskId: number) => Promise<void>;
  onAddComment: (taskId: number, body: string) => Promise<void>;
  onUpdateComment?: (commentId: number, body: string) => Promise<void>;
  onDeleteComment?: (commentId: number) => Promise<void>;
  onUploadAttachment: (taskId: number, file: File) => Promise<void>;
  onDeleteAttachment: (attachmentId: number) => Promise<void>;
  onEditTask: (task: Task) => void;
  onAddSubtask: (parentTaskId: number) => void;
  isSubtaskView?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: (force?: boolean) => void;
  isTaskExpanded?: (taskId: number) => boolean;
  onToggleExpandTask?: (taskId: number, force?: boolean) => void;
  extraActions?: React.ReactNode;
}

export const TaskCard: React.FC<Props> = ({
  task,
  onUpdateStatus,
  onUpdateTask,
  onDeleteTask,
  onAddComment,
  onUpdateComment,
  onDeleteComment,
  onUploadAttachment,
  onDeleteAttachment,
  onEditTask,
  onAddSubtask,
  isSubtaskView = false,
  isExpanded: controlledExpanded,
  onToggleExpand,
  isTaskExpanded,
  onToggleExpandTask,
  extraActions,
}) => {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const isExpanded = controlledExpanded !== undefined
    ? controlledExpanded
    : (isTaskExpanded ? isTaskExpanded(task.id) : internalExpanded);

  const handleToggleExpand = (force?: boolean) => {
    if (onToggleExpandTask) {
      onToggleExpandTask(task.id, force);
    } else if (onToggleExpand) {
      onToggleExpand(force);
    } else {
      setInternalExpanded((prev) => (force !== undefined ? force : !prev));
    }
  };

  const [showMenu, setShowMenu] = useState(false);
  const [isPromptingBlocker, setIsPromptingBlocker] = useState(false);
  const [blockerReason, setBlockerReason] = useState('');

  const handleStatusClick = async (newStatus: TaskStatus) => {
    if (newStatus === task.status) return;

    if (newStatus === 'blocked') {
      setIsPromptingBlocker(true);
      return;
    }

    try {
      await onUpdateStatus(task.id, newStatus);
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    }
  };

  const handleBlockerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockerReason.trim()) {
      alert('Please provide a reason for the blocker.');
      return;
    }

    try {
      await onUpdateStatus(task.id, 'blocked');
      await onAddComment(task.id, `Blocker: ${blockerReason.trim()}`);
      setBlockerReason('');
      setIsPromptingBlocker(false);
      handleToggleExpand(true);
      if (task.parent_task_id && onToggleExpandTask) {
        onToggleExpandTask(task.parent_task_id, true);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to mark as blocked');
    }
  };

  const handleToggleDeferred = async () => {
    try {
      await onUpdateTask(task.id, { is_deferred: !task.is_deferred });
      setShowMenu(false);
    } catch (err: any) {
      alert(err.message || 'Failed to toggle deferred state');
    }
  };

  const completedSubtasks = task.subtasks?.filter((st) => st.status === 'done').length || 0;
  const totalSubtasks = task.subtasks?.length || 0;

  const blockerComment = task.comments
    ?.slice()
    .reverse()
    .find((c) => c.body.toLowerCase().startsWith('blocker:'))?.body;

  const blockerReasonText = blockerComment
    ? blockerComment.replace(/^blocker:\s*/i, '').trim()
    : (task.status === 'blocked' && task.comments && task.comments.length > 0
        ? task.comments[task.comments.length - 1].body
        : null);

  return (
    <div
      className="card"
      style={{
        padding: isSubtaskView ? '0.75rem 1rem' : '1.125rem 1.25rem',
        borderRadius: isSubtaskView ? '0.5rem' : '0.75rem',
        transition: 'all 0.15s ease',
      }}
    >
      {/* Header & Status row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem', flex: 1, minWidth: 0 }}>
          <button
            type="button"
            className="btn-ghost btn-icon-sm"
            onClick={() => handleToggleExpand()}
            style={{
              marginTop: '0.125rem',
              borderRadius: '4px',
              cursor: 'pointer',
              width: isSubtaskView ? '1.5rem' : undefined,
              height: isSubtaskView ? '1.5rem' : undefined,
              padding: isSubtaskView ? '2px' : undefined,
            }}
            title={isExpanded ? 'Collapse details' : 'Expand details'}
            aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
          >
            {isExpanded ? <ChevronDown size={isSubtaskView ? 14 : 16} /> : <ChevronRight size={isSubtaskView ? 14 : 16} />}
          </button>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.375rem' }}>
              <span
                onClick={() => handleToggleExpand()}
                style={{
                  fontSize: isSubtaskView ? '0.875rem' : '0.9375rem',
                  fontWeight: 600,
                  color: task.status === 'done' ? 'var(--muted-foreground)' : 'var(--foreground)',
                  textDecoration: task.status === 'done' ? 'line-through' : 'none',
                  letterSpacing: '-0.01em',
                  cursor: 'pointer',
                }}
              >
                {task.title}
              </span>

              <StatusBadge status={task.status} size="sm" />

              {task.sprint_name && (
                <span className="badge badge-secondary" style={{ gap: '0.25rem' }}>
                  <Layers size={10} />
                  {task.sprint_name}
                </span>
              )}

              {task.card_title && (
                <span className="badge badge-outline" style={{ gap: '0.25rem', color: '#6366f1', borderColor: 'var(--border)' }}>
                  <Tag size={10} />
                  {task.card_title}
                </span>
              )}

              {task.is_adhoc && (
                <span className="badge" style={{ backgroundColor: 'rgba(234, 179, 8, 0.1)', color: '#ca8a04', borderColor: 'rgba(234, 179, 8, 0.25)', gap: '0.25rem' }}>
                  <Sparkles size={10} />
                  Ad-hoc
                </span>
              )}

              {task.is_tech_task && (
                <span className="badge" style={{ backgroundColor: 'rgba(6, 182, 212, 0.1)', color: '#0891b2', borderColor: 'rgba(6, 182, 212, 0.25)', gap: '0.25rem' }}>
                  <Wrench size={10} />
                  Tech
                </span>
              )}

              {task.is_deferred && (
                <span className="badge" style={{ backgroundColor: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', borderColor: 'rgba(139, 92, 246, 0.25)', gap: '0.25rem' }}>
                  <Bookmark size={10} />
                  Backlog
                </span>
              )}
            </div>

            {task.description && (
              <p style={{ margin: '0.25rem 0 0.5rem 0', fontSize: '0.8125rem', color: 'var(--muted-foreground)', lineHeight: 1.4 }}>
                {task.description}
              </p>
            )}

            {/* Metadata tags */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                <Calendar size={12} />
                {task.assigned_date}
              </span>

              {totalSubtasks > 0 && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                  <CheckSquare2 size={12} />
                  {completedSubtasks}/{totalSubtasks} subtasks
                </span>
              )}

              {task.comments && task.comments.length > 0 && (
                <span>{task.comments.length} comments</span>
              )}

              {task.attachments && task.attachments.length > 0 && (
                <span>{task.attachments.length} files</span>
              )}
            </div>
          </div>
        </div>

        {/* Status segment toggle (shadcn tabs style), Extra Actions & Menu */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0, flexWrap: 'wrap' }}>
          {extraActions}
          <div className="tabs-list" style={{ height: '1.75rem', padding: '0.125rem' }}>
            <button
              type="button"
              className={`tabs-trigger ${task.status === 'not_started' ? 'tabs-trigger-active' : ''}`}
              style={{ fontSize: '0.6875rem', padding: '0.125rem 0.5rem' }}
              onClick={() => handleStatusClick('not_started')}
            >
              Start
            </button>
            <button
              type="button"
              className={`tabs-trigger ${task.status === 'in_progress' ? 'tabs-trigger-active' : ''}`}
              style={{ fontSize: '0.6875rem', padding: '0.125rem 0.5rem' }}
              onClick={() => handleStatusClick('in_progress')}
            >
              Doing
            </button>
            <button
              type="button"
              className={`tabs-trigger ${task.status === 'blocked' ? 'tabs-trigger-active' : ''}`}
              style={{ fontSize: '0.6875rem', padding: '0.125rem 0.5rem' }}
              onClick={() => handleStatusClick('blocked')}
            >
              Blocked
            </button>
            <button
              type="button"
              className={`tabs-trigger ${task.status === 'done' ? 'tabs-trigger-active' : ''}`}
              style={{ fontSize: '0.6875rem', padding: '0.125rem 0.5rem' }}
              onClick={() => handleStatusClick('done')}
            >
              Done
            </button>
          </div>

          {/* More Menu */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className="btn-ghost btn-icon-sm"
              onClick={() => setShowMenu(!showMenu)}
              style={{ borderRadius: '4px', cursor: 'pointer' }}
            >
              <MoreHorizontal size={16} />
            </button>

            {showMenu && (
              <div
                className="card"
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '100%',
                  marginTop: '0.25rem',
                  zIndex: 30,
                  minWidth: '140px',
                  padding: '0.25rem',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    onEditTask(task);
                  }}
                  className="btn-ghost"
                  style={{ width: '100%', justifyContent: 'flex-start', padding: '0.375rem 0.625rem', fontSize: '0.75rem', height: 'auto' }}
                >
                  Edit Task
                </button>

                {!isSubtaskView && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      onAddSubtask(task.id);
                    }}
                    className="btn-ghost"
                    style={{ width: '100%', justifyContent: 'flex-start', padding: '0.375rem 0.625rem', fontSize: '0.75rem', height: 'auto' }}
                  >
                    Add Subtask
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleToggleDeferred}
                  className="btn-ghost"
                  style={{ width: '100%', justifyContent: 'flex-start', padding: '0.375rem 0.625rem', fontSize: '0.75rem', height: 'auto' }}
                >
                  {task.is_deferred ? 'Move to Active' : 'Do Later (Backlog)'}
                </button>

                <div style={{ height: '1px', backgroundColor: 'var(--border)', margin: '0.25rem 0' }} />

                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    if (confirm(`Delete "${task.title}"?`)) {
                      onDeleteTask(task.id);
                    }
                  }}
                  className="btn-ghost"
                  style={{ width: '100%', justifyContent: 'flex-start', padding: '0.375rem 0.625rem', fontSize: '0.75rem', height: 'auto', color: '#ef4444' }}
                >
                  Delete Task
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Blocker reason banner */}
      {task.status === 'blocked' && !isPromptingBlocker && (
        <div
          style={{
            marginTop: '0.75rem',
            padding: '0.625rem 0.875rem',
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: '0.5rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.5rem',
            fontSize: '0.8125rem',
          }}
        >
          <AlertCircle size={16} style={{ color: '#ef4444', marginTop: '0.125rem', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
              <span style={{ fontWeight: 600, color: '#ef4444' }}>Blocker:</span>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => handleToggleExpand(true)}
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--muted-foreground)',
                  padding: '0 0.25rem',
                  height: 'auto',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                {isExpanded ? 'Hide comments' : 'View comments'}
              </button>
            </div>
            <div style={{ color: 'var(--foreground)', wordBreak: 'break-word', marginTop: '0.125rem', lineHeight: 1.4 }}>
              {blockerReasonText || 'This item is currently blocked.'}
            </div>
          </div>
        </div>
      )}

      {/* Blocker reason prompt */}
      {isPromptingBlocker && (
        <form
          onSubmit={handleBlockerSubmit}
          style={{
            marginTop: '0.75rem',
            padding: '0.875rem',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: '0.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: '#ef4444', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            <AlertCircle size={15} />
            <span>Why is this task blocked? (Required)</span>
          </div>
          <input
            type="text"
            required
            autoFocus
            className="input"
            placeholder="e.g. Waiting on API spec from team, build failing..."
            value={blockerReason}
            onChange={(e) => setBlockerReason(e.target.value)}
            style={{ marginBottom: '0.5rem' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setIsPromptingBlocker(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-destructive btn-sm"
            >
              Save Blocker & Comment
            </button>
          </div>
        </form>
      )}

      {/* Expanded Sections */}
      {isExpanded && (
        <div style={{ marginTop: '0.875rem', paddingTop: '0.875rem', borderTop: '1px solid var(--border)' }}>
          {/* Subtasks (only rendered for top-level tasks) */}
          {!isSubtaskView && (
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--foreground)' }}>
                  Subtasks ({completedSubtasks}/{totalSubtasks})
                </span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => onAddSubtask(task.id)}
                  style={{ color: 'var(--foreground)', fontWeight: 500 }}
                >
                  <Plus size={13} />
                  <span>Add Subtask</span>
                </button>
              </div>

              {task.subtasks && task.subtasks.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingLeft: '0.5rem' }}>
                  {task.subtasks.map((st) => (
                    <TaskCard
                      key={st.id}
                      task={st}
                      isSubtaskView={true}
                      isExpanded={isTaskExpanded ? isTaskExpanded(st.id) : undefined}
                      onToggleExpand={onToggleExpandTask ? (force) => onToggleExpandTask(st.id, force) : undefined}
                      isTaskExpanded={isTaskExpanded}
                      onToggleExpandTask={onToggleExpandTask}
                      onUpdateStatus={onUpdateStatus}
                      onUpdateTask={onUpdateTask}
                      onDeleteTask={onDeleteTask}
                      onAddComment={onAddComment}
                      onUpdateComment={onUpdateComment}
                      onDeleteComment={onDeleteComment}
                      onUploadAttachment={onUploadAttachment}
                      onDeleteAttachment={onDeleteAttachment}
                      onEditTask={onEditTask}
                      onAddSubtask={onAddSubtask}
                    />
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', fontStyle: 'italic' }}>
                  No subtasks yet.
                </div>
              )}
            </div>
          )}

          {/* Comments */}
          <CommentThread
            taskId={task.id}
            comments={task.comments || []}
            onAddComment={onAddComment}
            onUpdateComment={onUpdateComment}
            onDeleteComment={onDeleteComment}
          />

          {/* Attachments */}
          <AttachmentGallery
            taskId={task.id}
            attachments={task.attachments || []}
            onUpload={onUploadAttachment}
            onDelete={onDeleteAttachment}
          />
        </div>
      )}
    </div>
  );
};
