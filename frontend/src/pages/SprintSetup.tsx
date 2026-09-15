import React, { useEffect, useState } from 'react';
import type { Card, CardInput, Sprint, SprintInput } from '../types';
import {
  getSprints,
  createSprint,
  updateSprint,
  deleteSprint,
  getCards,
  createCard,
  updateCard,
  deleteCard,
} from '../api/client';
import {
  Plus,
  Calendar,
  Edit2,
  Trash2,
  Tag,
  Clock,
  ChevronDown,
  ChevronRight,
  X,
} from 'lucide-react';

export const SprintSetup: React.FC = () => {
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [loading, setLoading] = useState(true);

  // Sprint modal/form state
  const [isSprintModalOpen, setIsSprintModalOpen] = useState(false);
  const [editingSprint, setEditingSprint] = useState<Sprint | null>(null);
  const [sprintName, setSprintName] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [entryMode, setEntryMode] = useState<'duration' | 'dates'>('duration');
  const [durationDays, setDurationDays] = useState<number>(14);
  const [endDate, setEndDate] = useState('');

  // Card modal state
  const [activeSprintId, setActiveSprintId] = useState<number | null>(null);
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [cardTitle, setCardTitle] = useState('');
  const [cardDesc, setCardDesc] = useState('');

  // Sprint cards dictionary
  const [sprintCards, setSprintCards] = useState<Record<number, Card[]>>({});
  const [expandedSprints, setExpandedSprints] = useState<Record<number, boolean>>({});

  const fetchSprints = async () => {
    try {
      setLoading(true);
      const data = await getSprints();
      setSprints(data);

      const cardsMap: Record<number, Card[]> = {};
      await Promise.all(
        data.map(async (s) => {
          const cards = await getCards(s.id);
          cardsMap[s.id] = cards;
        })
      );
      setSprintCards(cardsMap);
    } catch (err: any) {
      console.error('Failed to load sprints:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSprints();
  }, []);

  useEffect(() => {
    if (startDate) {
      const s = new Date(startDate);
      if (entryMode === 'duration' && durationDays > 0) {
        const e = new Date(s);
        e.setDate(e.getDate() + durationDays);
        setEndDate(e.toISOString().split('T')[0]);
      } else if (entryMode === 'dates' && endDate) {
        const e = new Date(endDate);
        const diffDays = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays >= 0) {
          setDurationDays(diffDays);
        }
      }
    }
  }, [startDate, durationDays, endDate, entryMode]);

  const handleOpenSprintModal = (sprint?: Sprint) => {
    if (sprint) {
      setEditingSprint(sprint);
      setSprintName(sprint.name);
      setStartDate(sprint.start_date);
      setEndDate(sprint.end_date);
      setDurationDays(sprint.duration_days);
      setEntryMode('duration');
    } else {
      setEditingSprint(null);
      setSprintName(`Sprint ${sprints.length + 1}`);
      const today = new Date().toISOString().split('T')[0];
      setStartDate(today);
      setDurationDays(14);
      const e = new Date();
      e.setDate(e.getDate() + 14);
      setEndDate(e.toISOString().split('T')[0]);
      setEntryMode('duration');
    }
    setIsSprintModalOpen(true);
  };

  const handleSaveSprint = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const input: SprintInput = {
        name: sprintName.trim(),
        start_date: startDate,
        end_date: entryMode === 'dates' ? endDate : undefined,
        duration_days: entryMode === 'duration' ? durationDays : undefined,
      };

      if (editingSprint) {
        await updateSprint(editingSprint.id, input);
      } else {
        await createSprint(input);
      }

      setIsSprintModalOpen(false);
      await fetchSprints();
    } catch (err: any) {
      alert(err.message || 'Failed to save sprint');
    }
  };

  const handleDeleteSprint = async (id: number, name: string) => {
    if (!confirm(`Delete sprint "${name}"? Cards and tasks will have their sprint cleared.`)) {
      return;
    }
    try {
      await deleteSprint(id);
      await fetchSprints();
    } catch (err: any) {
      alert(err.message || 'Failed to delete sprint');
    }
  };

  const handleOpenCardModal = (sprintId: number, card?: Card) => {
    setActiveSprintId(sprintId);
    if (card) {
      setEditingCard(card);
      setCardTitle(card.title);
      setCardDesc(card.description || '');
    } else {
      setEditingCard(null);
      setCardTitle('');
      setCardDesc('');
    }
    setIsCardModalOpen(true);
  };

  const handleSaveCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardTitle.trim()) return;

    try {
      const input: CardInput = {
        sprint_id: activeSprintId,
        title: cardTitle.trim(),
        description: cardDesc.trim() || null,
      };

      if (editingCard) {
        await updateCard(editingCard.id, input);
      } else if (activeSprintId) {
        await createCard(activeSprintId, input);
      }

      setIsCardModalOpen(false);
      await fetchSprints();
    } catch (err: any) {
      alert(err.message || 'Failed to save card');
    }
  };

  const handleDeleteCard = async (id: number, title: string) => {
    if (!confirm(`Delete card "${title}"?`)) return;
    try {
      await deleteCard(id);
      await fetchSprints();
    } catch (err: any) {
      alert(err.message || 'Failed to delete card');
    }
  };

  const toggleSprintExpanded = (id: number) => {
    setExpandedSprints((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--foreground)', letterSpacing: '-0.025em', margin: '0 0 0.25rem 0' }}>
            Sprint Setup & Cards
          </h1>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>
            Plan sprint cycles and organize task groups with Jira-style cards
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => handleOpenSprintModal()}
        >
          <Plus size={16} />
          <span>New Sprint</span>
        </button>
      </div>

      {/* Sprints List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted-foreground)', fontSize: '0.875rem' }}>
          Loading sprints...
        </div>
      ) : sprints.length === 0 ? (
        <div
          className="card"
          style={{
            padding: '3rem',
            textAlign: 'center',
            color: 'var(--muted-foreground)',
            fontSize: '0.875rem',
          }}
        >
          No sprints created yet. Click "New Sprint" to start your first sprint cycle.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {sprints.map((sprint) => {
            const cards = sprintCards[sprint.id] || [];
            const isExpanded = expandedSprints[sprint.id] !== false;

            return (
              <div key={sprint.id} className="card" style={{ overflow: 'hidden' }}>
                {/* Sprint Header */}
                <div
                  style={{
                    padding: '1rem 1.25rem',
                    backgroundColor: 'var(--card)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: isExpanded ? '1px solid var(--border)' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                    <button
                      type="button"
                      className="btn-ghost btn-icon-sm"
                      onClick={() => toggleSprintExpanded(sprint.id)}
                    >
                      {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>
                    <div>
                      <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--foreground)', letterSpacing: '-0.01em' }}>
                        {sprint.name}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '0.125rem' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Calendar size={12} />
                          {sprint.start_date} to {sprint.end_date}
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Clock size={12} />
                          {sprint.duration_days} days
                        </span>
                        <span>{cards.length} {cards.length === 1 ? 'card' : 'cards'}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => handleOpenCardModal(sprint.id)}
                    >
                      <Plus size={13} />
                      <span>Add Card</span>
                    </button>

                    <button
                      type="button"
                      className="btn-ghost btn-icon-sm"
                      onClick={() => handleOpenSprintModal(sprint)}
                      title="Edit sprint"
                    >
                      <Edit2 size={14} />
                    </button>

                    <button
                      type="button"
                      className="btn-ghost btn-icon-sm"
                      onClick={() => handleDeleteSprint(sprint.id, sprint.name)}
                      title="Delete sprint"
                      style={{ color: '#ef4444' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Cards Grid */}
                {isExpanded && (
                  <div style={{ padding: '1rem 1.25rem', backgroundColor: 'var(--background)' }}>
                    {cards.length === 0 ? (
                      <div style={{ fontSize: '0.8125rem', color: 'var(--muted-foreground)', fontStyle: 'italic', textAlign: 'center', padding: '0.75rem' }}>
                        No cards in this sprint yet. Cards are optional groupings for related tasks (e.g. Jira epics/stories).
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.75rem' }}>
                        {cards.map((card) => (
                          <div
                            key={card.id}
                            className="card"
                            style={{
                              backgroundColor: 'var(--card)',
                              padding: '0.875rem 1rem',
                              borderRadius: '0.5rem',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontWeight: 600, fontSize: '0.875rem', color: 'var(--foreground)' }}>
                                <Tag size={13} style={{ color: '#6366f1' }} />
                                <span>{card.title}</span>
                              </div>
                              <div style={{ display: 'flex', gap: '0.25rem' }}>
                                <button
                                  type="button"
                                  className="btn-ghost btn-icon-sm"
                                  onClick={() => handleOpenCardModal(sprint.id, card)}
                                  style={{ width: '1.5rem', height: '1.5rem' }}
                                >
                                  <Edit2 size={12} />
                                </button>
                                <button
                                  type="button"
                                  className="btn-ghost btn-icon-sm"
                                  onClick={() => handleDeleteCard(card.id, card.title)}
                                  style={{ width: '1.5rem', height: '1.5rem', color: '#ef4444' }}
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                            {card.description && (
                              <p style={{ margin: '0.375rem 0 0 0', fontSize: '0.75rem', color: 'var(--muted-foreground)', lineHeight: 1.4 }}>
                                {card.description}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Sprint Modal */}
      {isSprintModalOpen && (
        <div className="dialog-overlay" onClick={() => setIsSprintModalOpen(false)}>
          <div className="dialog-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.125rem', fontWeight: 600, color: 'var(--foreground)', letterSpacing: '-0.02em' }}>
                  {editingSprint ? 'Edit Sprint' : 'Create Sprint'}
                </h3>
                <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}>
                  Define the sprint window using duration or date range.
                </p>
              </div>
              <button
                type="button"
                className="btn-ghost btn-icon-sm"
                onClick={() => setIsSprintModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveSprint}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: 'var(--foreground)', marginBottom: '0.375rem' }}>
                  Sprint Name
                </label>
                <input
                  type="text"
                  required
                  className="input"
                  value={sprintName}
                  onChange={(e) => setSprintName(e.target.value)}
                />
              </div>

              {/* Entry mode toggle (tabs style) */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: 'var(--foreground)', marginBottom: '0.375rem' }}>
                  Calculation Mode
                </label>
                <div className="tabs-list" style={{ width: '100%', height: '2.25rem' }}>
                  <button
                    type="button"
                    className={`tabs-trigger ${entryMode === 'duration' ? 'tabs-trigger-active' : ''}`}
                    style={{ flex: 1 }}
                    onClick={() => setEntryMode('duration')}
                  >
                    Start date + Duration (days)
                  </button>
                  <button
                    type="button"
                    className={`tabs-trigger ${entryMode === 'dates' ? 'tabs-trigger-active' : ''}`}
                    style={{ flex: 1 }}
                    onClick={() => setEntryMode('dates')}
                  >
                    Start date + End date
                  </button>
                </div>
              </div>

              {/* Start Date */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: 'var(--foreground)', marginBottom: '0.375rem' }}>
                  Start Date
                </label>
                <input
                  type="date"
                  required
                  className="input"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              {entryMode === 'duration' ? (
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: 'var(--foreground)', marginBottom: '0.375rem' }}>
                    Duration (Days) → End date: <span style={{ fontWeight: 600 }}>{endDate}</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    required
                    className="input"
                    value={durationDays}
                    onChange={(e) => setDurationDays(Number(e.target.value))}
                  />
                </div>
              ) : (
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: 'var(--foreground)', marginBottom: '0.375rem' }}>
                    End Date (Duration: <span style={{ fontWeight: 600 }}>{durationDays} days</span>)
                  </label>
                  <input
                    type="date"
                    required
                    min={startDate}
                    className="input"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setIsSprintModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                >
                  Save Sprint
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Card Modal */}
      {isCardModalOpen && (
        <div className="dialog-overlay" onClick={() => setIsCardModalOpen(false)}>
          <div className="dialog-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.125rem', fontWeight: 600, color: 'var(--foreground)', letterSpacing: '-0.02em' }}>
                  {editingCard ? 'Edit Card' : 'Add Card to Sprint'}
                </h3>
                <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}>
                  Cards group related tasks together within a sprint.
                </p>
              </div>
              <button
                type="button"
                className="btn-ghost btn-icon-sm"
                onClick={() => setIsCardModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveCard}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: 'var(--foreground)', marginBottom: '0.375rem' }}>
                  Card Title
                </label>
                <input
                  type="text"
                  required
                  className="input"
                  placeholder="e.g. Authentication & Sessions"
                  value={cardTitle}
                  onChange={(e) => setCardTitle(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: 'var(--foreground)', marginBottom: '0.375rem' }}>
                  Description <span style={{ color: 'var(--muted-foreground)', fontWeight: 400 }}>(Optional)</span>
                </label>
                <textarea
                  rows={3}
                  className="textarea"
                  placeholder="Card goals or scope..."
                  value={cardDesc}
                  onChange={(e) => setCardDesc(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setIsCardModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                >
                  Save Card
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
