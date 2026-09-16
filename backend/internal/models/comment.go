package models

import (
	"database/sql"
	"fmt"
	"time"
)

type Comment struct {
	ID        int64     `json:"id"`
	TaskID    int64     `json:"task_id"`
	Body      string    `json:"body"`
	CreatedAt time.Time `json:"created_at"`
}

type CommentInput struct {
	Body string `json:"body"`
}

func CreateComment(db *sql.DB, taskID int64, body string) (*Comment, error) {
	if body == "" {
		return nil, fmt.Errorf("comment body is required")
	}

	query := `INSERT INTO comments (task_id, body) VALUES (?, ?)`
	res, err := db.Exec(query, taskID, body)
	if err != nil {
		return nil, fmt.Errorf("failed to create comment: %w", err)
	}

	id, err := res.LastInsertId()
	if err != nil {
		return nil, err
	}

	return GetCommentByID(db, id)
}

func parseCommentTime(s string) time.Time {
	formats := []string{
		time.RFC3339Nano,
		time.RFC3339,
		"2006-01-02 15:04:05",
		"2006-01-02T15:04:05",
		"2006-01-02 15:04:05.999999999",
		"2006-01-02 15:04:05Z07:00",
		"2006-01-02T15:04:05Z07:00",
	}
	for _, f := range formats {
		if t, err := time.Parse(f, s); err == nil {
			return t
		}
	}
	return time.Now()
}

func GetCommentByID(db *sql.DB, id int64) (*Comment, error) {
	query := `SELECT id, task_id, body, created_at FROM comments WHERE id = ?`
	var c Comment
	var createdAt string
	err := db.QueryRow(query, id).Scan(&c.ID, &c.TaskID, &c.Body, &createdAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	c.CreatedAt = parseCommentTime(createdAt)
	return &c, nil
}

func GetCommentsByTaskID(db *sql.DB, taskID int64) ([]Comment, error) {
	query := `
		SELECT id, task_id, body, created_at
		FROM comments
		WHERE task_id = ?
		ORDER BY created_at ASC
	`
	rows, err := db.Query(query, taskID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	comments := make([]Comment, 0)
	for rows.Next() {
		var c Comment
		var createdAt string
		if err := rows.Scan(&c.ID, &c.TaskID, &c.Body, &createdAt); err != nil {
			return nil, err
		}
		c.CreatedAt = parseCommentTime(createdAt)
		comments = append(comments, c)
	}

	return comments, nil
}

func UpdateComment(db *sql.DB, id int64, body string) (*Comment, error) {
	if body == "" {
		return nil, fmt.Errorf("comment body is required")
	}

	query := `UPDATE comments SET body = ? WHERE id = ?`
	res, err := db.Exec(query, body, id)
	if err != nil {
		return nil, fmt.Errorf("failed to update comment: %w", err)
	}

	rows, _ := res.RowsAffected()
	if rows == 0 {
		return nil, fmt.Errorf("comment not found")
	}

	return GetCommentByID(db, id)
}

func DeleteComment(db *sql.DB, id int64) error {
	query := `DELETE FROM comments WHERE id = ?`
	res, err := db.Exec(query, id)
	if err != nil {
		return fmt.Errorf("failed to delete comment: %w", err)
	}

	rows, _ := res.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("comment not found")
	}

	return nil
}
