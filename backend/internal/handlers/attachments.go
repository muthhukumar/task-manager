package handlers

import (
	"database/sql"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"task-manager/backend/internal/models"
)

type AttachmentHandler struct {
	DB       *sql.DB
	MediaDir string
}

func NewAttachmentHandler(db *sql.DB, mediaDir string) *AttachmentHandler {
	if mediaDir == "" {
		mediaDir = os.Getenv("MEDIA_DIR")
		if mediaDir == "" {
			mediaDir = "./data/media"
		}
	}
	_ = os.MkdirAll(mediaDir, 0755)
	return &AttachmentHandler{DB: db, MediaDir: mediaDir}
}

func (h *AttachmentHandler) Upload(w http.ResponseWriter, r *http.Request) {
	taskIDStr := chi.URLParam(r, "id")
	taskID, err := strconv.ParseInt(taskIDStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid task ID")
		return
	}

	// 50 MB max
	if err := r.ParseMultipartForm(50 << 20); err != nil {
		writeError(w, http.StatusBadRequest, "failed to parse multipart form: "+err.Error())
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "file field is required: "+err.Error())
		return
	}
	defer file.Close()

	origName := filepath.Base(header.Filename)
	ext := strings.ToLower(filepath.Ext(origName))

	// Detect file type
	var fileType string
	switch ext {
	case ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp":
		fileType = "image"
	case ".mp4", ".webm", ".mov", ".avi", ".mkv":
		fileType = "video"
	default:
		// Fallback check mime
		contentType := header.Header.Get("Content-Type")
		if strings.HasPrefix(contentType, "image/") {
			fileType = "image"
		} else if strings.HasPrefix(contentType, "video/") {
			fileType = "video"
		} else {
			writeError(w, http.StatusBadRequest, "unsupported file format. Only image and video files are supported.")
			return
		}
	}

	// Unique filename to prevent collisions
	uniqueFilename := fmt.Sprintf("%s_%s", uuid.New().String()[:8], origName)
	savePath := filepath.Join(h.MediaDir, uniqueFilename)

	destFile, err := os.Create(savePath)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to save file: "+err.Error())
		return
	}
	defer destFile.Close()

	if _, err := io.Copy(destFile, file); err != nil {
		_ = os.Remove(savePath)
		writeError(w, http.StatusInternalServerError, "failed to write file: "+err.Error())
		return
	}

	// Store relative path in DB
	attachment, err := models.CreateAttachment(h.DB, taskID, uniqueFilename, fileType, origName)
	if err != nil {
		_ = os.Remove(savePath)
		writeError(w, http.StatusInternalServerError, "failed to save attachment record: "+err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, attachment)
}

func (h *AttachmentHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid attachment ID")
		return
	}

	attachment, err := models.GetAttachmentByID(h.DB, id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if attachment == nil {
		writeError(w, http.StatusNotFound, "attachment not found")
		return
	}

	writeJSON(w, http.StatusOK, attachment)
}

func (h *AttachmentHandler) Delete(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid attachment ID")
		return
	}

	err = models.DeleteAttachment(h.DB, id, h.MediaDir)
	if err != nil {
		if err == sql.ErrNoRows {
			writeError(w, http.StatusNotFound, "attachment not found")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "attachment deleted"})
}

func (h *AttachmentHandler) ServeMedia(w http.ResponseWriter, r *http.Request) {
	filename := chi.URLParam(r, "filename")
	filename = filepath.Base(filename) // prevent directory traversal
	fullPath := filepath.Join(h.MediaDir, filename)

	if _, err := os.Stat(fullPath); os.IsNotExist(err) {
		http.NotFound(w, r)
		return
	}

	http.ServeFile(w, r, fullPath)
}
