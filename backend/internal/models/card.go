package models

import (
	"database/sql"
	"fmt"
	"time"
)

type Card struct {
	ID          int64     `json:"id"`
	SprintID    *int64    `json:"sprint_id"`
	Title       string    `json:"title"`
	Description *string   `json:"description"`
	CreatedAt   time.Time `json:"created_at"`
}

type CardInput struct {
	SprintID    *int64  `json:"sprint_id"`
	Title       string  `json:"title"`
	Description *string `json:"description"`
}

func CreateCard(db *sql.DB, input CardInput) (*Card, error) {
	if input.Title == "" {
		return nil, fmt.Errorf("title is required")
	}

	query := `
		INSERT INTO cards (sprint_id, title, description)
		VALUES (?, ?, ?)
	`
	res, err := db.Exec(query, input.SprintID, input.Title, input.Description)
	if err != nil {
		return nil, fmt.Errorf("failed to create card: %w", err)
	}

	id, err := res.LastInsertId()
	if err != nil {
		return nil, err
	}

	return GetCardByID(db, id)
}

func GetCardsBySprintID(db *sql.DB, sprintID *int64) ([]Card, error) {
	var rows *sql.Rows
	var err error

	if sprintID != nil {
		query := `
			SELECT id, sprint_id, title, description, created_at
			FROM cards
			WHERE sprint_id = ?
			ORDER BY created_at ASC
		`
		rows, err = db.Query(query, *sprintID)
	} else {
		query := `
			SELECT id, sprint_id, title, description, created_at
			FROM cards
			ORDER BY created_at ASC
		`
		rows, err = db.Query(query)
	}

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	cards := make([]Card, 0)
	for rows.Next() {
		var c Card
		var createdAt string
		if err := rows.Scan(&c.ID, &c.SprintID, &c.Title, &c.Description, &createdAt); err != nil {
			return nil, err
		}
		c.CreatedAt, _ = time.Parse("2006-01-02 15:04:05", createdAt)
		cards = append(cards, c)
	}

	return cards, nil
}

func GetCardByID(db *sql.DB, id int64) (*Card, error) {
	query := `
		SELECT id, sprint_id, title, description, created_at
		FROM cards
		WHERE id = ?
	`
	var c Card
	var createdAt string
	err := db.QueryRow(query, id).Scan(&c.ID, &c.SprintID, &c.Title, &c.Description, &createdAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	c.CreatedAt, _ = time.Parse("2006-01-02 15:04:05", createdAt)
	return &c, nil
}

func UpdateCard(db *sql.DB, id int64, input CardInput) (*Card, error) {
	if input.Title == "" {
		return nil, fmt.Errorf("title is required")
	}

	query := `
		UPDATE cards
		SET sprint_id = ?, title = ?, description = ?
		WHERE id = ?
	`
	res, err := db.Exec(query, input.SprintID, input.Title, input.Description, id)
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

	return GetCardByID(db, id)
}

func DeleteCard(db *sql.DB, id int64) error {
	query := `DELETE FROM cards WHERE id = ?`
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
