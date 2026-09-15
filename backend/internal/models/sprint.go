package models

import (
	"database/sql"
	"fmt"
	"time"
)

type Sprint struct {
	ID           int64     `json:"id"`
	Name         string    `json:"name"`
	StartDate    string    `json:"start_date"`
	EndDate      string    `json:"end_date"`
	DurationDays int       `json:"duration_days"`
	CreatedAt    time.Time `json:"created_at"`
}

type SprintInput struct {
	Name         string  `json:"name"`
	StartDate    string  `json:"start_date"`
	EndDate      *string `json:"end_date,omitempty"`
	DurationDays *int    `json:"duration_days,omitempty"`
}

func NormalizeSprintDates(startDateStr string, endDateStr *string, durationDays *int) (string, string, int, error) {
	startDate, err := time.Parse("2006-01-02", startDateStr)
	if err != nil {
		return "", "", 0, fmt.Errorf("invalid start_date format, expected YYYY-MM-DD: %w", err)
	}

	var endDate time.Time
	var duration int

	if durationDays != nil && *durationDays > 0 {
		duration = *durationDays
		// If duration is N days, end date is start date + (N - 1) days or start date + N days?
		// Usually duration of 14 days starting Monday means 14 calendar days (startDate + duration days)
		endDate = startDate.AddDate(0, 0, duration)
	} else if endDateStr != nil && *endDateStr != "" {
		endDate, err = time.Parse("2006-01-02", *endDateStr)
		if err != nil {
			return "", "", 0, fmt.Errorf("invalid end_date format, expected YYYY-MM-DD: %w", err)
		}
		days := int(endDate.Sub(startDate).Hours() / 24)
		if days < 0 {
			return "", "", 0, fmt.Errorf("end_date cannot be earlier than start_date")
		}
		duration = days
	} else {
		// Default to 14 days sprint if neither is specified
		duration = 14
		endDate = startDate.AddDate(0, 0, duration)
	}

	return startDate.Format("2006-01-02"), endDate.Format("2006-01-02"), duration, nil
}

func CreateSprint(db *sql.DB, input SprintInput) (*Sprint, error) {
	startDate, endDate, duration, err := NormalizeSprintDates(input.StartDate, input.EndDate, input.DurationDays)
	if err != nil {
		return nil, err
	}

	query := `
		INSERT INTO sprints (name, start_date, end_date, duration_days)
		VALUES (?, ?, ?, ?)
	`
	res, err := db.Exec(query, input.Name, startDate, endDate, duration)
	if err != nil {
		return nil, fmt.Errorf("failed to create sprint: %w", err)
	}

	id, err := res.LastInsertId()
	if err != nil {
		return nil, err
	}

	return GetSprintByID(db, id)
}

func GetSprints(db *sql.DB) ([]Sprint, error) {
	query := `
		SELECT id, name, start_date, end_date, duration_days, created_at
		FROM sprints
		ORDER BY start_date DESC
	`
	rows, err := db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	sprints := make([]Sprint, 0)
	for rows.Next() {
		var s Sprint
		var createdAt string
		if err := rows.Scan(&s.ID, &s.Name, &s.StartDate, &s.EndDate, &s.DurationDays, &createdAt); err != nil {
			return nil, err
		}
		s.CreatedAt, _ = time.Parse("2006-01-02 15:04:05", createdAt)
		sprints = append(sprints, s)
	}

	return sprints, nil
}

func GetSprintByID(db *sql.DB, id int64) (*Sprint, error) {
	query := `
		SELECT id, name, start_date, end_date, duration_days, created_at
		FROM sprints
		WHERE id = ?
	`
	var s Sprint
	var createdAt string
	err := db.QueryRow(query, id).Scan(&s.ID, &s.Name, &s.StartDate, &s.EndDate, &s.DurationDays, &createdAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	s.CreatedAt, _ = time.Parse("2006-01-02 15:04:05", createdAt)
	return &s, nil
}

func UpdateSprint(db *sql.DB, id int64, input SprintInput) (*Sprint, error) {
	startDate, endDate, duration, err := NormalizeSprintDates(input.StartDate, input.EndDate, input.DurationDays)
	if err != nil {
		return nil, err
	}

	query := `
		UPDATE sprints
		SET name = ?, start_date = ?, end_date = ?, duration_days = ?
		WHERE id = ?
	`
	res, err := db.Exec(query, input.Name, startDate, endDate, duration, id)
	if err != nil {
		return nil, err
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return nil, err
	}
	if affected == 0 {
		return nil, sql.ErrNoRows
	}

	return GetSprintByID(db, id)
}

func DeleteSprint(db *sql.DB, id int64) error {
	query := `DELETE FROM sprints WHERE id = ?`
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
