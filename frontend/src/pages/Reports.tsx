import React, { useEffect, useState } from 'react';
import { ResponsiveLine } from '@nivo/line';
import { ResponsiveBar } from '@nivo/bar';
import { ResponsivePie } from '@nivo/pie';
import { ResponsiveCalendar } from '@nivo/calendar';
import type {
  BurndownPoint,
  DailyCompletion,
  HeatmapPoint,
  Sprint,
  SprintVelocity,
  StatusBreakdown,
} from '../types';
import {
  getBurndown,
  getDailyCompletions,
  getCompletionHeatmap,
  getSprints,
  getSprintVelocity,
  getStatusBreakdown,
} from '../api/client';
import { TrendingDown, CheckSquare, PieChart, Calendar, Award } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export const Reports: React.FC = () => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [selectedSprintId, setSelectedSprintId] = useState<number | null>(null);

  // Chart data states
  const [burndown, setBurndown] = useState<BurndownPoint[]>([]);
  const [completions, setCompletions] = useState<DailyCompletion[]>([]);
  const [statusBreakdown, setStatusBreakdown] = useState<StatusBreakdown[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapPoint[]>([]);
  const [velocity, setVelocity] = useState<SprintVelocity[]>([]);
  const [completionDays, setCompletionDays] = useState<number>(14);

  useEffect(() => {
    getSprints().then((s) => {
      setSprints(s);
      if (s.length > 0) {
        setSelectedSprintId(s[0].id);
      }
    });

    getStatusBreakdown().then(setStatusBreakdown).catch(console.error);
    getCompletionHeatmap().then(setHeatmap).catch(console.error);
    getSprintVelocity().then(setVelocity).catch(console.error);
  }, []);

  useEffect(() => {
    if (selectedSprintId) {
      getBurndown(selectedSprintId).then(setBurndown).catch(console.error);
    }
  }, [selectedSprintId]);

  useEffect(() => {
    getDailyCompletions(completionDays).then(setCompletions).catch(console.error);
  }, [completionDays]);

  // Format burndown data for Nivo Line
  const burndownLineData = [
    {
      id: 'Ideal Burndown',
      color: '#94a3b8',
      data: burndown.map((p) => ({
        x: p.date.slice(5),
        y: Math.round(p.ideal_burndown * 10) / 10,
      })),
    },
    {
      id: 'Actual Remaining',
      color: '#2563eb',
      data: burndown
        .filter((p) => p.remaining >= 0)
        .map((p) => ({
          x: p.date.slice(5),
          y: p.remaining,
        })),
    },
  ];

  // Format status data for Nivo Pie
  const statusPieData = statusBreakdown.map((s) => {
    const labels: Record<string, { label: string; color: string }> = {
      not_started: { label: 'Not Started', color: '#94a3b8' },
      in_progress: { label: 'In Progress', color: '#3b82f6' },
      blocked: { label: 'Blocked', color: '#ef4444' },
      done: { label: 'Done', color: '#22c55e' },
    };
    const info = labels[s.status] || { label: s.status, color: '#64748b' };
    return {
      id: info.label,
      label: info.label,
      value: s.count,
      color: info.color,
    };
  });

  // Format daily completions for Nivo Bar
  const completionsBarData = completions.map((c) => ({
    date: c.date.slice(5),
    completed: c.count,
  }));

  const today = new Date();
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(today.getFullYear() - 1);

  const nivoTheme = {
    text: {
      fill: isDark ? '#a1a1aa' : '#52525b',
      fontSize: 11,
    },
    axis: {
      ticks: {
        text: {
          fill: isDark ? '#a1a1aa' : '#71717a',
          fontSize: 10,
        },
        line: {
          stroke: isDark ? '#27272a' : '#e4e4e7',
        },
      },
      domain: {
        line: {
          stroke: isDark ? '#27272a' : '#e4e4e7',
        },
      },
    },
    grid: {
      line: {
        stroke: isDark ? '#27272a' : '#f4f4f5',
        strokeWidth: 1,
      },
    },
    legends: {
      text: {
        fill: isDark ? '#fafafa' : '#18181b',
        fontSize: 11,
      },
    },
    tooltip: {
      container: {
        background: isDark ? '#18181b' : '#ffffff',
        color: isDark ? '#fafafa' : '#09090b',
        border: `1px solid ${isDark ? '#27272a' : '#e4e4e7'}`,
        borderRadius: '6px',
        fontSize: '12px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
      },
    },
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--foreground)', letterSpacing: '-0.025em', margin: '0 0 0.25rem 0' }}>
          Reports & Performance
        </h1>
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>
          Sprint burndown, completion trends, status distributions, and velocity metrics
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '1.5rem' }}>
        {/* Chart 1: Sprint Burndown */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--foreground)', letterSpacing: '-0.01em' }}>
              <TrendingDown size={18} style={{ color: 'var(--foreground)' }} />
              <span>Sprint Burndown</span>
            </div>

            {sprints.length > 0 && (
              <select
                className="select"
                value={selectedSprintId ?? ''}
                onChange={(e) => setSelectedSprintId(Number(e.target.value))}
                style={{ padding: '0.25rem 0.625rem', fontSize: '0.8125rem' }}
              >
                {sprints.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div style={{ height: '280px' }}>
            {burndown.length > 0 ? (
              <ResponsiveLine
                data={burndownLineData}
                theme={nivoTheme}
                margin={{ top: 20, right: 20, bottom: 40, left: 40 }}
                xScale={{ type: 'point' }}
                yScale={{ type: 'linear', min: 'auto', max: 'auto', stacked: false }}
                axisTop={null}
                axisRight={null}
                axisBottom={{ tickSize: 5, tickPadding: 5, tickRotation: -30 }}
                axisLeft={{ tickSize: 5, tickPadding: 5, tickRotation: 0 }}
                pointSize={6}
                pointBorderWidth={2}
                pointBorderColor={{ from: 'serieColor' }}
                useMesh={true}
                colors={isDark ? ['#71717a', '#60a5fa'] : ['#a1a1aa', '#18181b']}
                legends={[
                  {
                    anchor: 'top-right',
                    direction: 'row',
                    justify: false,
                    translateX: 0,
                    translateY: -15,
                    itemsSpacing: 0,
                    itemDirection: 'left-to-right',
                    itemWidth: 120,
                    itemHeight: 20,
                    symbolSize: 10,
                    symbolShape: 'circle',
                  },
                ]}
              />
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', fontSize: '0.875rem' }}>
                No sprint data available.
              </div>
            )}
          </div>
        </div>

        {/* Chart 2: Daily Completions */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--foreground)', letterSpacing: '-0.01em' }}>
              <CheckSquare size={18} style={{ color: '#16a34a' }} />
              <span>Daily Completions</span>
            </div>

            <div style={{ display: 'flex', gap: '0.25rem' }}>
              <button
                type="button"
                onClick={() => setCompletionDays(14)}
                className={`btn btn-sm ${completionDays === 14 ? 'btn-primary' : 'btn-outline'}`}
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
              >
                14d
              </button>
              <button
                type="button"
                onClick={() => setCompletionDays(30)}
                className={`btn btn-sm ${completionDays === 30 ? 'btn-primary' : 'btn-outline'}`}
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
              >
                30d
              </button>
            </div>
          </div>

          <div style={{ height: '280px' }}>
            {completions.length > 0 ? (
              <ResponsiveBar
                data={completionsBarData}
                theme={nivoTheme}
                keys={['completed']}
                indexBy="date"
                margin={{ top: 20, right: 20, bottom: 40, left: 40 }}
                padding={0.3}
                colors={[isDark ? '#3b82f6' : '#18181b']}
                axisTop={null}
                axisRight={null}
                axisBottom={{ tickSize: 5, tickPadding: 5, tickRotation: -30 }}
                axisLeft={{ tickSize: 5, tickPadding: 5, tickRotation: 0 }}
                labelSkipHeight={12}
                borderRadius={3}
              />
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', fontSize: '0.875rem' }}>
                No completion data yet.
              </div>
            )}
          </div>
        </div>

        {/* Chart 3: Status Breakdown */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--foreground)', letterSpacing: '-0.01em', marginBottom: '1rem' }}>
            <PieChart size={18} style={{ color: 'var(--muted-foreground)' }} />
            <span>Task Status Breakdown</span>
          </div>

          <div style={{ height: '280px' }}>
            {statusPieData.some((p) => p.value > 0) ? (
              <ResponsivePie
                data={statusPieData}
                theme={nivoTheme}
                margin={{ top: 20, right: 80, bottom: 20, left: 80 }}
                innerRadius={0.55}
                padAngle={1}
                cornerRadius={4}
                activeOuterRadiusOffset={6}
                colors={{ datum: 'data.color' }}
                arcLinkLabelsSkipAngle={10}
                arcLinkLabelsTextColor={isDark ? '#a1a1aa' : '#52525b'}
                arcLinkLabelsThickness={1}
                arcLinkLabelsColor={{ from: 'color' }}
                arcLabelsSkipAngle={10}
                arcLabelsTextColor="#ffffff"
              />
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', fontSize: '0.875rem' }}>
                No tasks available.
              </div>
            )}
          </div>
        </div>

        {/* Chart 4: Sprint Velocity */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--foreground)', letterSpacing: '-0.01em', marginBottom: '1rem' }}>
            <Award size={18} style={{ color: 'var(--muted-foreground)' }} />
            <span>Sprint Velocity (Completed Tasks)</span>
          </div>

          <div style={{ height: '280px' }}>
            {velocity.length > 0 ? (
              <ResponsiveBar
                data={velocity.map((v) => ({
                  sprint: v.sprint_name,
                  Completed: v.completed_count,
                  Remaining: v.total_count - v.completed_count,
                }))}
                theme={nivoTheme}
                keys={['Completed', 'Remaining']}
                indexBy="sprint"
                margin={{ top: 20, right: 110, bottom: 40, left: 40 }}
                padding={0.3}
                colors={isDark ? ['#3b82f6', '#27272a'] : ['#18181b', '#e4e4e7']}
                borderRadius={3}
                legends={[
                  {
                    dataFrom: 'keys',
                    anchor: 'top-right',
                    direction: 'column',
                    justify: false,
                    translateX: 90,
                    translateY: 0,
                    itemsSpacing: 4,
                    itemWidth: 80,
                    itemHeight: 20,
                    symbolSize: 10,
                  },
                ]}
              />
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', fontSize: '0.875rem' }}>
                No velocity data across sprints yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chart 5: GitHub-Style Calendar Completion Heatmap */}
      <div
        className="card"
        style={{
          marginTop: '1.5rem',
          padding: '1.25rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--foreground)', letterSpacing: '-0.01em', marginBottom: '1rem' }}>
          <Calendar size={18} style={{ color: 'var(--foreground)' }} />
          <span>Annual Activity Heatmap (Tasks Completed per Day)</span>
        </div>

        <div style={{ height: '200px', width: '100%', overflowX: 'auto' }}>
          <ResponsiveCalendar
            data={heatmap}
            theme={nivoTheme}
            from={oneYearAgo.toISOString().split('T')[0]}
            to={today.toISOString().split('T')[0]}
            emptyColor={isDark ? '#27272a' : '#f4f4f5'}
            colors={['#dcfce7', '#86efac', '#22c55e', '#15803d']}
            margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
            yearSpacing={40}
            monthBorderColor={isDark ? '#18181b' : '#ffffff'}
            dayBorderWidth={2}
            dayBorderColor={isDark ? '#18181b' : '#ffffff'}
          />
        </div>
      </div>
    </div>
  );
};
