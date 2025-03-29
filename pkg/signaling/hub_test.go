package signaling

import (
	"testing"
)

func TestNewHub(t *testing.T) {
	hub := NewHub()
	if hub == nil {
		t.Error("Expected hub to be created, got nil")
	}
	if hub.rooms == nil {
		t.Error("Expected rooms map to be initialized, got nil")
	}
	if len(hub.rooms) != 0 {
		t.Errorf("Expected empty rooms map, got %d items", len(hub.rooms))
	}
}

func TestGetRoom(t *testing.T) {
	hub := NewHub()
	roomID := "test-room"

	// First call should create a new room
	room := hub.GetRoom(roomID)
	if room == nil {
		t.Error("Expected room to be created, got nil")
	}
	if room.ID != roomID {
		t.Errorf("Expected room ID to be %s, got %s", roomID, room.ID)
	}

	// Second call should return the same room
	room2 := hub.GetRoom(roomID)
	if room != room2 {
		t.Error("Expected to get the same room instance on second call")
	}

	// Different room ID should create a new room
	otherRoomID := "other-room"
	otherRoom := hub.GetRoom(otherRoomID)
	if otherRoom == nil {
		t.Error("Expected other room to be created, got nil")
	}
	if otherRoom == room {
		t.Error("Expected other room to be a different instance")
	}
	if otherRoom.ID != otherRoomID {
		t.Errorf("Expected other room ID to be %s, got %s", otherRoomID, otherRoom.ID)
	}
}

func TestRemoveRoom(t *testing.T) {
	hub := NewHub()
	roomID := "test-room"

	// Create a room
	room := hub.GetRoom(roomID)

	// Add a mock client to make the room non-empty
	client := &Client{ID: "test-client"}
	room.AddClient(client)

	// Try to remove non-empty room - should not be removed
	hub.RemoveRoom(roomID)
	if _, exists := hub.rooms[roomID]; !exists {
		t.Error("Non-empty room was removed, expected it to remain")
	}

	// Remove the client, making the room empty
	room.RemoveClient(client.ID)

	// Now the room should be removed
	hub.RemoveRoom(roomID)
	if _, exists := hub.rooms[roomID]; exists {
		t.Error("Empty room was not removed, expected it to be gone")
	}
}

func TestGetActiveRooms(t *testing.T) {
	hub := NewHub()

	// Initially, no rooms should exist
	rooms := hub.GetActiveRooms()
	if len(rooms) != 0 {
		t.Errorf("Expected 0 active rooms initially, got %d", len(rooms))
	}

	// Create some rooms
	room1 := hub.GetRoom("room1")
	room2 := hub.GetRoom("room2")
	_ = room1 // Use variables to avoid unused warning
	_ = room2

	// Should now have 2 active rooms
	rooms = hub.GetActiveRooms()
	if len(rooms) != 2 {
		t.Errorf("Expected 2 active rooms, got %d", len(rooms))
	}

	// Verify room IDs are in the list
	foundRoom1 := false
	foundRoom2 := false
	for _, id := range rooms {
		if id == "room1" {
			foundRoom1 = true
		}
		if id == "room2" {
			foundRoom2 = true
		}
	}

	if !foundRoom1 {
		t.Error("Expected to find room1 in active rooms list")
	}
	if !foundRoom2 {
		t.Error("Expected to find room2 in active rooms list")
	}
}
