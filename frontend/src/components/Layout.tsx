import React, { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  CalendarCheck,
  ListTodo,
  Layers,
  Archive,
  BarChart3,
  Share2,
  Database,
  Plus,
  CheckCircle2,
} from 'lucide-react';
import { TaskForm } from './TaskForm';
import { ThemeToggle } from './ThemeToggle';
import type { TaskInput } from '../types';
import { createTask } from '../api/client';

export const Layout: React.FC = () => {
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);

  const handleCreateTask = async (input: TaskInput) => {
    await createTask(input);
    window.dispatchEvent(new CustomEvent('task-updated'));
  };

  const navItems = [
    { to: '/', label: 'Today', icon: CalendarCheck },
    { to: '/tasks', label: 'All Tasks', icon: ListTodo },
    { to: '/sprints', label: 'Sprint Setup', icon: Layers },
    { to: '/backlog', label: 'Backlog / Do Later', icon: Archive },
    { to: '/reports', label: 'Reports & Charts', icon: BarChart3 },
    { to: '/export', label: 'Export Shareable', icon: Share2 },
    { to: '/backup', label: 'Backup & Restore', icon: Database },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--background)' }}>
      {/* Sidebar */}
      <aside
        style={{
          width: '250px',
          backgroundColor: 'var(--card)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          position: 'fixed',
          top: 0,
          bottom: 0,
          left: 0,
          zIndex: 40,
        }}
      >
        {/* Brand / Logo */}
        <div
          style={{
            height: '56px',
            padding: '0 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              backgroundColor: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary-foreground)',
            }}
          >
            <CheckCircle2 size={16} />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--foreground)', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
              Task Manager
            </div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)' }}>Personal Sprint Hub</div>
          </div>
        </div>

        {/* Quick Action Button */}
        <div style={{ padding: '16px' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setIsNewTaskOpen(true)}
            style={{ width: '100%' }}
          >
            <Plus size={16} />
            <span>New Task</span>
          </button>
        </div>

        {/* Navigation items */}
        <nav style={{ flex: 1, padding: '0 10px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div style={{ padding: '4px 10px', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Workspace
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  color: isActive ? 'var(--foreground)' : 'var(--muted-foreground)',
                  backgroundColor: isActive ? 'var(--accent)' : 'transparent',
                  textDecoration: 'none',
                  fontSize: '0.875rem',
                  fontWeight: isActive ? 600 : 500,
                  transition: 'all 0.15s ease',
                })}
              >
                <Icon size={16} style={{ color: 'inherit' }} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Footer info */}
        <div
          style={{
            padding: '16px',
            borderTop: '1px solid var(--border)',
            fontSize: '0.75rem',
            color: 'var(--muted-foreground)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>Single User</span>
          <span className="badge badge-secondary" style={{ fontSize: '0.625rem', padding: '0 6px' }}>Localhost</span>
        </div>
      </aside>

      {/* Main Content Area */}
      <div style={{ flex: 1, marginLeft: '250px', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top Header */}
        <header
          style={{
            height: '56px',
            backgroundColor: 'var(--card)',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 32px',
          }}
        >
          <div style={{ fontSize: '0.8125rem', color: 'var(--muted-foreground)', fontWeight: 500 }}>
            {new Date().toLocaleDateString(undefined, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ThemeToggle />
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setIsNewTaskOpen(true)}
            >
              <Plus size={14} />
              <span>Add Task</span>
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main style={{ flex: 1, padding: '32px', maxWidth: '1140px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
          <Outlet />
        </main>
      </div>

      {/* Global Task Creation Modal */}
      <TaskForm
        isOpen={isNewTaskOpen}
        onClose={() => setIsNewTaskOpen(false)}
        onSubmit={handleCreateTask}
      />
    </div>
  );
};
