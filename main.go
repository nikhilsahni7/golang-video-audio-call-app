package main

import (
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/gorilla/websocket"
	"github.com/nikhilsahni7/chat-video-app/pkg/signaling"
	"github.com/nikhilsahni7/chat-video-app/pkg/util"
)

var (
	// Configure the upgrader
	upgrader = websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin: func(r *http.Request) bool {
			// Allow all connections for development
			return true
		},
	}

	// Create the signaling hub
	hub = signaling.NewHub()
)

// CORS middleware to allow requests from any origin (for development)
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Set CORS headers - allow all origins for testing
		origin := r.Header.Get("Origin")
		if origin == "" {
			origin = "*"
		}
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		w.Header().Set("Access-Control-Max-Age", "86400") // 24 hours

		// Handle preflight requests
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		// Pass down to the next handler
		next.ServeHTTP(w, r)
	})
}

func main() {
	// Initialize logger
	util.Init()

	// Setup signal handling for graceful shutdown
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	// Initialize server
	port := ":8080"
	util.Info("Starting server on %s", port)

	// Create a new router
	mux := http.NewServeMux()

	// Setup HTTP routes
	mux.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
		util.Debug("Health check requested from %s", r.RemoteAddr)
		w.Write([]byte("OK"))
	})
	mux.HandleFunc("/api/rooms", func(w http.ResponseWriter, r *http.Request) {
		util.Debug("Room list requested from %s", r.RemoteAddr)
		w.Header().Set("Content-Type", "application/json")
		activeRooms := hub.GetActiveRooms()

		// Format as JSON array
		w.Write([]byte("["))
		for i, room := range activeRooms {
			if i > 0 {
				w.Write([]byte(","))
			}
			w.Write([]byte("\"" + room + "\""))
		}
		w.Write([]byte("]"))

		util.Debug("Returned %d active rooms", len(activeRooms))
	})
	mux.HandleFunc("/ws", handleWebSocket)

	// Keep the old routes for backward compatibility
	mux.HandleFunc("/", handleHome)
	mux.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.Dir("static"))))

	// Apply CORS middleware
	handler := corsMiddleware(mux)

	// Start server in a goroutine
	go func() {
		if err := http.ListenAndServe(port, handler); err != nil {
			util.Fatal("Error starting server: %v", err)
		}
	}()

	// Wait for shutdown signal
	<-stop
	util.Info("Shutting down server...")
}

// handleHome serves the home page
func handleHome(w http.ResponseWriter, r *http.Request) {
	util.Debug("Home page requested from %s", r.RemoteAddr)
	w.Header().Set("Content-Type", "text/html")
	w.Write([]byte(`
		<!DOCTYPE html>
		<html>
		<head>
			<title>WebRTC Video/Audio Chat</title>
			<meta name="viewport" content="width=device-width, initial-scale=1">
			<link rel="stylesheet" href="/static/styles.css">
		</head>
		<body>
			<div class="container">
				<h1>WebRTC Video/Audio Chat</h1>
				<div class="room-controls">
					<input id="roomId" type="text" placeholder="Room ID" value="default-room">
					<button id="joinBtn">Join Room</button>
				</div>
				<div class="video-container">
					<div class="local-video-container">
						<h3>Local Stream</h3>
						<video id="localVideo" autoplay muted playsinline></video>
						<div class="peer-label">You</div>
					</div>
					<div id="remoteVideos"></div>
				</div>
				<div class="controls">
					<button id="audioBtn">Mute Audio</button>
					<button id="videoBtn">Turn Off Video</button>
				</div>
				<div id="status">Not connected</div>
			</div>
			<script src="/static/app.js"></script>
		</body>
		</html>
	`))
}

// handleWebSocket handles WebSocket connections for signaling
func handleWebSocket(w http.ResponseWriter, r *http.Request) {
	// Get the room ID from the query parameters
	roomID := r.URL.Query().Get("roomId")
	if roomID == "" {
		roomID = "default-room"
	}

	// Check if the client is joining as a host
	isHost := r.URL.Query().Get("isHost") == "true"

	// Check for debug mode (testing on same machine)
	isDebug := r.URL.Query().Get("debug") == "true"

	// Generate a unique client ID
	clientID := generateClientID()
	if isDebug {
		// For same-machine testing, add a random suffix to ensure uniqueness
		clientID = fmt.Sprintf("%s-%d", clientID, time.Now().UnixNano()%1000)
	}

	// Create log message with role information
	role := "participant"
	if isHost {
		role = "host"
	}

	util.Info("New WebSocket connection attempt: client %s for room %s as %s from %s",
		clientID, roomID, role, r.RemoteAddr)

	// Upgrade the HTTP connection to a WebSocket
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		util.Error("Error upgrading to WebSocket: %v", err)
		return
	}

	// Create a new client with host status
	signaling.NewClient(clientID, conn, hub, roomID)

	// Set host status if applicable
	if isHost {
		room := hub.GetRoom(roomID)
		if room != nil {
			room.SetHost(clientID)
			util.Info("Client %s set as host for room %s", clientID, roomID)
		}
	}

	util.Info("WebSocket connection established: client %s in room %s", clientID, roomID)
}

// generateClientID creates a unique ID for a client
func generateClientID() string {
	return "user-" + strings.ReplaceAll(time.Now().Format("20060102150405.000000"), ".", "") + "-" +
		strings.ReplaceAll(time.Now().String()[20:], ".", "")
}
