package models_test

import (
	"database/sql"
	"os"
	"path/filepath"
	"testing"
	"time"

	"task-manager/backend/internal/database"
	"task-manager/backend/internal/models"
)

func setupTestDB(t *testing.T) (*sql.DB, func()) {
	tmpDir, err := os.MkdirTemp("", "task-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	dbPath := filepath.Join(tmpDir, "test.db")

	db, err := database.InitDB(dbPath)
	if err != nil {
		t.Fatalf("failed to init db: %v", err)
	}

	cleanup := func() {
		db.Close()
		os.RemoveAll(tmpDir)
	}

	return db, cleanup
}

func TestSprintDateCalculations(t *testing.T) {
	// Mode 1: start_date + duration_days
	dur := 14
	start, end, d, err := models.NormalizeSprintDates("2026-03-01", nil, &dur)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if start != "2026-03-01" || end != "2026-03-15" || d != 14 {
		t.Errorf("expected 2026-03-01 to 2026-03-15 (14 days), got %s to %s (%d days)", start, end, d)
	}

	// Mode 2: start_date + end_date
	endStr := "2026-03-21"
	start, end, d, err = models.NormalizeSprintDates("2026-03-01", &endStr, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if start != "2026-03-01" || end != "2026-03-21" || d != 20 {
		t.Errorf("expected 2026-03-01 to 2026-03-21 (20 days), got %s to %s (%d days)", start, end, d)
	}
}

func TestTaskCarryOverLogic(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	today := time.Now().Format("2006-01-02")
	yesterday := time.Now().AddDate(0, 0, -1).Format("2006-01-02")
	tomorrow := time.Now().AddDate(0, 0, 1).Format("2006-01-02")

	// Task 1: Assigned yesterday, not_started -> SHOULD roll over to today
	t1, err := models.CreateTask(db, models.TaskInput{
		Title:        "Yesterday Unfinished",
		AssignedDate: yesterday,
		Status:       models.StatusNotStarted,
	})
	if err != nil {
		t.Fatalf("failed to create task 1: %v", err)
	}

	// Task 2: Assigned yesterday, DONE -> SHOULD NOT roll over
	_, err = models.CreateTask(db, models.TaskInput{
		Title:        "Yesterday Done",
		AssignedDate: yesterday,
		Status:       models.StatusDone,
	})
	if err != nil {
		t.Fatalf("failed to create task 2: %v", err)
	}

	// Task 3: Assigned yesterday, deferred (Do Later) -> SHOULD NOT roll over
	_, err = models.CreateTask(db, models.TaskInput{
		Title:        "Yesterday Deferred",
		AssignedDate: yesterday,
		Status:       models.StatusNotStarted,
		IsDeferred:   true,
	})
	if err != nil {
		t.Fatalf("failed to create task 3: %v", err)
	}

	// Task 4: Assigned tomorrow -> SHOULD NOT appear today
	_, err = models.CreateTask(db, models.TaskInput{
		Title:        "Tomorrow Task",
		AssignedDate: tomorrow,
		Status:       models.StatusNotStarted,
	})
	if err != nil {
		t.Fatalf("failed to create task 4: %v", err)
	}

	// Task 5: Assigned today -> SHOULD appear today
	t5, err := models.CreateTask(db, models.TaskInput{
		Title:        "Today Task",
		AssignedDate: today,
		Status:       models.StatusInProgress,
	})
	if err != nil {
		t.Fatalf("failed to create task 5: %v", err)
	}

	// Query today's list
	todayTasks, err := models.GetTodayTasks(db, today)
	if err != nil {
		t.Fatalf("failed to get today tasks: %v", err)
	}

	if len(todayTasks) != 2 {
		t.Fatalf("expected 2 tasks in today's carry-over, got %d", len(todayTasks))
	}

	// In-progress should be ordered first per sort clause
	if todayTasks[0].ID != t5.ID || todayTasks[1].ID != t1.ID {
		t.Errorf("expected task 5 first (in_progress) then task 1 (yesterday uncompleted), got %+v", todayTasks)
	}
}

func TestTaskStatusTransitions(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	// Initial task created in not_started
	task, err := models.CreateTask(db, models.TaskInput{
		Title:  "Status flow task",
		Status: models.StatusNotStarted,
	})
	if err != nil {
		t.Fatalf("failed to create task: %v", err)
	}
	if task.StartedAt != nil {
		t.Errorf("expected started_at to be nil for not_started task")
	}
	if task.CompletedAt != nil {
		t.Errorf("expected completed_at to be nil")
	}

	// Transition to in_progress -> started_at should be populated
	updated, err := models.UpdateTask(db, task.ID, models.TaskInput{
		Status: models.StatusInProgress,
	})
	if err != nil {
		t.Fatalf("failed to update task: %v", err)
	}
	if updated.StartedAt == nil {
		t.Errorf("expected started_at to be set after leaving not_started")
	}
	if updated.CompletedAt != nil {
		t.Errorf("expected completed_at to remain nil")
	}

	// Transition to done -> completed_at should be set
	doneTask, err := models.UpdateTask(db, task.ID, models.TaskInput{
		Status: models.StatusDone,
	})
	if err != nil {
		t.Fatalf("failed to update task: %v", err)
	}
	if doneTask.CompletedAt == nil {
		t.Errorf("expected completed_at to be set after moving to done")
	}
}

func TestSubtaskNestingConstraint(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	// Parent task
	parent, err := models.CreateTask(db, models.TaskInput{
		Title: "Parent Task",
	})
	if err != nil {
		t.Fatalf("failed to create parent: %v", err)
	}

	// Subtask
	subtask, err := models.CreateTask(db, models.TaskInput{
		Title:        "Level 1 Subtask",
		ParentTaskID: &parent.ID,
	})
	if err != nil {
		t.Fatalf("failed to create subtask: %v", err)
	}
	if subtask.ParentTaskID == nil || *subtask.ParentTaskID != parent.ID {
		t.Errorf("expected parent_task_id to be %d", parent.ID)
	}

	// Attempt subtask of subtask (should be rejected)
	_, err = models.CreateTask(db, models.TaskInput{
		Title:        "Level 2 Subtask (Disallowed)",
		ParentTaskID: &subtask.ID,
	})
	if err == nil {
		t.Errorf("expected error when creating second-level nested subtask, got nil")
	}
}
