package handlers

import (
	"database/sql"
	"net/http"
	"strconv"

	"task-manager/backend/internal/models"
)

type ReportHandler struct {
	DB *sql.DB
}

func NewReportHandler(db *sql.DB) *ReportHandler {
	return &ReportHandler{DB: db}
}

func (h *ReportHandler) GetBurndown(w http.ResponseWriter, r *http.Request) {
	sprintIDStr := r.URL.Query().Get("sprint_id")
	if sprintIDStr == "" {
		writeError(w, http.StatusBadRequest, "sprint_id query param is required")
		return
	}

	sprintID, err := strconv.ParseInt(sprintIDStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid sprint_id")
		return
	}

	points, err := models.GetSprintBurndown(h.DB, sprintID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, points)
}

func (h *ReportHandler) GetCompletions(w http.ResponseWriter, r *http.Request) {
	rangeStr := r.URL.Query().Get("range")
	days := 30
	if rangeStr != "" {
		if d, err := strconv.Atoi(rangeStr); err == nil && d > 0 {
			days = d
		}
	}

	completions, err := models.GetDailyCompletions(h.DB, days)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, completions)
}

func (h *ReportHandler) GetStatusBreakdown(w http.ResponseWriter, r *http.Request) {
	breakdown, err := models.GetStatusBreakdown(h.DB)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, breakdown)
}

func (h *ReportHandler) GetHeatmap(w http.ResponseWriter, r *http.Request) {
	heatmap, err := models.GetCompletionHeatmap(h.DB)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, heatmap)
}

func (h *ReportHandler) GetVelocity(w http.ResponseWriter, r *http.Request) {
	velocity, err := models.GetSprintVelocity(h.DB)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, velocity)
}

func (h *ReportHandler) GetBlockedTime(w http.ResponseWriter, r *http.Request) {
	blocked, err := models.GetBlockedTasks(h.DB)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, blocked)
}

func (h *ReportHandler) GetWorkSplit(w http.ResponseWriter, r *http.Request) {
	split, err := models.GetWorkTypeSplit(h.DB)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, split)
}
