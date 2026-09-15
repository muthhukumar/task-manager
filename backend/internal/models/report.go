package models

import (
	"database/sql"
	"fmt"
	"time"
)

type BurndownPoint struct {
	Date          string  `json:"date"`
	Remaining     int     `json:"remaining"`
	IdealBurndown float64 `json:"ideal_burndown"`
}

type DailyCompletion struct {
	Date  string `json:"date"`
	Count int    `json:"count"`
}

type StatusBreakdown struct {
	Status TaskStatus `json:"status"`
	Count  int        `json:"count"`
}

type HeatmapPoint struct {
	Day   string `json:"day"`   // YYYY-MM-DD format for @nivo/calendar
	Value int    `json:"value"` // Completion count
}

type SprintVelocity struct {
	SprintID       int64  `json:"sprint_id"`
	SprintName     string `json:"sprint_name"`
	CompletedCount int    `json:"completed_count"`
	TotalCount     int    `json:"total_count"`
}

type WorkTypeSplit struct {
	Type  string `json:"type"`
	Count int    `json:"count"`
}

type BlockedTaskInfo struct {
	TaskID         int64     `json:"task_id"`
	Title          string    `json:"title"`
	AssignedDate   string    `json:"assigned_date"`
	LastComment    *string   `json:"last_comment,omitempty"`
	LastCommentAt  *time.Time `json:"last_comment_at,omitempty"`
}

func GetSprintBurndown(db *sql.DB, sprintID int64) ([]BurndownPoint, error) {
	sprint, err := GetSprintByID(db, sprintID)
	if err != nil {
		return nil, err
	}
	if sprint == nil {
		return nil, fmt.Errorf("sprint not found")
	}

	startDate, err := time.Parse("2006-01-02", sprint.StartDate)
	if err != nil {
		return nil, err
	}
	endDate, err := time.Parse("2006-01-02", sprint.EndDate)
	if err != nil {
		return nil, err
	}

	// Total tasks in sprint
	var totalTasks int
	err = db.QueryRow(`SELECT COUNT(*) FROM tasks WHERE sprint_id = ?`, sprintID).Scan(&totalTasks)
	if err != nil {
		return nil, err
	}

	daysTotal := int(endDate.Sub(startDate).Hours()/24) + 1
	if daysTotal <= 0 {
		daysTotal = 1
	}

	points := make([]BurndownPoint, 0, daysTotal)
	todayStr := time.Now().Format("2006-01-02")

	for i := 0; i < daysTotal; i++ {
		currentDate := startDate.AddDate(0, 0, i)
		currentDateStr := currentDate.Format("2006-01-02")
		endOfDayStr := currentDateStr + " 23:59:59"

		// Only calculate actual remaining up to today
		var remaining int
		if currentDateStr <= todayStr {
			// Tasks in this sprint that were NOT completed on or before this day's end
			q := `
				SELECT COUNT(*) FROM tasks 
				WHERE sprint_id = ? 
				  AND (completed_at IS NULL OR completed_at > ?)
			`
			_ = db.QueryRow(q, sprintID, endOfDayStr).Scan(&remaining)
		} else {
			remaining = -1 // Future day flag
		}

		ideal := float64(totalTasks) - (float64(totalTasks)/float64(daysTotal-1))*float64(i)
		if ideal < 0 {
			ideal = 0
		}

		points = append(points, BurndownPoint{
			Date:          currentDateStr,
			Remaining:     remaining,
			IdealBurndown: ideal,
		})
	}

	return points, nil
}

func GetDailyCompletions(db *sql.DB, days int) ([]DailyCompletion, error) {
	if days <= 0 {
		days = 30
	}

	// Generate series for last N days
	results := make([]DailyCompletion, 0, days)
	now := time.Now()

	for i := days - 1; i >= 0; i-- {
		d := now.AddDate(0, 0, -i).Format("2006-01-02")
		results = append(results, DailyCompletion{Date: d, Count: 0})
	}

	query := `
		SELECT DATE(completed_at) AS comp_date, COUNT(*) AS count
		FROM tasks
		WHERE status = 'done' 
		  AND completed_at IS NOT NULL
		  AND completed_at >= DATE('now', '-' || ? || ' day')
		GROUP BY DATE(completed_at)
	`
	rows, err := db.Query(query, days)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	counts := make(map[string]int)
	for rows.Next() {
		var dateStr string
		var count int
		if err := rows.Scan(&dateStr, &count); err == nil {
			counts[dateStr] = count
		}
	}

	for i := range results {
		if c, exists := counts[results[i].Date]; exists {
			results[i].Count = c
		}
	}

	return results, nil
}

func GetStatusBreakdown(db *sql.DB) ([]StatusBreakdown, error) {
	statuses := []TaskStatus{StatusNotStarted, StatusInProgress, StatusBlocked, StatusDone}
	counts := make(map[TaskStatus]int)
	for _, s := range statuses {
		counts[s] = 0
	}

	query := `SELECT status, COUNT(*) FROM tasks GROUP BY status`
	rows, err := db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var s string
		var c int
		if err := rows.Scan(&s, &c); err == nil {
			counts[TaskStatus(s)] = c
		}
	}

	breakdown := make([]StatusBreakdown, 0, len(statuses))
	for _, s := range statuses {
		breakdown = append(breakdown, StatusBreakdown{
			Status: s,
			Count:  counts[s],
		})
	}

	return breakdown, nil
}

func GetCompletionHeatmap(db *sql.DB) ([]HeatmapPoint, error) {
	// Query completion counts for the last 365 days
	query := `
		SELECT DATE(completed_at) as day, COUNT(*) as count
		FROM tasks
		WHERE status = 'done' 
		  AND completed_at IS NOT NULL
		  AND completed_at >= DATE('now', '-365 day')
		GROUP BY DATE(completed_at)
		ORDER BY day ASC
	`
	rows, err := db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	points := make([]HeatmapPoint, 0)
	for rows.Next() {
		var day string
		var count int
		if err := rows.Scan(&day, &count); err == nil {
			points = append(points, HeatmapPoint{
				Day:   day,
				Value: count,
			})
		}
	}

	return points, nil
}

func GetSprintVelocity(db *sql.DB) ([]SprintVelocity, error) {
	query := `
		SELECT 
			s.id,
			s.name,
			COUNT(t.id) as total_tasks,
			SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) as completed_tasks
		FROM sprints s
		LEFT JOIN tasks t ON s.id = t.sprint_id
		GROUP BY s.id
		ORDER BY s.start_date ASC
	`
	rows, err := db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	velocities := make([]SprintVelocity, 0)
	for rows.Next() {
		var v SprintVelocity
		if err := rows.Scan(&v.SprintID, &v.SprintName, &v.TotalCount, &v.CompletedCount); err != nil {
			return nil, err
		}
		velocities = append(velocities, v)
	}

	return velocities, nil
}

func GetWorkTypeSplit(db *sql.DB) ([]WorkTypeSplit, error) {
	var planned, adhoc, tech int

	// Planned: attached to a sprint or not adhoc/tech
	_ = db.QueryRow(`SELECT COUNT(*) FROM tasks WHERE is_adhoc = 0 AND is_tech_task = 0`).Scan(&planned)
	_ = db.QueryRow(`SELECT COUNT(*) FROM tasks WHERE is_adhoc = 1`).Scan(&adhoc)
	_ = db.QueryRow(`SELECT COUNT(*) FROM tasks WHERE is_tech_task = 1`).Scan(&tech)

	return []WorkTypeSplit{
		{Type: "Planned", Count: planned},
		{Type: "Ad-hoc", Count: adhoc},
		{Type: "Tech Task", Count: tech},
	}, nil
}

func GetBlockedTasks(db *sql.DB) ([]BlockedTaskInfo, error) {
	query := `
		SELECT 
			t.id, 
			t.title, 
			t.assigned_date,
			(SELECT body FROM comments WHERE task_id = t.id ORDER BY created_at DESC LIMIT 1) as last_comment,
			(SELECT created_at FROM comments WHERE task_id = t.id ORDER BY created_at DESC LIMIT 1) as last_comment_at
		FROM tasks t
		WHERE t.status = 'blocked'
		ORDER BY t.assigned_date ASC
	`
	rows, err := db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	blocked := make([]BlockedTaskInfo, 0)
	for rows.Next() {
		var b BlockedTaskInfo
		var comment, commentAt sql.NullString
		if err := rows.Scan(&b.TaskID, &b.Title, &b.AssignedDate, &comment, &commentAt); err != nil {
			return nil, err
		}
		if comment.Valid {
			b.LastComment = &comment.String
		}
		if commentAt.Valid {
			t := parseTimePtr(&commentAt.String)
			b.LastCommentAt = t
		}
		blocked = append(blocked, b)
	}

	return blocked, nil
}
