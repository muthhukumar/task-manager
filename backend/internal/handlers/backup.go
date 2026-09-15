package handlers

import (
	"archive/zip"
	"database/sql"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type BackupHandler struct {
	DB       *sql.DB
	DBPath   string
	MediaDir string
}

func NewBackupHandler(db *sql.DB, dbPath, mediaDir string) *BackupHandler {
	if dbPath == "" {
		dbPath = os.Getenv("DB_PATH")
		if dbPath == "" {
			dbPath = "./data/app.db"
		}
	}
	if mediaDir == "" {
		mediaDir = os.Getenv("MEDIA_DIR")
		if mediaDir == "" {
			mediaDir = "./data/media"
		}
	}
	return &BackupHandler{
		DB:       db,
		DBPath:   dbPath,
		MediaDir: mediaDir,
	}
}

func (h *BackupHandler) ExportBackup(w http.ResponseWriter, r *http.Request) {
	timestamp := time.Now().Format("20060102-150405")
	zipFilename := fmt.Sprintf("task-manager-backup-%s.zip", timestamp)

	tempDir, err := os.MkdirTemp("", "task-backup-*")
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create temp dir: "+err.Error())
		return
	}
	defer os.RemoveAll(tempDir)

	tempDBBackup := filepath.Join(tempDir, "app.db")

	// Use SQLite VACUUM INTO for a safe, transaction-consistent live backup
	// If VACUUM INTO fails (e.g. older sqlite), fallback to reading file directly
	_, err = h.DB.Exec(fmt.Sprintf("VACUUM INTO '%s'", tempDBBackup))
	if err != nil {
		// Fallback to copying
		srcDB, err := os.Open(h.DBPath)
		if err == nil {
			dstDB, err := os.Create(tempDBBackup)
			if err == nil {
				_, _ = io.Copy(dstDB, srcDB)
				dstDB.Close()
			}
			srcDB.Close()
		}
	}

	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, zipFilename))

	zipWriter := zip.NewWriter(w)
	defer zipWriter.Close()

	// 1. Add app.db to zip
	if dbFile, err := os.Open(tempDBBackup); err == nil {
		if stat, err := dbFile.Stat(); err == nil {
			header, err := zip.FileInfoHeader(stat)
			if err == nil {
				header.Name = "app.db"
				header.Method = zip.Deflate
				writer, err := zipWriter.CreateHeader(header)
				if err == nil {
					_, _ = io.Copy(writer, dbFile)
				}
			}
		}
		dbFile.Close()
	}

	// 2. Add media files to zip
	_ = filepath.Walk(h.MediaDir, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			return nil
		}
		relPath, err := filepath.Rel(h.MediaDir, path)
		if err != nil {
			return nil
		}
		header, err := zip.FileInfoHeader(info)
		if err != nil {
			return nil
		}
		header.Name = filepath.ToSlash(filepath.Join("media", relPath))
		header.Method = zip.Deflate
		writer, err := zipWriter.CreateHeader(header)
		if err != nil {
			return nil
		}
		file, err := os.Open(path)
		if err != nil {
			return nil
		}
		defer file.Close()
		_, _ = io.Copy(writer, file)
		return nil
	})
}

func (h *BackupHandler) ImportRestore(w http.ResponseWriter, r *http.Request) {
	// Parse uploaded multipart file (up to 500MB)
	if err := r.ParseMultipartForm(500 << 20); err != nil {
		writeError(w, http.StatusBadRequest, "failed to parse multipart form: "+err.Error())
		return
	}

	file, _, err := r.FormFile("backup")
	if err != nil {
		writeError(w, http.StatusBadRequest, "backup file field required: "+err.Error())
		return
	}
	defer file.Close()

	tempDir, err := os.MkdirTemp("", "task-restore-*")
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create temp dir: "+err.Error())
		return
	}
	defer os.RemoveAll(tempDir)

	tempZip := filepath.Join(tempDir, "restore.zip")
	destZip, err := os.Create(tempZip)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create temp zip: "+err.Error())
		return
	}
	if _, err := io.Copy(destZip, file); err != nil {
		destZip.Close()
		writeError(w, http.StatusInternalServerError, "failed to write temp zip: "+err.Error())
		return
	}
	destZip.Close()

	rZip, err := zip.OpenReader(tempZip)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid zip file: "+err.Error())
		return
	}
	defer rZip.Close()

	// Verify zip contains app.db
	hasDB := false
	for _, f := range rZip.File {
		if f.Name == "app.db" || strings.HasSuffix(f.Name, "/app.db") {
			hasDB = true
			break
		}
	}
	if !hasDB {
		writeError(w, http.StatusBadRequest, "invalid backup: app.db not found in zip")
		return
	}

	// Create safety backup of existing data
	safetyDir, err := os.MkdirTemp("", "task-safety-*")
	if err == nil {
		defer os.RemoveAll(safetyDir)
		_ = os.Rename(h.DBPath, filepath.Join(safetyDir, "app.db"))
	}

	// Extract files
	for _, f := range rZip.File {
		// Prevent zip-slip
		cleanName := filepath.Clean(f.Name)
		if strings.HasPrefix(cleanName, "..") || strings.HasPrefix(cleanName, "/") {
			continue
		}

		rc, err := f.Open()
		if err != nil {
			continue
		}

		if cleanName == "app.db" || strings.HasSuffix(cleanName, "app.db") {
			targetDB, err := os.Create(h.DBPath)
			if err == nil {
				_, _ = io.Copy(targetDB, rc)
				targetDB.Close()
			}
		} else if strings.HasPrefix(cleanName, "media/") || strings.HasPrefix(cleanName, "media\\") {
			relMedia := strings.TrimPrefix(strings.TrimPrefix(cleanName, "media/"), "media\\")
			if relMedia != "" {
				targetPath := filepath.Join(h.MediaDir, relMedia)
				_ = os.MkdirAll(filepath.Dir(targetPath), 0755)
				targetFile, err := os.Create(targetPath)
				if err == nil {
					_, _ = io.Copy(targetFile, rc)
					targetFile.Close()
				}
			}
		}
		rc.Close()
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "restore successful"})
}
