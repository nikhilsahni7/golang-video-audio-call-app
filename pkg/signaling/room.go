package signaling

import (
	"sync"

	"github.com/nikhilsahni7/chat-video-app/pkg/util"
)

// Room represents a video/audio chat room
type Room struct {
	ID          string
	clients     map[string]*Client
	clientMutex sync.RWMutex
	broadcast   chan *Message
	hostID      string // Host client ID
}

// NewRoom creates a new chat room
func NewRoom(id string) *Room {
	room := &Room{
		ID:        id,
		clients:   make(map[string]*Client),
		broadcast: make(chan *Message, 100),
		hostID:    "", // No host initially
	}

	// Start broadcast handling
	go room.broadcastLoop()
	util.Info("Created new room: %s", id)
	return room
}

// AddClient adds a client to the room
func (r *Room) AddClient(client *Client) {
	r.clientMutex.Lock()
	defer r.clientMutex.Unlock()

	r.clients[client.ID] = client

	// If this is the first client and no host is set, make them the host
	if len(r.clients) == 1 && r.hostID == "" {
		r.hostID = client.ID
		client.SetHost(true)
		util.Info("Client %s automatically set as host for room %s", client.ID, r.ID)
	} else if r.hostID != "" {
		// If there's already a host, notify the new client
		client.Send(&Message{
			Type: "host-change",
			Data: map[string]interface{}{
				"hostId": r.hostID,
				"isHost": false,
			},
		})
	}

	util.Info("Client %s joined room %s", client.ID, r.ID)
}

// RemoveClient removes a client from the room
func (r *Room) RemoveClient(clientID string) {
	r.clientMutex.Lock()
	defer r.clientMutex.Unlock()

	if _, exists := r.clients[clientID]; exists {
		delete(r.clients, clientID)
		util.Info("Client %s left room %s", clientID, r.ID)

		// If the host left, assign a new host if there are other clients
		if clientID == r.hostID && len(r.clients) > 0 {
			// Pick the first client as the new host
			for newHostID := range r.clients {
				r.hostID = newHostID

				// Notify all clients about the new host
				r.broadcast <- &Message{
					Type: "host-change",
					Data: map[string]interface{}{
						"hostId": r.hostID,
					},
				}

				util.Info("New host assigned for room %s: %s", r.ID, r.hostID)
				break
			}
		}
	}
}

// SetHost explicitly sets a client as the host
func (r *Room) SetHost(clientID string) bool {
	r.clientMutex.Lock()
	defer r.clientMutex.Unlock()

	// Verify the client exists in this room
	if _, exists := r.clients[clientID]; !exists {
		util.Warn("Cannot set client %s as host: not in room %s", clientID, r.ID)
		return false
	}

	// Set the new host
	previousHost := r.hostID
	r.hostID = clientID

	// Set the host flag on the client
	if client, exists := r.clients[clientID]; exists {
		client.SetHost(true)
	}

	// Remove host status from previous host
	if previousHost != "" && previousHost != clientID {
		if prevHostClient, exists := r.clients[previousHost]; exists {
			prevHostClient.SetHost(false)
		}
	}

	// Notify all clients about the host change
	for _, client := range r.clients {
		client.Send(&Message{
			Type: "host-change",
			Data: map[string]interface{}{
				"hostId": r.hostID,
				"isHost": client.ID == r.hostID,
			},
		})
	}

	util.Info("Host changed for room %s: %s -> %s", r.ID, previousHost, r.hostID)
	return true
}

// GetHost returns the current host ID
func (r *Room) GetHost() string {
	r.clientMutex.RLock()
	defer r.clientMutex.RUnlock()
	return r.hostID
}

// GetClients returns all clients in the room
func (r *Room) GetClients() []*Client {
	r.clientMutex.RLock()
	defer r.clientMutex.RUnlock()

	clients := make([]*Client, 0, len(r.clients))
	for _, client := range r.clients {
		clients = append(clients, client)
	}
	return clients
}

// Broadcast sends a message to all clients in the room
func (r *Room) Broadcast(msg *Message, excludeClientID string) {
	// Log broadcast
	r.clientMutex.RLock()
	recipients := make([]string, 0, len(r.clients))
	for clientID := range r.clients {
		if clientID != excludeClientID {
			recipients = append(recipients, clientID)
		}
	}
	r.clientMutex.RUnlock()

	util.Debug("Room %s broadcasting message type %s to %d clients: %v",
		r.ID, msg.Type, len(recipients), recipients)

	// Send to all clients via the broadcast channel
	r.broadcast <- msg
}

// IsEmpty checks if the room has no clients
func (r *Room) IsEmpty() bool {
	r.clientMutex.RLock()
	defer r.clientMutex.RUnlock()
	return len(r.clients) == 0
}

// broadcastLoop handles broadcasting messages to all clients in the room
func (r *Room) broadcastLoop() {
	for msg := range r.broadcast {
		r.clientMutex.RLock()
		recipientCount := 0

		// Create a list of clients to send to (to avoid blocking during send)
		clientsToSend := make([]*Client, 0, len(r.clients))
		for _, client := range r.clients {
			// Skip the sender if specified
			if msg.From == client.ID && msg.From != "" {
				continue
			}
			clientsToSend = append(clientsToSend, client)
		}
		r.clientMutex.RUnlock()

		// Send to each client
		for _, client := range clientsToSend {
			client.Send(msg)
			recipientCount++
		}

		util.Debug("Broadcasted message type=%s from=%s to %d clients in room %s",
			msg.Type, msg.From, recipientCount, r.ID)
	}
}
