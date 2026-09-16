import React, { useState } from 'react';
import type { Comment } from '../types';
import { Send, MessageSquare, Pencil, Trash2, Check, X, AlertCircle } from 'lucide-react';

interface Props {
  taskId: number;
  comments: Comment[];
  onAddComment: (taskId: number, body: string) => Promise<void>;
  onUpdateComment?: (commentId: number, body: string) => Promise<void>;
  onDeleteComment?: (commentId: number) => Promise<void>;
  autoFocus?: boolean;
}

export const CommentThread: React.FC<Props> = ({
  taskId,
  comments = [],
  onAddComment,
  onUpdateComment,
  onDeleteComment,
  autoFocus = false,
}) => {
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      await onAddComment(taskId, text.trim());
      setText('');
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    } catch (err: any) {
      alert(err.message || 'Failed to add comment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEdit = (c: Comment) => {
    setEditingCommentId(c.id);
    setEditText(c.body);
  };

  const handleCancelEdit = () => {
    setEditingCommentId(null);
    setEditText('');
  };

  const handleSaveEdit = async (commentId: number) => {
    if (!editText.trim() || isUpdating) return;
    if (!onUpdateComment) return;

    try {
      setIsUpdating(true);
      await onUpdateComment(commentId, editText.trim());
      setEditingCommentId(null);
      setEditText('');
    } catch (err: any) {
      alert(err.message || 'Failed to update comment');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async (commentId: number) => {
    if (!onDeleteComment) return;
    if (!confirm('Are you sure you want to delete this comment?')) return;

    try {
      await onDeleteComment(commentId);
    } catch (err: any) {
      alert(err.message || 'Failed to delete comment');
    }
  };

  const formatTimestamp = (ts: string) => {
    try {
      const d = new Date(ts);
      return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return ts;
    }
  };

  return (
    <div style={{ marginTop: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.5rem', color: 'var(--muted-foreground)', fontSize: '0.8125rem', fontWeight: 500 }}>
        <MessageSquare size={14} />
        <span>Comments ({comments.length})</span>
      </div>

      {comments.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
          {comments.map((c) => {
            const isBlockerComment = c.body.toLowerCase().startsWith('blocker:');
            return (
              <div
                key={c.id}
                style={{
                  backgroundColor: isBlockerComment ? 'rgba(239, 68, 68, 0.07)' : 'var(--muted)',
                  border: isBlockerComment ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid var(--border)',
                  borderRadius: '0.375rem',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.8125rem',
                }}
              >
                {editingCommentId === c.id ? (
                  <div>
                    <textarea
                      className="textarea"
                      rows={2}
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault();
                          handleSaveEdit(c.id);
                        } else if (e.key === 'Escape') {
                          handleCancelEdit();
                        }
                      }}
                      autoFocus
                      style={{
                        width: '100%',
                        fontSize: '0.8125rem',
                        marginBottom: '0.375rem',
                        boxSizing: 'border-box',
                      }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.375rem' }}>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={handleCancelEdit}
                        disabled={isUpdating}
                        style={{ height: '1.75rem', padding: '0 0.5rem', fontSize: '0.75rem' }}
                      >
                        <X size={12} />
                        <span>Cancel</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => handleSaveEdit(c.id)}
                        disabled={!editText.trim() || isUpdating}
                        style={{ height: '1.75rem', padding: '0 0.5rem', fontSize: '0.75rem' }}
                      >
                        <Check size={12} />
                        <span>{isUpdating ? 'Saving...' : 'Save'}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {isBlockerComment && (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#ef4444', fontSize: '0.6875rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                        <AlertCircle size={12} />
                        <span>Blocker Update</span>
                      </div>
                    )}
                    <div style={{ color: 'var(--foreground)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.4 }}>
                      {c.body}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.25rem', paddingTop: '0.25rem' }}>
                      <span style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)' }}>
                        {formatTimestamp(c.created_at)}
                      </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      {onUpdateComment && (
                        <button
                          type="button"
                          className="btn-ghost"
                          onClick={() => handleStartEdit(c)}
                          title="Edit comment"
                          style={{
                            padding: '0.125rem 0.25rem',
                            height: 'auto',
                            color: 'var(--muted-foreground)',
                            borderRadius: '3px',
                          }}
                        >
                          <Pencil size={12} />
                        </button>
                      )}
                      {onDeleteComment && (
                        <button
                          type="button"
                          className="btn-ghost"
                          onClick={() => handleDelete(c.id)}
                          title="Delete comment"
                          style={{
                            padding: '0.125rem 0.25rem',
                            height: 'auto',
                            color: '#ef4444',
                            borderRadius: '3px',
                          }}
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        })}
        </div>
      ) : (
        <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', fontStyle: 'italic', marginBottom: '0.75rem' }}>
          No comments yet.
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          ref={inputRef}
          type="text"
          className="input"
          placeholder="Leave a comment or blocker update..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus={autoFocus}
          style={{ height: '2rem', fontSize: '0.8125rem' }}
        />
        <button
          type="submit"
          disabled={!text.trim() || isSubmitting}
          className="btn btn-primary btn-sm"
        >
          <Send size={12} />
          <span>{isSubmitting ? 'Posting...' : 'Post'}</span>
        </button>
      </form>
    </div>
  );
};

