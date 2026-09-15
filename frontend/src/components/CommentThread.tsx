import React, { useState } from 'react';
import type { Comment } from '../types';
import { Send, MessageSquare } from 'lucide-react';

interface Props {
  taskId: number;
  comments: Comment[];
  onAddComment: (taskId: number, body: string) => Promise<void>;
  autoFocus?: boolean;
}

export const CommentThread: React.FC<Props> = ({
  taskId,
  comments = [],
  onAddComment,
  autoFocus = false,
}) => {
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      await onAddComment(taskId, text.trim());
      setText('');
    } catch (err: any) {
      alert(err.message || 'Failed to add comment');
    } finally {
      setIsSubmitting(false);
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
          {comments.map((c) => (
            <div
              key={c.id}
              style={{
                backgroundColor: 'var(--muted)',
                border: '1px solid var(--border)',
                borderRadius: '0.375rem',
                padding: '0.5rem 0.75rem',
                fontSize: '0.8125rem',
              }}
            >
              <div style={{ color: 'var(--foreground)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.4 }}>
                {c.body}
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)', marginTop: '0.25rem', textAlign: 'right' }}>
                {formatTimestamp(c.created_at)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', fontStyle: 'italic', marginBottom: '0.75rem' }}>
          No comments yet.
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.5rem' }}>
        <input
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
