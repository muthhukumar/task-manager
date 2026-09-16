package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"task-manager/backend/internal/models"
)

type CommentHandler struct {
	DB *sql.DB
}

func NewCommentHandler(db *sql.DB) *CommentHandler {
	return &CommentHandler{DB: db}
}

func (h *CommentHandler) GetByTaskID(w http.ResponseWriter, r *http.Request) {
	taskIDStr := chi.URLParam(r, "id")
	taskID, err := strconv.ParseInt(taskIDStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid task ID")
		return
	}

	comments, err := models.GetCommentsByTaskID(h.DB, taskID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, comments)
}

func (h *CommentHandler) Create(w http.ResponseWriter, r *http.Request) {
	taskIDStr := chi.URLParam(r, "id")
	taskID, err := strconv.ParseInt(taskIDStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid task ID")
		return
	}

	var input models.CommentInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}

	comment, err := models.CreateComment(h.DB, taskID, input.Body)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, comment)
}

func (h *CommentHandler) Update(w http.ResponseWriter, r *http.Request) {
	commentIDStr := chi.URLParam(r, "id")
	commentID, err := strconv.ParseInt(commentIDStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid comment ID")
		return
	}

	var input models.CommentInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}

	comment, err := models.UpdateComment(h.DB, commentID, input.Body)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, comment)
}

func (h *CommentHandler) Delete(w http.ResponseWriter, r *http.Request) {
	commentIDStr := chi.URLParam(r, "id")
	commentID, err := strconv.ParseInt(commentIDStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid comment ID")
		return
	}

	if err := models.DeleteComment(h.DB, commentID); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "comment deleted successfully"})
}

