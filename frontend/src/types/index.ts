export type TaskStatus = 'not_started' | 'in_progress' | 'blocked' | 'done';

export interface Sprint {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  duration_days: number;
  created_at: string;
}

export interface SprintInput {
  name: string;
  start_date: string;
  end_date?: string;
  duration_days?: number;
}

export interface Card {
  id: number;
  sprint_id: number | null;
  title: string;
  description: string | null;
  created_at: string;
}

export interface CardInput {
  sprint_id?: number | null;
  title: string;
  description?: string | null;
}

export interface Comment {
  id: number;
  task_id: number;
  body: string;
  created_at: string;
}

export interface Attachment {
  id: number;
  task_id: number;
  file_path: string;
  file_type: 'image' | 'video';
  original_filename: string;
  created_at: string;
}

export interface Task {
  id: number;
  card_id: number | null;
  sprint_id: number | null;
  parent_task_id: number | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  is_adhoc: boolean;
  is_tech_task: boolean;
  is_deferred: boolean;
  assigned_date: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;

  // Enriched fields from API
  card_title?: string;
  sprint_name?: string;
  subtasks?: Task[];
  comments?: Comment[];
  attachments?: Attachment[];
}

export interface TaskInput {
  card_id?: number | null;
  sprint_id?: number | null;
  parent_task_id?: number | null;
  title: string;
  description?: string | null;
  status?: TaskStatus;
  is_adhoc?: boolean;
  is_tech_task?: boolean;
  is_deferred?: boolean;
  assigned_date?: string;
}

export interface TaskFilter {
  date?: string;
  sprint_id?: number;
  card_id?: number;
  status?: TaskStatus | '';
  deferred?: boolean;
  adhoc?: boolean;
  tech?: boolean;
  today?: boolean;
  include_done?: boolean;
  top_level_only?: boolean;
}

export interface BurndownPoint {
  date: string;
  remaining: number;
  ideal_burndown: number;
}

export interface DailyCompletion {
  date: string;
  count: number;
}

export interface StatusBreakdown {
  status: TaskStatus;
  count: number;
}

export interface HeatmapPoint {
  day: string; // YYYY-MM-DD
  value: number;
}

export interface SprintVelocity {
  sprint_id: number;
  sprint_name: string;
  completed_count: number;
  total_count: number;
}

export interface WorkTypeSplit {
  type: string;
  count: number;
}

export interface BlockedTaskInfo {
  task_id: number;
  title: string;
  assigned_date: string;
  last_comment?: string;
  last_comment_at?: string;
}
