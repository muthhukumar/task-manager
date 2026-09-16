package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"task-manager/backend/internal/database"
	"task-manager/backend/internal/handlers"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8421"
	}

	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "./data/app.db"
	}

	mediaDir := os.Getenv("MEDIA_DIR")
	if mediaDir == "" {
		mediaDir = "./data/media"
	}

	log.Printf("Starting Task Manager API...")
	log.Printf("Database path: %s", dbPath)
	log.Printf("Media directory: %s", mediaDir)

	db, err := database.InitDB(dbPath)
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer db.Close()

	// Initialize handlers
	sprintHandler := handlers.NewSprintHandler(db)
	cardHandler := handlers.NewCardHandler(db)
	taskHandler := handlers.NewTaskHandler(db)
	commentHandler := handlers.NewCommentHandler(db)
	attachmentHandler := handlers.NewAttachmentHandler(db, mediaDir)
	reportHandler := handlers.NewReportHandler(db)
	backupHandler := handlers.NewBackupHandler(db, dbPath, mediaDir)

	r := chi.NewRouter()

	// Middleware
	r.Use(chimw.Logger)
	r.Use(chimw.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link", "Content-Disposition"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// API routes
	r.Route("/api", func(r chi.Router) {
		r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"status":"ok"}`))
		})

		r.Route("/sprints", func(r chi.Router) {
			r.Get("/", sprintHandler.GetAll)
			r.Post("/", sprintHandler.Create)
			r.Get("/{id}", sprintHandler.GetByID)
			r.Put("/{id}", sprintHandler.Update)
			r.Delete("/{id}", sprintHandler.Delete)
			r.Get("/{id}/cards", cardHandler.GetBySprintID)
			r.Post("/{id}/cards", cardHandler.CreateUnderSprint)
		})

		r.Route("/cards", func(r chi.Router) {
			r.Put("/{id}", cardHandler.Update)
			r.Delete("/{id}", cardHandler.Delete)
		})

		r.Route("/tasks", func(r chi.Router) {
			r.Get("/", taskHandler.GetAll)
			r.Post("/", taskHandler.Create)
			r.Get("/{id}", taskHandler.GetByID)
			r.Put("/{id}", taskHandler.Update)
			r.Delete("/{id}", taskHandler.Delete)
			r.Get("/{id}/comments", commentHandler.GetByTaskID)
			r.Post("/{id}/comments", commentHandler.Create)
			r.Post("/{id}/attachments", attachmentHandler.Upload)
		})

		r.Route("/attachments", func(r chi.Router) {
			r.Get("/{id}", attachmentHandler.GetByID)
			r.Delete("/{id}", attachmentHandler.Delete)
		})

		r.Route("/comments", func(r chi.Router) {
			r.Put("/{id}", commentHandler.Update)
			r.Delete("/{id}", commentHandler.Delete)
		})

		r.Get("/media/{filename}", attachmentHandler.ServeMedia)

		r.Route("/reports", func(r chi.Router) {
			r.Get("/burndown", reportHandler.GetBurndown)
			r.Get("/completions", reportHandler.GetCompletions)
			r.Get("/status-breakdown", reportHandler.GetStatusBreakdown)
			r.Get("/heatmap", reportHandler.GetHeatmap)
			r.Get("/velocity", reportHandler.GetVelocity)
			r.Get("/blocked-time", reportHandler.GetBlockedTime)
			r.Get("/work-split", reportHandler.GetWorkSplit)
		})

		r.Get("/backup", backupHandler.ExportBackup)
		r.Post("/restore", backupHandler.ImportRestore)
	})

	server := &http.Server{
		Addr:         ":" + port,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	// Server run context
	serverErrors := make(chan error, 1)
	go func() {
		log.Printf("Server listening on port %s", port)
		serverErrors <- server.ListenAndServe()
	}()

	// Graceful shutdown
	shutdown := make(chan os.Signal, 1)
	signal.Notify(shutdown, os.Interrupt, syscall.SIGTERM)

	select {
	case err := <-serverErrors:
		log.Fatalf("Error starting server: %v", err)

	case sig := <-shutdown:
		log.Printf("Shutdown signal %v received, gracefully shutting down...", sig)
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		if err := server.Shutdown(ctx); err != nil {
			log.Printf("Graceful shutdown failed, forcing close: %v", err)
			_ = server.Close()
		}
	}
	fmt.Println("Server terminated successfully")
}
