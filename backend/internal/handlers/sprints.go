package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"task-manager/backend/internal/models"
)

type SprintHandler struct {
	DB *sql.DB
}

func NewSprintHandler(db *sql.DB) *SprintHandler {
	return &SprintHandler{DB: db}
}

func (h *SprintHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	sprints, err := models.GetSprints(h.DB)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, sprints)
}

func (h *SprintHandler) Create(w http.ResponseWriter, r *http.Request) {
	var input models.SprintInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}

	if input.Name == "" {
		writeError(w, http.StatusBadRequest, "sprint name is required")
		return
	}
	if input.StartDate == "" {
		writeError(w, http.StatusBadRequest, "start_date is required")
		return
	}

	sprint, err := models.CreateSprint(h.DB, input)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, sprint)
}

func (h *SprintHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid sprint ID")
		return
	}

	sprint, err := models.GetSprintByID(h.DB, id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if sprint == nil {
		writeError(w, http.StatusNotFound, "sprint not found")
		return
	}

	writeJSON(w, http.StatusOK, sprint)
}

func (h *SprintHandler) Update(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid sprint ID")
		return
	}

	var input models.SprintInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}

	sprint, err := models.UpdateSprint(h.DB, id, input)
	if err != nil {
		if err == sql.ErrNoRows {
			writeError(w, http.StatusNotFound, "sprint not found")
			return
		}
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, sprint)
}

func (h *SprintHandler) Delete(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid sprint ID")
		return
	}

	err = models.DeleteSprint(h.DB, id)
	if err != nil {
		if err == sql.ErrNoRows {
			writeError(w, http.StatusNotFound, "sprint not found")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "sprint deleted"})
}
