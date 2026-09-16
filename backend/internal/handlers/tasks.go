package handlers

import (
	"database/sql"
	"encoding/json"
	"io"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"task-manager/backend/internal/models"
)

type TaskHandler struct {
	DB *sql.DB
}

func NewTaskHandler(db *sql.DB) *TaskHandler {
	return &TaskHandler{DB: db}
}

func (h *TaskHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()

	// Check if this is the "today" carry-over query
	isToday := q.Get("today") == "true"
	if isToday {
		targetDate := q.Get("date")
		tasks, err := models.GetTodayTasks(h.DB, targetDate)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, tasks)
		return
	}

	filter := models.TaskFilter{
		Date:         q.Get("date"),
		Status:       q.Get("status"),
		TopLevelOnly: q.Get("top_level_only") == "true",
	}

	if sprintIDStr := q.Get("sprint_id"); sprintIDStr != "" {
		if id, err := strconv.ParseInt(sprintIDStr, 10, 64); err == nil {
			filter.SprintID = &id
		}
	}
	if cardIDStr := q.Get("card_id"); cardIDStr != "" {
		if id, err := strconv.ParseInt(cardIDStr, 10, 64); err == nil {
			filter.CardID = &id
		}
	}
	if parentIDStr := q.Get("parent_task_id"); parentIDStr != "" {
		if id, err := strconv.ParseInt(parentIDStr, 10, 64); err == nil {
			filter.ParentTaskID = &id
		}
	}
	if deferredStr := q.Get("deferred"); deferredStr != "" {
		b := deferredStr == "true" || deferredStr == "1"
		filter.IsDeferred = &b
	}
	if adhocStr := q.Get("adhoc"); adhocStr != "" {
		b := adhocStr == "true" || adhocStr == "1"
		filter.IsAdhoc = &b
	}
	if techStr := q.Get("tech"); techStr != "" {
		b := techStr == "true" || techStr == "1"
		filter.IsTechTask = &b
	}
	if incDoneStr := q.Get("include_done"); incDoneStr != "" {
		b := incDoneStr == "true" || incDoneStr == "1"
		filter.IncludeDone = &b
	}

	tasks, err := models.GetTasks(h.DB, filter)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, tasks)
}

func (h *TaskHandler) Create(w http.ResponseWriter, r *http.Request) {
	var input models.TaskInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}

	task, err := models.CreateTask(h.DB, input)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, task)
}

func (h *TaskHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid task ID")
		return
	}

	task, err := models.GetTaskByID(h.DB, id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if task == nil {
		writeError(w, http.StatusNotFound, "task not found")
		return
	}

	writeJSON(w, http.StatusOK, task)
}

func (h *TaskHandler) Update(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid task ID")
		return
	}

	bodyBytes, err := io.ReadAll(r.Body)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}

	task, err := models.UpdateTaskJSON(h.DB, id, bodyBytes)
	if err != nil {
		if err == sql.ErrNoRows {
			writeError(w, http.StatusNotFound, "task not found")
			return
		}
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, task)
}

func (h *TaskHandler) Delete(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid task ID")
		return
	}

	err = models.DeleteTask(h.DB, id)
	if err != nil {
		if err == sql.ErrNoRows {
			writeError(w, http.StatusNotFound, "task not found")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "task deleted"})
}
