package models

import (
	"database/sql"
	"fmt"
	"os"
	"time"
)

type Attachment struct {
	ID               int64     `json:"id"`
	TaskID           int64     `json:"task_id"`
	FilePath         string    `json:"file_path"`
	FileType         string    `json:"file_type"`
	OriginalFilename string    `json:"original_filename"`
	CreatedAt        time.Time `json:"created_at"`
}

func CreateAttachment(db *sql.DB, taskID int64, filePath, fileType, originalFilename string) (*Attachment, error) {
	if fileType != "image" && fileType != "video" {
		return nil, fmt.Errorf("invalid file_type, must be 'image' or 'video'")
	}

	query := `
		INSERT INTO attachments (task_id, file_path, file_type, original_filename)
		VALUES (?, ?, ?, ?)
	`
	res, err := db.Exec(query, taskID, filePath, fileType, originalFilename)
	if err != nil {
		return nil, fmt.Errorf("failed to create attachment: %w", err)
	}

	id, err := res.LastInsertId()
	if err != nil {
		return nil, err
	}

	return GetAttachmentByID(db, id)
}

func GetAttachmentByID(db *sql.DB, id int64) (*Attachment, error) {
	query := `
		SELECT id, task_id, file_path, file_type, original_filename, created_at
		FROM attachments
		WHERE id = ?
	`
	var a Attachment
	var createdAt string
	err := db.QueryRow(query, id).Scan(&a.ID, &a.TaskID, &a.FilePath, &a.FileType, &a.OriginalFilename, &createdAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	a.CreatedAt, _ = time.Parse("2006-01-02 15:04:05", createdAt)
	return &a, nil
}

func GetAttachmentsByTaskID(db *sql.DB, taskID int64) ([]Attachment, error) {
	query := `
		SELECT id, task_id, file_path, file_type, original_filename, created_at
		FROM attachments
		WHERE task_id = ?
		ORDER BY created_at ASC
	`
	rows, err := db.Query(query, taskID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	attachments := make([]Attachment, 0)
	for rows.Next() {
		var a Attachment
		var createdAt string
		if err := rows.Scan(&a.ID, &a.TaskID, &a.FilePath, &a.FileType, &a.OriginalFilename, &createdAt); err != nil {
			return nil, err
		}
		a.CreatedAt, _ = time.Parse("2006-01-02 15:04:05", createdAt)
		attachments = append(attachments, a)
	}

	return attachments, nil
}

func DeleteAttachment(db *sql.DB, id int64, mediaBaseDir string) error {
	att, err := GetAttachmentByID(db, id)
	if err != nil {
		return err
	}
	if att == nil {
		return sql.ErrNoRows
	}

	// Delete from DB first
	query := `DELETE FROM attachments WHERE id = ?`
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

	// Remove physical file from disk if path exists
	fullPath := att.FilePath
	if mediaBaseDir != "" && !os.IsPathSeparator(att.FilePath[0]) {
		fullPath = mediaBaseDir + "/" + att.FilePath
	}
	_ = os.Remove(fullPath)

	return nil
}
