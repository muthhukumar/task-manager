import React, { useEffect, useState, useRef } from 'react';
import type { Sprint, Task, TaskStatus } from '../types';
import { getSprints, getTasks } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import { toPng } from 'html-to-image';
import { Download, CheckSquare, Square } from 'lucide-react';

export const Export: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [statusFilter, setStatusFilter] = useState<'all' | 'done' | 'not_done'>('all');
  const [sprintFilter, setSprintFilter] = useState<number | ''>('');
  const [isExporting, setIsExporting] = useState(false);

  const exportCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getSprints().then(setSprints).catch(console.error);
  }, []);

  useEffect(() => {
    const fetchFiltered = async () => {
      let includeDone = true;
      let status: TaskStatus | '' = '';
      if (statusFilter === 'done') {
        status = 'done';
      } else if (statusFilter === 'not_done') {
        includeDone = false;
      }

      const filter: any = { top_level_only: true, include_done: includeDone };
      if (status) filter.status = status;
      if (sprintFilter !== '') filter.sprint_id = sprintFilter;

      const data = await getTasks(filter);
      setTasks(data);
      setSelectedIds(new Set(data.map((t) => t.id)));
    };

    fetchFiltered();
  }, [statusFilter, sprintFilter]);

  const toggleSelect = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const selectAll = () => {
    setSelectedIds(new Set(tasks.map((t) => t.id)));
  };

  const clearAll = () => {
    setSelectedIds(new Set());
  };

  const handleExportPNG = async () => {
    if (!exportCardRef.current || selectedIds.size === 0) {
      alert('Please select at least one task to export.');
      return;
    }

    try {
      setIsExporting(true);
      const dataUrl = await toPng(exportCardRef.current, {
        quality: 0.95,
        backgroundColor: '#ffffff',
        pixelRatio: 2,
      });

      const link = document.createElement('a');
      const timestamp = new Date().toISOString().split('T')[0];
      link.download = `tasks-export-${timestamp}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err: any) {
      alert('Failed to generate image: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const selectedTasks = tasks.filter((t) => selectedIds.has(t.id));

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--foreground)', letterSpacing: '-0.025em', margin: '0 0 0.25rem 0' }}>
            Export as Shareable Image
          </h1>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>
            Select sprint tasks and export a clean, styled PNG graphic for updates or reports
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={handleExportPNG}
          disabled={isExporting || selectedIds.size === 0}
        >
          <Download size={16} />
          <span>{isExporting ? 'Generating PNG...' : `Export PNG (${selectedIds.size})`}</span>
        </button>
      </div>

      {/* Filters & Selection Bar */}
      <div
        className="card"
        style={{
          padding: '0.875rem 1rem',
          marginBottom: '1.5rem',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.75rem',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
          <select
            className="select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
          >
            <option value="all">All Tasks (Completed & Pending)</option>
            <option value="done">Completed Tasks Only</option>
            <option value="not_done">Pending Tasks Only</option>
          </select>

          <select
            className="select"
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
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={selectAll}
          >
            Select All
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={clearAll}
          >
            Deselect All
          </button>
        </div>
      </div>

      {/* Two Column Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) minmax(400px, 1.2fr)', gap: '1.5rem' }}>
        <div
          className="card"
          style={{
            padding: '1rem',
            maxHeight: '650px',
            overflowY: 'auto',
          }}
        >
          <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--foreground)', letterSpacing: '-0.01em' }}>
            Choose Tasks to Include
          </h3>

          {tasks.length === 0 ? (
            <div style={{ color: 'var(--muted-foreground)', fontSize: '0.875rem', textAlign: 'center', padding: '2rem' }}>
              No tasks match current filter.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {tasks.map((t) => {
                const isChecked = selectedIds.has(t.id);
                return (
                  <div
                    key={t.id}
                    onClick={() => toggleSelect(t.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.625rem',
                      padding: '0.5rem 0.625rem',
                      borderRadius: '6px',
                      backgroundColor: isChecked ? 'var(--accent)' : 'var(--card)',
                      border: `1px solid ${isChecked ? 'var(--ring)' : 'var(--border)'}`,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {isChecked ? (
                      <CheckSquare size={17} style={{ color: 'var(--foreground)', flexShrink: 0 }} />
                    ) : (
                      <Square size={17} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '0.875rem',
                          fontWeight: 500,
                          color: 'var(--foreground)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {t.title}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
                        {t.assigned_date} • {t.status}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--foreground)', letterSpacing: '-0.01em' }}>
            Image Preview ({selectedTasks.length} tasks)
          </h3>

          <div
            ref={exportCardRef}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              padding: '2rem',
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
              border: '1px solid #e4e4e7',
            }}
          >
            <div
              style={{
                borderBottom: '1px solid #e4e4e7',
                paddingBottom: '1rem',
                marginBottom: '1.25rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
              }}
            >
              <div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#09090b', letterSpacing: '-0.025em' }}>
                  Task Status Report
                </div>
                <div style={{ fontSize: '0.8125rem', color: '#71717a', marginTop: '0.25rem' }}>
                  {new Date().toLocaleDateString(undefined, {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span className="badge badge-secondary" style={{ fontSize: '0.75rem', padding: '0.25rem 0.625rem' }}>
                  {selectedTasks.length} Tasks
                </span>
              </div>
            </div>

            {selectedTasks.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#a1a1aa', fontStyle: 'italic', fontSize: '0.875rem' }}>
                No tasks selected for export.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {selectedTasks.map((t, idx) => (
                  <div
                    key={t.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.625rem 0.875rem',
                      borderRadius: '6px',
                      backgroundColor: idx % 2 === 0 ? '#fafafa' : '#ffffff',
                      border: '1px solid #f4f4f5',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ fontSize: '0.8125rem', color: '#a1a1aa', fontWeight: 500, minWidth: '1.25rem' }}>
                        {idx + 1}.
                      </span>
                      <div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 500, color: '#09090b' }}>
                          {t.title}
                        </div>
                        {t.sprint_name && (
                          <div style={{ fontSize: '0.75rem', color: '#71717a', marginTop: '1px' }}>
                            {t.sprint_name} {t.card_title ? `• ${t.card_title}` : ''}
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <StatusBadge status={t.status} size="sm" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div
              style={{
                marginTop: '1.5rem',
                paddingTop: '0.75rem',
                borderTop: '1px solid #f4f4f5',
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.75rem',
                color: '#a1a1aa',
              }}
            >
              <span>Generated from Personal Sprint & Task Manager</span>
              <span>Localhost</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
