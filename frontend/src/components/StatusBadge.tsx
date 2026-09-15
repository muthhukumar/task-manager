import React from 'react';
import type { TaskStatus } from '../types';

interface Props {
  status: TaskStatus;
  size?: 'sm' | 'md';
}

const statusConfig: Record<TaskStatus, { label: string; dot: string; bg: string; text: string; border: string }> = {
  not_started: {
    label: 'Not Started',
    dot: '#71717a',
    bg: '#f4f4f5',
    text: '#27272a',
    border: '#e4e4e7',
  },
  in_progress: {
    label: 'In Progress',
    dot: '#2563eb',
    bg: '#eff6ff',
    text: '#1d4ed8',
    border: '#bfdbfe',
  },
  blocked: {
    label: 'Blocked',
    dot: '#dc2626',
    bg: '#fef2f2',
    text: '#b91c1c',
    border: '#fecaca',
  },
  done: {
    label: 'Done',
    dot: '#16a34a',
    bg: '#f0fdf4',
    text: '#15803d',
    border: '#bbf7d0',
  },
};

export const StatusBadge: React.FC<Props> = ({ status, size = 'md' }) => {
  const cfg = statusConfig[status] || statusConfig.not_started;
  const isSm = size === 'sm';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.375rem',
        padding: isSm ? '0.125rem 0.5rem' : '0.25rem 0.625rem',
        fontSize: isSm ? '0.6875rem' : '0.75rem',
        fontWeight: 500,
        borderRadius: '9999px',
        backgroundColor: cfg.bg,
        color: cfg.text,
        border: `1px solid ${cfg.border}`,
        lineHeight: 1,
        whiteSpace: 'nowrap',
        letterSpacing: '0.01em',
      }}
    >
      <span
        style={{
          width: isSm ? '5px' : '6px',
          height: isSm ? '5px' : '6px',
          borderRadius: '50%',
          backgroundColor: cfg.dot,
        }}
      />
      {cfg.label}
    </span>
  );
};
