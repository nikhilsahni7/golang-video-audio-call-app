package signaling

import (
	"sync"

	"github.com/nikhilsahni7/chat-video-app/pkg/util"
)

// Hub maintains active rooms and manages participants
type Hub struct {
	// Registered rooms with their participants
	rooms      map[string]*Room
	roomsMutex sync.RWMutex
}

// NewHub creates a new Hub instance
func NewHub() *Hub {
	hub := &Hub{
		rooms: make(map[string]*Room),
	}
	util.Info("Hub initialized")
	return hub
}

// GetRoom returns a room by ID, creating it if it doesn't exist
func (h *Hub) GetRoom(roomID string) *Room {
	h.roomsMutex.Lock()
	defer h.roomsMutex.Unlock()

	room, exists := h.rooms[roomID]
	if !exists {
		room = NewRoom(roomID)
		h.rooms[roomID] = room
		util.Info("Created new room: %s", roomID)
	}
	return room
}

// RemoveRoom removes a room when it's empty
func (h *Hub) RemoveRoom(roomID string) {
	h.roomsMutex.Lock()
	defer h.roomsMutex.Unlock()

	if room, exists := h.rooms[roomID]; exists {
		if room.IsEmpty() {
			delete(h.rooms, roomID)
			util.Info("Removed empty room: %s", roomID)
		}
	}
}

// GetActiveRooms returns a list of active room IDs
func (h *Hub) GetActiveRooms() []string {
	h.roomsMutex.RLock()
	defer h.roomsMutex.RUnlock()

	rooms := make([]string, 0, len(h.rooms))
	for id := range h.rooms {
		rooms = append(rooms, id)
	}
	util.Debug("GetActiveRooms returning %d rooms", len(rooms))
	return rooms
}
