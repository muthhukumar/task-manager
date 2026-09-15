package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"task-manager/backend/internal/models"
)

type CardHandler struct {
	DB *sql.DB
}

func NewCardHandler(db *sql.DB) *CardHandler {
	return &CardHandler{DB: db}
}

func (h *CardHandler) GetBySprintID(w http.ResponseWriter, r *http.Request) {
	sprintIDStr := chi.URLParam(r, "sprint_id")
	if sprintIDStr == "" {
		sprintIDStr = chi.URLParam(r, "id")
	}

	var sprintID *int64
	if sprintIDStr != "" {
		id, err := strconv.ParseInt(sprintIDStr, 10, 64)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid sprint ID")
			return
		}
		sprintID = &id
	}

	cards, err := models.GetCardsBySprintID(h.DB, sprintID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, cards)
}

func (h *CardHandler) CreateUnderSprint(w http.ResponseWriter, r *http.Request) {
	sprintIDStr := chi.URLParam(r, "id")
	if sprintIDStr == "" {
		sprintIDStr = chi.URLParam(r, "sprint_id")
	}

	var sprintID *int64
	if sprintIDStr != "" {
		id, err := strconv.ParseInt(sprintIDStr, 10, 64)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid sprint ID")
			return
		}
		sprintID = &id
	}

	var input models.CardInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}

	if sprintID != nil {
		input.SprintID = sprintID
	}

	card, err := models.CreateCard(h.DB, input)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, card)
}

func (h *CardHandler) Update(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid card ID")
		return
	}

	var input models.CardInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}

	card, err := models.UpdateCard(h.DB, id, input)
	if err != nil {
		if err == sql.ErrNoRows {
			writeError(w, http.StatusNotFound, "card not found")
			return
		}
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, card)
}

func (h *CardHandler) Delete(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid card ID")
		return
	}

	err = models.DeleteCard(h.DB, id)
	if err != nil {
		if err == sql.ErrNoRows {
			writeError(w, http.StatusNotFound, "card not found")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "card deleted"})
}
