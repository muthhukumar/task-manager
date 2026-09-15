import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export const ThemeToggle: React.FC<{ className?: string }> = ({ className }) => {
  const { resolvedTheme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`btn btn-ghost btn-icon-sm ${className || ''}`}
      title={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
      aria-label="Toggle theme"
      style={{
        borderRadius: '6px',
        color: 'var(--muted-foreground)',
      }}
    >
      {resolvedTheme === 'dark' ? (
        <Sun size={16} style={{ color: '#facc15' }} />
      ) : (
        <Moon size={16} style={{ color: '#71717a' }} />
      )}
    </button>
  );
};
