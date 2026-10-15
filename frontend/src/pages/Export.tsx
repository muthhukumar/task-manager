import React, { useEffect, useState, useRef, useMemo } from 'react';
import type { Sprint, Task, TaskStatus } from '../types';
import { getSprints, getTasks } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import { toPng } from 'html-to-image';
import {
  Download,
  CheckSquare,
  Square,
  Copy,
  Check,
  FileText,
  Image,
  ListTree,
} from 'lucide-react';

const formatStatusTag = (status: TaskStatus): string => {
  switch (status) {
    case 'done':
      return '[DONE]';
    case 'in_progress':
      return '[IN PROGRESS]';
    case 'blocked':
      return '[BLOCKED]';
    case 'not_started':
    default:
      return '[NOT STARTED]';
  }
};

const statusLabels: Record<TaskStatus, string> = {
  done: 'Done',
  in_progress: 'In Progress',
  blocked: 'Blocked',
  not_started: 'Not Started',
};

const generateSummaryText = (
  selectedTasks: Task[],
  includeSubtasks: boolean,
  sprintName?: string
): string => {
  const dateStr = new Date().toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const totalSubtasks = selectedTasks.reduce(
    (acc, t) => acc + (t.subtasks ? t.subtasks.length : 0),
    0
  );

  let output = `Task Status Report — ${dateStr}\n`;
  if (sprintName) {
    output += `Sprint: ${sprintName} • `;
  }
  output += `${selectedTasks.length} Tasks`;
  if (includeSubtasks && totalSubtasks > 0) {
    output += ` (${totalSubtasks} Subtasks)`;
  }
  output += `\n${'='.repeat(48)}\n\n`;

  if (selectedTasks.length === 0) {
    output += 'No tasks selected.\n';
    return output;
  }

  selectedTasks.forEach((t, idx) => {
    output += `${idx + 1}. ${formatStatusTag(t.status)} ${t.title}\n`;
    const meta: string[] = [];
    if (t.sprint_name) meta.push(t.sprint_name);
    if (t.card_title) meta.push(t.card_title);
    if (t.assigned_date) meta.push(`Assigned: ${t.assigned_date}`);
    if (meta.length > 0) {
      output += `   • ${meta.join(' • ')}\n`;
    }
    if (t.description && t.description.trim()) {
      output += `   Note: ${t.description.trim()}\n`;
    }

    if (includeSubtasks && t.subtasks && t.subtasks.length > 0) {
      t.subtasks.forEach((st) => {
        output += `   ↳ ${formatStatusTag(st.status)} ${st.title}\n`;
      });
    }
    output += '\n';
  });

  output += `Generated from Personal Sprint & Task Manager\n`;
  return output.trim();
};

const generateMarkdownText = (
  selectedTasks: Task[],
  includeSubtasks: boolean,
  sprintName?: string
): string => {
  const dateStr = new Date().toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const totalSubtasks = selectedTasks.reduce(
    (acc, t) => acc + (t.subtasks ? t.subtasks.length : 0),
    0
  );

  let output = `# Task Status Report — ${dateStr}\n\n`;
  if (sprintName) {
    output += `*Sprint: ${sprintName}* • `;
  }
  output += `*${selectedTasks.length} Tasks`;
  if (includeSubtasks && totalSubtasks > 0) {
    output += ` (${totalSubtasks} Subtasks)`;
  }
  output += `*\n\n`;

  if (selectedTasks.length === 0) {
    output += '_No tasks selected._\n';
    return output;
  }

  selectedTasks.forEach((t) => {
    const isDone = t.status === 'done';
    const check = isDone ? '[x]' : '[ ]';
    const statusLabel = isDone ? '' : ` \`[${statusLabels[t.status] || t.status}]\``;
    const meta: string[] = [];
    if (t.sprint_name) meta.push(t.sprint_name);
    if (t.card_title) meta.push(t.card_title);
    const metaStr = meta.length > 0 ? ` *(${meta.join(' • ')})*` : '';

    output += `- ${check} **${t.title}**${metaStr}${statusLabel}\n`;

    if (includeSubtasks && t.subtasks && t.subtasks.length > 0) {
      t.subtasks.forEach((st) => {
        const stDone = st.status === 'done';
        const stCheck = stDone ? '[x]' : '[ ]';
        const stStatus = stDone ? '' : ` \`[${statusLabels[st.status] || st.status}]\``;
        output += `  - ${stCheck} ${st.title}${stStatus}\n`;
      });
    }
  });

  output += `\n---\n*Generated from Personal Sprint & Task Manager*\n`;
  return output.trim();
};

export const Export: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [statusFilter, setStatusFilter] = useState<'all' | 'done' | 'not_done'>('all');
  const [sprintFilter, setSprintFilter] = useState<number | ''>('');
  const [exportFormat, setExportFormat] = useState<'picture' | 'text'>('picture');
  const [includeSubtasks, setIncludeSubtasks] = useState(true);
  const [textFormatStyle, setTextFormatStyle] = useState<'summary' | 'markdown'>('summary');
  const [isExporting, setIsExporting] = useState(false);
  const [copied, setCopied] = useState(false);

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

  const selectedTasks = useMemo(
    () => tasks.filter((t) => selectedIds.has(t.id)),
    [tasks, selectedIds]
  );

  const totalSubtasks = useMemo(
    () =>
      selectedTasks.reduce(
        (acc, t) => acc + (t.subtasks ? t.subtasks.length : 0),
        0
      ),
    [selectedTasks]
  );

  const generatedText = useMemo(() => {
    const currentSprint = sprints.find((s) => s.id === sprintFilter);
    if (textFormatStyle === 'markdown') {
      return generateMarkdownText(
        selectedTasks,
        includeSubtasks,
        currentSprint?.name
      );
    }
    return generateSummaryText(
      selectedTasks,
      includeSubtasks,
      currentSprint?.name
    );
  }, [selectedTasks, includeSubtasks, textFormatStyle, sprints, sprintFilter]);

  const handleCopyToClipboard = async () => {
    if (selectedTasks.length === 0) {
      alert('Please select at least one task to copy.');
      return;
    }

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(generatedText);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = generatedText;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err: any) {
      alert('Failed to copy to clipboard: ' + err.message);
    }
  };

  const handleDownloadText = () => {
    if (selectedTasks.length === 0) {
      alert('Please select at least one task to export.');
      return;
    }

    const blob = new Blob([generatedText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().split('T')[0];
    const extension = textFormatStyle === 'markdown' ? 'md' : 'txt';
    link.download = `tasks-export-${timestamp}.${extension}`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '1.75rem',
              fontWeight: 700,
              color: 'var(--foreground)',
              letterSpacing: '-0.025em',
              margin: '0 0 0.25rem 0',
            }}
          >
            Export Tasks & Reports
          </h1>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>
            Select sprint tasks and export as a styled shareable graphic or formatted text for updates
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {exportFormat === 'picture' ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleExportPNG}
              disabled={isExporting || selectedIds.size === 0}
            >
              <Download size={16} />
              <span>{isExporting ? 'Generating PNG...' : `Export PNG (${selectedIds.size})`}</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleCopyToClipboard}
                disabled={selectedIds.size === 0}
                style={{
                  backgroundColor: copied ? '#16a34a' : undefined,
                  borderColor: copied ? '#16a34a' : undefined,
                  color: copied ? '#ffffff' : undefined,
                  transition: 'all 0.2s ease',
                }}
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                <span>{copied ? 'Copied to Clipboard!' : 'Copy to Clipboard'}</span>
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={handleDownloadText}
                disabled={selectedIds.size === 0}
              >
                <Download size={16} />
                <span>{textFormatStyle === 'markdown' ? 'Download .md' : 'Download .txt'}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Format Switcher & Options Bar */}
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
        {/* Left Side: Format Toggle & Filters */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
          {/* Format Tabs */}
          <div
            style={{
              display: 'flex',
              backgroundColor: 'var(--muted)',
              padding: '0.25rem',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              gap: '0.25rem',
            }}
          >
            <button
              type="button"
              onClick={() => setExportFormat('picture')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                padding: '0.375rem 0.75rem',
                borderRadius: '6px',
                fontSize: '0.8125rem',
                fontWeight: 500,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: exportFormat === 'picture' ? 'var(--card)' : 'transparent',
                color: exportFormat === 'picture' ? 'var(--foreground)' : 'var(--muted-foreground)',
                boxShadow: exportFormat === 'picture' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <Image size={15} />
              <span>Picture (PNG)</span>
            </button>
            <button
              type="button"
              onClick={() => setExportFormat('text')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                padding: '0.375rem 0.75rem',
                borderRadius: '6px',
                fontSize: '0.8125rem',
                fontWeight: 500,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: exportFormat === 'text' ? 'var(--card)' : 'transparent',
                color: exportFormat === 'text' ? 'var(--foreground)' : 'var(--muted-foreground)',
                boxShadow: exportFormat === 'text' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <FileText size={15} />
              <span>Text Format</span>
            </button>
          </div>

          {/* Subtasks Toggle */}
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              cursor: 'pointer',
              fontSize: '0.8125rem',
              fontWeight: 500,
              color: 'var(--foreground)',
              userSelect: 'none',
              padding: '0.375rem 0.625rem',
              borderRadius: '6px',
              backgroundColor: includeSubtasks ? 'var(--accent)' : 'transparent',
              border: `1px solid ${includeSubtasks ? 'var(--ring)' : 'var(--border)'}`,
              transition: 'all 0.15s ease',
            }}
          >
            <input
              type="checkbox"
              checked={includeSubtasks}
              onChange={(e) => setIncludeSubtasks(e.target.checked)}
              style={{ cursor: 'pointer', accentColor: 'var(--primary)' }}
            />
            <ListTree
              size={15}
              style={{ color: includeSubtasks ? 'var(--foreground)' : 'var(--muted-foreground)' }}
            />
            <span>Include Subtasks</span>
          </label>

          {/* Text Style Selector (if Text format active) */}
          {exportFormat === 'text' && (
            <select
              className="select"
              value={textFormatStyle}
              onChange={(e) => setTextFormatStyle(e.target.value as 'summary' | 'markdown')}
              style={{ fontSize: '0.8125rem' }}
            >
              <option value="summary">Summary Text (Slack / Email)</option>
              <option value="markdown">Markdown Checklist (GitHub / Jira)</option>
            </select>
          )}

          {/* Filters */}
          <select
            className="select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            style={{ fontSize: '0.8125rem' }}
          >
            <option value="all">All Tasks (Completed & Pending)</option>
            <option value="done">Completed Tasks Only</option>
            <option value="not_done">Pending Tasks Only</option>
          </select>

          <select
            className="select"
            value={sprintFilter}
            onChange={(e) => setSprintFilter(e.target.value ? Number(e.target.value) : '')}
            style={{ fontSize: '0.8125rem' }}
          >
            <option value="">All Sprints</option>
            {sprints.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Right Side: Select / Deselect All */}
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
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) minmax(400px, 1.25fr)', gap: '1.5rem' }}>
        {/* Left Column: Task Selection */}
        <div
          className="card"
          style={{
            padding: '1rem',
            maxHeight: '700px',
            overflowY: 'auto',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '0.75rem',
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: '0.9375rem',
                fontWeight: 600,
                color: 'var(--foreground)',
                letterSpacing: '-0.01em',
              }}
            >
              Choose Tasks to Include
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
              {selectedIds.size} of {tasks.length} selected
            </span>
          </div>

          {tasks.length === 0 ? (
            <div style={{ color: 'var(--muted-foreground)', fontSize: '0.875rem', textAlign: 'center', padding: '2rem' }}>
              No tasks match current filter.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {tasks.map((t) => {
                const isChecked = selectedIds.has(t.id);
                const subtaskCount = t.subtasks?.length || 0;

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
                      <div
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--muted-foreground)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.375rem',
                          marginTop: '2px',
                        }}
                      >
                        <span>{t.assigned_date}</span>
                        <span>•</span>
                        <span>{statusLabels[t.status] || t.status}</span>
                        {subtaskCount > 0 && (
                          <>
                            <span>•</span>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '2px',
                                fontSize: '0.6875rem',
                                color: includeSubtasks ? 'var(--primary)' : 'var(--muted-foreground)',
                                fontWeight: 500,
                              }}
                            >
                              <ListTree size={12} />
                              {subtaskCount} subtask{subtaskCount > 1 ? 's' : ''}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Preview Panel (Picture or Text) */}
        <div>
          {exportFormat === 'picture' ? (
            /* PICTURE PREVIEW */
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '0.75rem',
                }}
              >
                <h3
                  style={{
                    margin: 0,
                    fontSize: '0.9375rem',
                    fontWeight: 600,
                    color: 'var(--foreground)',
                    letterSpacing: '-0.01em',
                  }}
                >
                  Image Preview ({selectedTasks.length} tasks
                  {includeSubtasks && totalSubtasks > 0 ? `, ${totalSubtasks} subtasks` : ''})
                </h3>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={handleExportPNG}
                  disabled={isExporting || selectedIds.size === 0}
                >
                  <Download size={14} />
                  <span>Download PNG</span>
                </button>
              </div>

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
                {/* Image Header */}
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
                    <span
                      style={{
                        display: 'inline-block',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        backgroundColor: '#f4f4f5',
                        color: '#18181b',
                        padding: '0.25rem 0.625rem',
                        borderRadius: '9999px',
                        border: '1px solid #e4e4e7',
                      }}
                    >
                      {selectedTasks.length} Tasks
                      {includeSubtasks && totalSubtasks > 0 ? ` • ${totalSubtasks} Subtasks` : ''}
                    </span>
                  </div>
                </div>

                {/* Selected Tasks List */}
                {selectedTasks.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: '#a1a1aa', fontStyle: 'italic', fontSize: '0.875rem' }}>
                    No tasks selected for export.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {selectedTasks.map((t, idx) => {
                      const hasSubtasks = includeSubtasks && t.subtasks && t.subtasks.length > 0;

                      return (
                        <div
                          key={t.id}
                          style={{
                            borderRadius: '6px',
                            backgroundColor: idx % 2 === 0 ? '#fafafa' : '#ffffff',
                            border: '1px solid #f4f4f5',
                            overflow: 'hidden',
                          }}
                        >
                          {/* Parent Task Row */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '0.625rem 0.875rem',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <span style={{ fontSize: '0.8125rem', color: '#a1a1aa', fontWeight: 500, minWidth: '1.25rem' }}>
                                {idx + 1}.
                              </span>
                              <div>
                                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#09090b' }}>
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

                          {/* Subtasks Section */}
                          {hasSubtasks && (
                            <div
                              style={{
                                borderTop: '1px solid #e4e4e7',
                                backgroundColor: idx % 2 === 0 ? '#f4f4f5' : '#fcfcfc',
                                padding: '0.5rem 0.875rem 0.5rem 2.5rem',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.375rem',
                              }}
                            >
                              {t.subtasks!.map((st) => (
                                <div
                                  key={st.id}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '0.5rem',
                                  }}
                                >
                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '0.5rem',
                                      fontSize: '0.8125rem',
                                    }}
                                  >
                                    <span style={{ color: '#a1a1aa', fontWeight: 600 }}>↳</span>
                                    <span
                                      style={{
                                        textDecoration: st.status === 'done' ? 'line-through' : 'none',
                                        color: st.status === 'done' ? '#71717a' : '#18181b',
                                      }}
                                    >
                                      {st.title}
                                    </span>
                                  </div>
                                  <StatusBadge status={st.status} size="sm" />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Footer */}
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
          ) : (
            /* TEXT PREVIEW */
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '0.75rem',
                }}
              >
                <h3
                  style={{
                    margin: 0,
                    fontSize: '0.9375rem',
                    fontWeight: 600,
                    color: 'var(--foreground)',
                    letterSpacing: '-0.01em',
                  }}
                >
                  Text Preview ({selectedTasks.length} tasks
                  {includeSubtasks && totalSubtasks > 0 ? `, ${totalSubtasks} subtasks` : ''})
                </h3>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={handleCopyToClipboard}
                    disabled={selectedTasks.length === 0}
                    style={{
                      backgroundColor: copied ? '#16a34a' : undefined,
                      borderColor: copied ? '#16a34a' : undefined,
                      color: copied ? '#ffffff' : undefined,
                      transition: 'all 0.2s ease',
                      gap: '0.375rem',
                    }}
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copied ? 'Copied!' : 'Copy to Clipboard'}</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={handleDownloadText}
                    disabled={selectedTasks.length === 0}
                    style={{ gap: '0.375rem' }}
                  >
                    <Download size={14} />
                    <span>Download</span>
                  </button>
                </div>
              </div>

              <div
                className="card"
                style={{
                  padding: '1rem',
                  backgroundColor: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                }}
              >
                {selectedTasks.length === 0 ? (
                  <div
                    style={{
                      padding: '3rem',
                      textAlign: 'center',
                      color: 'var(--muted-foreground)',
                      fontStyle: 'italic',
                      fontSize: '0.875rem',
                    }}
                  >
                    No tasks selected for text export.
                  </div>
                ) : (
                  <pre
                    style={{
                      margin: 0,
                      fontFamily:
                        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                      fontSize: '0.8125rem',
                      lineHeight: '1.6',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      maxHeight: '620px',
                      overflowY: 'auto',
                      color: 'var(--foreground)',
                      backgroundColor: 'var(--background)',
                      padding: '1rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                    }}
                  >
                    {generatedText}
                  </pre>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
