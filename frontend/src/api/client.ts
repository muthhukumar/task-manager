import type {
  Attachment,
  BlockedTaskInfo,
  BurndownPoint,
  Card,
  CardInput,
  Comment,
  DailyCompletion,
  HeatmapPoint,
  Sprint,
  SprintInput,
  SprintVelocity,
  StatusBreakdown,
  Task,
  TaskFilter,
  TaskInput,
  WorkTypeSplit,
} from '../types';

const BASE_URL = '/api';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorMsg = `Request failed: ${res.status} ${res.statusText}`;
    try {
      const data = await res.json();
      if (data && data.error) {
        errorMsg = data.error;
      }
    } catch {
      // ignore JSON parse error
    }
    throw new Error(errorMsg);
  }
  return res.json();
}

// Sprints
export async function getSprints(): Promise<Sprint[]> {
  const res = await fetch(`${BASE_URL}/sprints`);
  return handleResponse<Sprint[]>(res);
}

export async function getSprint(id: number): Promise<Sprint> {
  const res = await fetch(`${BASE_URL}/sprints/${id}`);
  return handleResponse<Sprint>(res);
}

export async function createSprint(input: SprintInput): Promise<Sprint> {
  const res = await fetch(`${BASE_URL}/sprints`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return handleResponse<Sprint>(res);
}

export async function updateSprint(id: number, input: SprintInput): Promise<Sprint> {
  const res = await fetch(`${BASE_URL}/sprints/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return handleResponse<Sprint>(res);
}

export async function deleteSprint(id: number): Promise<void> {
  const res = await fetch(`${BASE_URL}/sprints/${id}`, { method: 'DELETE' });
  await handleResponse<{ message: string }>(res);
}

// Cards
export async function getCards(sprintId?: number): Promise<Card[]> {
  const url = sprintId !== undefined 
    ? `${BASE_URL}/sprints/${sprintId}/cards` 
    : `${BASE_URL}/cards`;
  const res = await fetch(url);
  return handleResponse<Card[]>(res);
}

export async function createCard(sprintId: number, input: CardInput): Promise<Card> {
  const res = await fetch(`${BASE_URL}/sprints/${sprintId}/cards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return handleResponse<Card>(res);
}

export async function updateCard(id: number, input: CardInput): Promise<Card> {
  const res = await fetch(`${BASE_URL}/cards/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return handleResponse<Card>(res);
}

export async function deleteCard(id: number): Promise<void> {
  const res = await fetch(`${BASE_URL}/cards/${id}`, { method: 'DELETE' });
  await handleResponse<{ message: string }>(res);
}

// Tasks
export async function getTasks(filter?: TaskFilter): Promise<Task[]> {
  const params = new URLSearchParams();
  if (filter) {
    if (filter.today) params.set('today', 'true');
    if (filter.date) params.set('date', filter.date);
    if (filter.sprint_id !== undefined) params.set('sprint_id', String(filter.sprint_id));
    if (filter.card_id !== undefined) params.set('card_id', String(filter.card_id));
    if (filter.status) params.set('status', filter.status);
    if (filter.deferred !== undefined) params.set('deferred', String(filter.deferred));
    if (filter.adhoc !== undefined) params.set('adhoc', String(filter.adhoc));
    if (filter.tech !== undefined) params.set('tech', String(filter.tech));
    if (filter.include_done !== undefined) params.set('include_done', String(filter.include_done));
    if (filter.top_level_only !== undefined) params.set('top_level_only', String(filter.top_level_only));
  }
  const query = params.toString();
  const url = query ? `${BASE_URL}/tasks?${query}` : `${BASE_URL}/tasks`;
  const res = await fetch(url);
  return handleResponse<Task[]>(res);
}

export async function getTodayTasks(date?: string): Promise<Task[]> {
  const params = new URLSearchParams({ today: 'true' });
  if (date) params.set('date', date);
  const res = await fetch(`${BASE_URL}/tasks?${params.toString()}`);
  return handleResponse<Task[]>(res);
}

export async function getTask(id: number): Promise<Task> {
  const res = await fetch(`${BASE_URL}/tasks/${id}`);
  return handleResponse<Task>(res);
}

export async function createTask(input: TaskInput): Promise<Task> {
  const res = await fetch(`${BASE_URL}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return handleResponse<Task>(res);
}

export async function updateTask(id: number, input: Partial<TaskInput>): Promise<Task> {
  const res = await fetch(`${BASE_URL}/tasks/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return handleResponse<Task>(res);
}

export async function deleteTask(id: number): Promise<void> {
  const res = await fetch(`${BASE_URL}/tasks/${id}`, { method: 'DELETE' });
  await handleResponse<{ message: string }>(res);
}

// Comments
export async function addComment(taskId: number, body: string): Promise<Comment> {
  const res = await fetch(`${BASE_URL}/tasks/${taskId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body }),
  });
  return handleResponse<Comment>(res);
}

export async function updateComment(commentId: number, body: string): Promise<Comment> {
  const res = await fetch(`${BASE_URL}/comments/${commentId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body }),
  });
  return handleResponse<Comment>(res);
}

export async function deleteComment(commentId: number): Promise<void> {
  const res = await fetch(`${BASE_URL}/comments/${commentId}`, { method: 'DELETE' });
  await handleResponse<{ message: string }>(res);
}


// Attachments
export async function uploadAttachment(taskId: number, file: File): Promise<Attachment> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${BASE_URL}/tasks/${taskId}/attachments`, {
    method: 'POST',
    body: formData,
  });
  return handleResponse<Attachment>(res);
}

export async function deleteAttachment(id: number): Promise<void> {
  const res = await fetch(`${BASE_URL}/attachments/${id}`, { method: 'DELETE' });
  await handleResponse<{ message: string }>(res);
}

export function getMediaUrl(filePath: string): string {
  return `${BASE_URL}/media/${filePath}`;
}

// Reports
export async function getBurndown(sprintId: number): Promise<BurndownPoint[]> {
  const res = await fetch(`${BASE_URL}/reports/burndown?sprint_id=${sprintId}`);
  return handleResponse<BurndownPoint[]>(res);
}

export async function getDailyCompletions(rangeDays: number = 30): Promise<DailyCompletion[]> {
  const res = await fetch(`${BASE_URL}/reports/completions?range=${rangeDays}`);
  return handleResponse<DailyCompletion[]>(res);
}

export async function getStatusBreakdown(): Promise<StatusBreakdown[]> {
  const res = await fetch(`${BASE_URL}/reports/status-breakdown`);
  return handleResponse<StatusBreakdown[]>(res);
}

export async function getCompletionHeatmap(): Promise<HeatmapPoint[]> {
  const res = await fetch(`${BASE_URL}/reports/heatmap`);
  return handleResponse<HeatmapPoint[]>(res);
}

export async function getSprintVelocity(): Promise<SprintVelocity[]> {
  const res = await fetch(`${BASE_URL}/reports/velocity`);
  return handleResponse<SprintVelocity[]>(res);
}

export async function getBlockedTasks(): Promise<BlockedTaskInfo[]> {
  const res = await fetch(`${BASE_URL}/reports/blocked-time`);
  return handleResponse<BlockedTaskInfo[]>(res);
}

export async function getWorkSplit(): Promise<WorkTypeSplit[]> {
  const res = await fetch(`${BASE_URL}/reports/work-split`);
  return handleResponse<WorkTypeSplit[]>(res);
}

// Backup & Restore
export function getBackupDownloadUrl(): string {
  return `${BASE_URL}/backup`;
}

export async function restoreBackup(file: File): Promise<{ message: string }> {
  const formData = new FormData();
  formData.append('backup', file);
  const res = await fetch(`${BASE_URL}/restore`, {
    method: 'POST',
    body: formData,
  });
  return handleResponse<{ message: string }>(res);
}
