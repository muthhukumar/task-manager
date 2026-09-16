package models

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

type TaskStatus string

const (
	StatusNotStarted TaskStatus = "not_started"
	StatusInProgress TaskStatus = "in_progress"
	StatusBlocked    TaskStatus = "blocked"
	StatusDone       TaskStatus = "done"
)

type Task struct {
	ID           int64      `json:"id"`
	CardID       *int64     `json:"card_id"`
	SprintID     *int64     `json:"sprint_id"`
	ParentTaskID *int64     `json:"parent_task_id"`
	Title        string     `json:"title"`
	Description  *string    `json:"description"`
	Status       TaskStatus `json:"status"`
	IsAdhoc      bool       `json:"is_adhoc"`
	IsTechTask   bool       `json:"is_tech_task"`
	IsDeferred   bool       `json:"is_deferred"`
	AssignedDate string     `json:"assigned_date"`
	StartedAt    *time.Time `json:"started_at"`
	CompletedAt  *time.Time `json:"completed_at"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`

	// Enriched fields
	CardTitle   *string      `json:"card_title,omitempty"`
	SprintName  *string      `json:"sprint_name,omitempty"`
	Subtasks    []Task       `json:"subtasks,omitempty"`
	Comments    []Comment    `json:"comments,omitempty"`
	Attachments []Attachment `json:"attachments,omitempty"`
}

type TaskInput struct {
	CardID       *int64     `json:"card_id"`
	SprintID     *int64     `json:"sprint_id"`
	ParentTaskID *int64     `json:"parent_task_id"`
	Title        string     `json:"title"`
	Description  *string    `json:"description"`
	Status       TaskStatus `json:"status"`
	IsAdhoc      bool       `json:"is_adhoc"`
	IsTechTask   bool       `json:"is_tech_task"`
	IsDeferred   bool       `json:"is_deferred"`
	AssignedDate string     `json:"assigned_date"`
}

type TaskFilter struct {
	Date         string
	SprintID     *int64
	CardID       *int64
	Status       string
	IsDeferred   *bool
	IsAdhoc      *bool
	IsTechTask   *bool
	ParentTaskID *int64
	IncludeDone  *bool
	TopLevelOnly bool
}

func parseTimePtr(s *string) *time.Time {
	if s == nil || *s == "" {
		return nil
	}
	t, err := time.Parse("2006-01-02 15:04:05", *s)
	if err != nil {
		t, err = time.Parse(time.RFC3339, *s)
		if err != nil {
			return nil
		}
	}
	return &t
}

func scanTaskRow(row interface {
	Scan(dest ...any) error
}) (*Task, error) {
	var t Task
	var cardID, sprintID, parentTaskID sql.NullInt64
	var description, cardTitle, sprintName sql.NullString
	var statusStr string
	var isAdhoc, isTechTask, isDeferred int
	var startedAtStr, completedAtStr sql.NullString
	var createdAtStr, updatedAtStr string

	err := row.Scan(
		&t.ID,
		&cardID,
		&sprintID,
		&parentTaskID,
		&t.Title,
		&description,
		&statusStr,
		&isAdhoc,
		&isTechTask,
		&isDeferred,
		&t.AssignedDate,
		&startedAtStr,
		&completedAtStr,
		&createdAtStr,
		&updatedAtStr,
		&cardTitle,
		&sprintName,
	)
	if err != nil {
		return nil, err
	}

	if cardID.Valid {
		t.CardID = &cardID.Int64
	}
	if sprintID.Valid {
		t.SprintID = &sprintID.Int64
	}
	if parentTaskID.Valid {
		t.ParentTaskID = &parentTaskID.Int64
	}
	if description.Valid {
		t.Description = &description.String
	}
	if cardTitle.Valid {
		t.CardTitle = &cardTitle.String
	}
	if sprintName.Valid {
		t.SprintName = &sprintName.String
	}

	t.Status = TaskStatus(statusStr)
	t.IsAdhoc = isAdhoc == 1
	t.IsTechTask = isTechTask == 1
	t.IsDeferred = isDeferred == 1

	if startedAtStr.Valid {
		t.StartedAt = parseTimePtr(&startedAtStr.String)
	}
	if completedAtStr.Valid {
		t.CompletedAt = parseTimePtr(&completedAtStr.String)
	}

	createdAt := parseTimePtr(&createdAtStr)
	if createdAt != nil {
		t.CreatedAt = *createdAt
	}
	updatedAt := parseTimePtr(&updatedAtStr)
	if updatedAt != nil {
		t.UpdatedAt = *updatedAt
	}

	return &t, nil
}

const baseTaskSelect = `
	SELECT 
		t.id, t.card_id, t.sprint_id, t.parent_task_id, t.title, t.description,
		t.status, t.is_adhoc, t.is_tech_task, t.is_deferred, t.assigned_date,
		t.started_at, t.completed_at, t.created_at, t.updated_at,
		c.title AS card_title,
		s.name AS sprint_name
	FROM tasks t
	LEFT JOIN cards c ON t.card_id = c.id
	LEFT JOIN sprints s ON t.sprint_id = s.id
`

func CreateTask(db *sql.DB, input TaskInput) (*Task, error) {
	if input.Title == "" {
		return nil, fmt.Errorf("title is required")
	}
	if input.AssignedDate == "" {
		input.AssignedDate = time.Now().Format("2006-01-02")
	}
	if input.Status == "" {
		input.Status = StatusNotStarted
	}

	// Validate status
	switch input.Status {
	case StatusNotStarted, StatusInProgress, StatusBlocked, StatusDone:
	default:
		return nil, fmt.Errorf("invalid status: %s", input.Status)
	}

	// Prevent multi-level nesting
	if input.ParentTaskID != nil {
		parent, err := GetTaskByID(db, *input.ParentTaskID)
		if err != nil {
			return nil, err
		}
		if parent == nil {
			return nil, fmt.Errorf("parent task does not exist")
		}
		if parent.ParentTaskID != nil {
			return nil, fmt.Errorf("cannot nest subtasks deeper than one level")
		}
		// If task has parent, inherit sprint/card if omitted
		if input.SprintID == nil {
			input.SprintID = parent.SprintID
		}
		if input.CardID == nil {
			input.CardID = parent.CardID
		}
	}

	var startedAt *string
	var completedAt *string
	nowStr := time.Now().Format("2006-01-02 15:04:05")

	if input.Status != StatusNotStarted {
		startedAt = &nowStr
	}
	if input.Status == StatusDone {
		completedAt = &nowStr
	}

	query := `
		INSERT INTO tasks (
			card_id, sprint_id, parent_task_id, title, description,
			status, is_adhoc, is_tech_task, is_deferred, assigned_date,
			started_at, completed_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	res, err := db.Exec(
		query,
		input.CardID,
		input.SprintID,
		input.ParentTaskID,
		input.Title,
		input.Description,
		string(input.Status),
		boolToInt(input.IsAdhoc),
		boolToInt(input.IsTechTask),
		boolToInt(input.IsDeferred),
		input.AssignedDate,
		startedAt,
		completedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create task: %w", err)
	}

	id, err := res.LastInsertId()
	if err != nil {
		return nil, err
	}

	return GetTaskByID(db, id)
}

func GetTaskByID(db *sql.DB, id int64) (*Task, error) {
	query := baseTaskSelect + ` WHERE t.id = ?`
	row := db.QueryRow(query, id)
	task, err := scanTaskRow(row)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	// Fetch subtasks
	subtasks, err := GetSubtasks(db, task.ID)
	if err != nil {
		return nil, err
	}
	task.Subtasks = subtasks

	// Fetch comments
	comments, err := GetCommentsByTaskID(db, task.ID)
	if err != nil {
		return nil, err
	}
	task.Comments = comments

	// Fetch attachments
	attachments, err := GetAttachmentsByTaskID(db, task.ID)
	if err != nil {
		return nil, err
	}
	task.Attachments = attachments

	return task, nil
}

func GetSubtasks(db *sql.DB, parentID int64) ([]Task, error) {
	query := baseTaskSelect + ` WHERE t.parent_task_id = ? ORDER BY t.id ASC`
	rows, err := db.Query(query, parentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	subtasks := make([]Task, 0)
	for rows.Next() {
		subtask, err := scanTaskRow(rows)
		if err != nil {
			return nil, err
		}
		subtasks = append(subtasks, *subtask)
	}
	rows.Close()

	for i := range subtasks {
		if comments, err := GetCommentsByTaskID(db, subtasks[i].ID); err == nil {
			subtasks[i].Comments = comments
		}
		if attachments, err := GetAttachmentsByTaskID(db, subtasks[i].ID); err == nil {
			subtasks[i].Attachments = attachments
		}
	}

	return subtasks, nil
}

// GetTodayTasks implements §3.3 carry-over logic:
// SELECT * FROM tasks WHERE status != 'done' AND is_deferred = 0 AND assigned_date <= DATE('now')
func GetTodayTasks(db *sql.DB, targetDate string) ([]Task, error) {
	if targetDate == "" {
		targetDate = time.Now().Format("2006-01-02")
	}

	query := baseTaskSelect + `
		WHERE t.status != 'done'
		  AND t.is_deferred = 0
		  AND t.assigned_date <= ?
		  AND t.parent_task_id IS NULL
		ORDER BY 
			CASE t.status
				WHEN 'in_progress' THEN 1
				WHEN 'blocked' THEN 2
				WHEN 'not_started' THEN 3
				ELSE 4
			END,
			t.assigned_date ASC,
			t.id ASC
	`
	rows, err := db.Query(query, targetDate)
	if err != nil {
		return nil, err
	}

	tasks := make([]Task, 0)
	for rows.Next() {
		task, err := scanTaskRow(rows)
		if err != nil {
			rows.Close()
			return nil, err
		}
		tasks = append(tasks, *task)
	}
	rows.Close()

	// Populate subtasks, comments, attachments after closing outer cursor
	for i := range tasks {
		if subtasks, err := GetSubtasks(db, tasks[i].ID); err == nil {
			tasks[i].Subtasks = subtasks
		}
		if comments, err := GetCommentsByTaskID(db, tasks[i].ID); err == nil {
			tasks[i].Comments = comments
		}
		if attachments, err := GetAttachmentsByTaskID(db, tasks[i].ID); err == nil {
			tasks[i].Attachments = attachments
		}
	}

	return tasks, nil
}

func GetTasks(db *sql.DB, filter TaskFilter) ([]Task, error) {
	var whereClauses []string
	var args []any

	if filter.TopLevelOnly {
		whereClauses = append(whereClauses, "t.parent_task_id IS NULL")
	} else if filter.ParentTaskID != nil {
		whereClauses = append(whereClauses, "t.parent_task_id = ?")
		args = append(args, *filter.ParentTaskID)
	}

	if filter.Date != "" {
		whereClauses = append(whereClauses, "t.assigned_date = ?")
		args = append(args, filter.Date)
	}
	if filter.SprintID != nil {
		whereClauses = append(whereClauses, "t.sprint_id = ?")
		args = append(args, *filter.SprintID)
	}
	if filter.CardID != nil {
		whereClauses = append(whereClauses, "t.card_id = ?")
		args = append(args, *filter.CardID)
	}
	if filter.Status != "" {
		whereClauses = append(whereClauses, "t.status = ?")
		args = append(args, filter.Status)
	}
	if filter.IsDeferred != nil {
		whereClauses = append(whereClauses, "t.is_deferred = ?")
		args = append(args, boolToInt(*filter.IsDeferred))
	}
	if filter.IsAdhoc != nil {
		whereClauses = append(whereClauses, "t.is_adhoc = ?")
		args = append(args, boolToInt(*filter.IsAdhoc))
	}
	if filter.IsTechTask != nil {
		whereClauses = append(whereClauses, "t.is_tech_task = ?")
		args = append(args, boolToInt(*filter.IsTechTask))
	}
	if filter.IncludeDone != nil && !*filter.IncludeDone {
		whereClauses = append(whereClauses, "t.status != 'done'")
	}

	query := baseTaskSelect
	if len(whereClauses) > 0 {
		query += " WHERE " + strings.Join(whereClauses, " AND ")
	}
	query += " ORDER BY t.assigned_date DESC, t.id DESC"

	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, err
	}

	tasks := make([]Task, 0)
	for rows.Next() {
		task, err := scanTaskRow(rows)
		if err != nil {
			rows.Close()
			return nil, err
		}
		tasks = append(tasks, *task)
	}
	rows.Close()

	// Populate subtasks, comments, attachments after closing outer cursor
	for i := range tasks {
		if filter.TopLevelOnly || tasks[i].ParentTaskID == nil {
			if subtasks, err := GetSubtasks(db, tasks[i].ID); err == nil {
				tasks[i].Subtasks = subtasks
			}
		}
		if comments, err := GetCommentsByTaskID(db, tasks[i].ID); err == nil {
			tasks[i].Comments = comments
		}
		if attachments, err := GetAttachmentsByTaskID(db, tasks[i].ID); err == nil {
			tasks[i].Attachments = attachments
		}
	}

	return tasks, nil
}

func UpdateTask(db *sql.DB, id int64, input TaskInput) (*Task, error) {
	current, err := GetTaskByID(db, id)
	if err != nil {
		return nil, err
	}
	if current == nil {
		return nil, sql.ErrNoRows
	}

	if input.Title != "" {
		current.Title = input.Title
	}
	if input.AssignedDate != "" {
		current.AssignedDate = input.AssignedDate
	}
	if input.Description != nil {
		current.Description = input.Description
	}
	if input.CardID != nil {
		current.CardID = input.CardID
	}
	if input.SprintID != nil {
		current.SprintID = input.SprintID
	}
	if input.ParentTaskID != nil {
		current.ParentTaskID = input.ParentTaskID
	}
	if input.IsAdhoc {
		current.IsAdhoc = true
	}
	if input.IsTechTask {
		current.IsTechTask = true
	}
	if input.IsDeferred {
		current.IsDeferred = true
	}

	startedAt := current.StartedAt
	completedAt := current.CompletedAt

	if input.Status != "" {
		if current.Status == StatusNotStarted && input.Status != StatusNotStarted && startedAt == nil {
			now := time.Now()
			startedAt = &now
		}
		if input.Status == StatusDone && completedAt == nil {
			now := time.Now()
			completedAt = &now
		} else if input.Status != StatusDone && completedAt != nil {
			completedAt = nil
		}
		current.Status = input.Status
	}

	var startedAtStr, completedAtStr *string
	if startedAt != nil {
		s := startedAt.Format("2006-01-02 15:04:05")
		startedAtStr = &s
	}
	if completedAt != nil {
		s := completedAt.Format("2006-01-02 15:04:05")
		completedAtStr = &s
	}

	query := `
		UPDATE tasks SET
			card_id = ?,
			sprint_id = ?,
			parent_task_id = ?,
			title = ?,
			description = ?,
			status = ?,
			is_adhoc = ?,
			is_tech_task = ?,
			is_deferred = ?,
			assigned_date = ?,
			started_at = ?,
			completed_at = ?,
			updated_at = CURRENT_TIMESTAMP
		WHERE id = ?
	`
	res, err := db.Exec(
		query,
		current.CardID,
		current.SprintID,
		current.ParentTaskID,
		current.Title,
		current.Description,
		string(current.Status),
		boolToInt(current.IsAdhoc),
		boolToInt(current.IsTechTask),
		boolToInt(current.IsDeferred),
		current.AssignedDate,
		startedAtStr,
		completedAtStr,
		id,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update task: %w", err)
	}

	affected, err := res.RowsAffected()
	if err != nil {
		return nil, err
	}
	if affected == 0 {
		return nil, sql.ErrNoRows
	}

	return GetTaskByID(db, id)
}

func UpdateTaskJSON(db *sql.DB, id int64, body []byte) (*Task, error) {
	current, err := GetTaskByID(db, id)
	if err != nil {
		return nil, err
	}
	if current == nil {
		return nil, sql.ErrNoRows
	}

	var raw map[string]json.RawMessage
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, fmt.Errorf("invalid json: %w", err)
	}

	if val, ok := raw["title"]; ok {
		var s string
		if err := json.Unmarshal(val, &s); err == nil && s != "" {
			current.Title = s
		}
	}

	if val, ok := raw["description"]; ok {
		var s *string
		if err := json.Unmarshal(val, &s); err == nil {
			current.Description = s
		}
	}

	if val, ok := raw["assigned_date"]; ok {
		var s string
		if err := json.Unmarshal(val, &s); err == nil && s != "" {
			current.AssignedDate = s
		}
	}

	if val, ok := raw["card_id"]; ok {
		var cid *int64
		if err := json.Unmarshal(val, &cid); err == nil {
			current.CardID = cid
		}
	}

	if val, ok := raw["sprint_id"]; ok {
		var sid *int64
		if err := json.Unmarshal(val, &sid); err == nil {
			current.SprintID = sid
		}
	}

	if val, ok := raw["parent_task_id"]; ok {
		var pid *int64
		if err := json.Unmarshal(val, &pid); err == nil {
			if pid != nil {
				parent, err := GetTaskByID(db, *pid)
				if err != nil {
					return nil, err
				}
				if parent == nil {
					return nil, fmt.Errorf("parent task does not exist")
				}
				if parent.ParentTaskID != nil {
					return nil, fmt.Errorf("cannot nest subtasks deeper than one level")
				}
			}
			current.ParentTaskID = pid
		}
	}

	if val, ok := raw["is_adhoc"]; ok {
		var b bool
		if err := json.Unmarshal(val, &b); err == nil {
			current.IsAdhoc = b
		}
	}

	if val, ok := raw["is_tech_task"]; ok {
		var b bool
		if err := json.Unmarshal(val, &b); err == nil {
			current.IsTechTask = b
		}
	}

	if val, ok := raw["is_deferred"]; ok {
		var b bool
		if err := json.Unmarshal(val, &b); err == nil {
			current.IsDeferred = b
		}
	}

	startedAt := current.StartedAt
	completedAt := current.CompletedAt

	if val, ok := raw["status"]; ok {
		var newStatus TaskStatus
		if err := json.Unmarshal(val, &newStatus); err == nil && newStatus != "" {
			if current.Status == StatusNotStarted && newStatus != StatusNotStarted && startedAt == nil {
				now := time.Now()
				startedAt = &now
			}
			if newStatus == StatusDone && completedAt == nil {
				now := time.Now()
				completedAt = &now
			} else if newStatus != StatusDone && completedAt != nil {
				completedAt = nil
			}
			current.Status = newStatus
		}
	}

	var startedAtStr, completedAtStr *string
	if startedAt != nil {
		s := startedAt.Format("2006-01-02 15:04:05")
		startedAtStr = &s
	}
	if completedAt != nil {
		s := completedAt.Format("2006-01-02 15:04:05")
		completedAtStr = &s
	}

	query := `
		UPDATE tasks SET
			card_id = ?,
			sprint_id = ?,
			parent_task_id = ?,
			title = ?,
			description = ?,
			status = ?,
			is_adhoc = ?,
			is_tech_task = ?,
			is_deferred = ?,
			assigned_date = ?,
			started_at = ?,
			completed_at = ?,
			updated_at = CURRENT_TIMESTAMP
		WHERE id = ?
	`
	res, err := db.Exec(
		query,
		current.CardID,
		current.SprintID,
		current.ParentTaskID,
		current.Title,
		current.Description,
		string(current.Status),
		boolToInt(current.IsAdhoc),
		boolToInt(current.IsTechTask),
		boolToInt(current.IsDeferred),
		current.AssignedDate,
		startedAtStr,
		completedAtStr,
		id,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update task: %w", err)
	}

	affected, err := res.RowsAffected()
	if err != nil {
		return nil, err
	}
	if affected == 0 {
		return nil, sql.ErrNoRows
	}

	return GetTaskByID(db, id)
}

func DeleteTask(db *sql.DB, id int64) error {
	query := `DELETE FROM tasks WHERE id = ?`
	res, err := db.Exec(query, id)
	if err != nil {
		return err
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}
