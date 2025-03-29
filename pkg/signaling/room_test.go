package signaling

import (
	"testing"
	"time"
)

func TestNewRoom(t *testing.T) {
	roomID := "test-room"
	room := NewRoom(roomID)

	if room == nil {
		t.Error("Expected room to be created, got nil")
	}
	if room.ID != roomID {
		t.Errorf("Expected room ID to be %s, got %s", roomID, room.ID)
	}
	if room.clients == nil {
		t.Error("Expected clients map to be initialized, got nil")
	}
	if len(room.clients) != 0 {
		t.Errorf("Expected empty clients map, got %d items", len(room.clients))
	}
	if room.broadcast == nil {
		t.Error("Expected broadcast channel to be initialized, got nil")
	}
}

func TestAddClient(t *testing.T) {
	room := NewRoom("test-room")
	client := &Client{ID: "test-client"}

	room.AddClient(client)

	if len(room.clients) != 1 {
		t.Errorf("Expected 1 client in the room, got %d", len(room.clients))
	}

	if c, exists := room.clients[client.ID]; !exists || c != client {
		t.Error("Expected client to be in the room's clients map")
	}
}

func TestRemoveClient(t *testing.T) {
	room := NewRoom("test-room")
	client := &Client{ID: "test-client"}

	// Add a client
	room.AddClient(client)

	// Remove the client
	room.RemoveClient(client.ID)

	if len(room.clients) != 0 {
		t.Errorf("Expected 0 clients after removal, got %d", len(room.clients))
	}

	// Try removing a non-existent client (should not cause errors)
	room.RemoveClient("non-existent-client")
}

func TestGetClients(t *testing.T) {
	room := NewRoom("test-room")

	// Initially, no clients should exist
	clients := room.GetClients()
	if len(clients) != 0 {
		t.Errorf("Expected 0 clients initially, got %d", len(clients))
	}

	// Add some clients
	client1 := &Client{ID: "client1"}
	client2 := &Client{ID: "client2"}
	room.AddClient(client1)
	room.AddClient(client2)

	// Should now have 2 clients
	clients = room.GetClients()
	if len(clients) != 2 {
		t.Errorf("Expected 2 clients, got %d", len(clients))
	}

	// Verify client IDs are in the list
	foundClient1 := false
	foundClient2 := false
	for _, c := range clients {
		if c.ID == "client1" {
			foundClient1 = true
		}
		if c.ID == "client2" {
			foundClient2 = true
		}
	}

	if !foundClient1 {
		t.Error("Expected to find client1 in clients list")
	}
	if !foundClient2 {
		t.Error("Expected to find client2 in clients list")
	}
}

func TestIsEmpty(t *testing.T) {
	room := NewRoom("test-room")

	// Initially, room should be empty
	if !room.IsEmpty() {
		t.Error("Expected room to be empty initially")
	}

	// Add a client
	client := &Client{ID: "test-client"}
	room.AddClient(client)

	// Room should no longer be empty
	if room.IsEmpty() {
		t.Error("Expected room to be non-empty after adding a client")
	}

	// Remove the client
	room.RemoveClient(client.ID)

	// Room should be empty again
	if !room.IsEmpty() {
		t.Error("Expected room to be empty after removing the client")
	}
}

func TestBroadcast(t *testing.T) {
	room := NewRoom("test-room")

	// Create a message
	msg := &Message{
		Type: "test",
		From: "sender",
		Data: map[string]interface{}{"key": "value"},
	}

	// Initially, there are no clients, so broadcast should not block
	room.Broadcast(msg, "")

	// Create a mock client with a channel to check if it received the message
	client := &Client{
		ID:   "test-client",
		send: make(chan *Message, 1),
	}

	// Add client to the room
	room.AddClient(client)

	// Broadcast a message
	room.Broadcast(msg, "")

	// Give the broadcast loop time to send the message
	time.Sleep(100 * time.Millisecond)

	// Check if the client received the message
	select {
	case received := <-client.send:
		if received.Type != "test" {
			t.Errorf("Expected message type 'test', got '%s'", received.Type)
		}
	default:
		t.Error("Expected client to receive the broadcast message")
	}
}
