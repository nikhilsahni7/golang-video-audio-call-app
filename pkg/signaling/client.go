package signaling

import (
	"encoding/json"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/nikhilsahni7/chat-video-app/pkg/util"
)

const (
	// Time allowed to write a message to the peer
	writeWait = 10 * time.Second

	// Time allowed to read the next pong message from the peer
	pongWait = 60 * time.Second

	// Send pings to peer with this period
	pingPeriod = (pongWait * 9) / 10

	// Maximum message size allowed from peer
	maxMessageSize = 10000
)

// Client represents a connected WebRTC client
type Client struct {
	ID         string
	Room       *Room
	conn       *websocket.Conn
	send       chan *Message
	hub        *Hub
	isHost     bool
	closedOnce sync.Once
	closed     bool
	mutex      sync.Mutex
}

// NewClient creates a new client and starts its message handling
func NewClient(id string, conn *websocket.Conn, hub *Hub, roomID string) *Client {
	// Get or create the room
	room := hub.GetRoom(roomID)

	// Create the client
	client := &Client{
		ID:     id,
		Room:   room,
		conn:   conn,
		send:   make(chan *Message, 100),
		hub:    hub,
		isHost: false, // Default to non-host
	}

	// Add the client to the room
	room.AddClient(client)

	// Start goroutines for reading and writing
	go client.readPump()
	go client.writePump()

	// Send a welcome message to the client
	client.Send(&Message{
		Type: "welcome",
		To:   id,
		Data: map[string]interface{}{
			"roomId":   roomID,
			"clientId": id,
			"isHost":   client.isHost,
		},
	})

	// Send the current user list to this client
	currentClients := room.GetClients()
	userList := make([]string, 0, len(currentClients))
	for _, c := range currentClients {
		if c.ID != id { // Don't include self in the list
			userList = append(userList, c.ID)
		}
	}

	// Send user list even if empty so the client knows there are no other users
	client.Send(&Message{
		Type: "user-list",
		To:   id,
		Data: map[string]interface{}{
			"users": userList,
		},
	})

	// Notify other clients that a new client has joined
	joinMessage := &Message{
		Type: "user-joined",
		From: id,
		Data: map[string]interface{}{
			"clientId": id,
			"isHost":   client.isHost,
		},
	}

	// Broadcast to all room participants
	util.Info("Broadcasting user-joined message for client %s to %d other clients", id, len(currentClients)-1)
	room.Broadcast(joinMessage, id) // Don't send to self

	// Log clients in room after join
	util.Info("Room %s now has %d clients", roomID, len(room.GetClients()))

	return client
}

// SetHost sets the host status for this client
func (c *Client) SetHost(isHost bool) {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	if c.isHost == isHost {
		return // No change needed
	}

	c.isHost = isHost

	// Notify the client about their host status
	c.Send(&Message{
		Type: "host-status",
		To:   c.ID,
		Data: map[string]interface{}{
			"isHost": isHost,
		},
	})

	// Notify other clients about the host change
	c.Room.Broadcast(&Message{
		Type: "host-change",
		From: c.ID,
		Data: map[string]interface{}{
			"hostId": c.ID,
			"isHost": isHost,
		},
	}, c.ID) // Don't send to self
}

// Send sends a message to the client
func (c *Client) Send(msg *Message) {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	if c.closed {
		return
	}

	select {
	case c.send <- msg:
	default:
		// Buffer full, close connection
		util.Warn("Message buffer full for client %s, closing connection", c.ID)
		c.Close()
	}
}

// Close closes the client connection
func (c *Client) Close() {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	if c.closed {
		return
	}

	c.closed = true

	// Notify other clients in the room about the disconnection
	if c.Room != nil {
		util.Info("Sending user-left message for client %s in room %s", c.ID, c.Room.ID)
		leaveMsg := &Message{
			Type: "user-left",
			From: c.ID,
			Data: map[string]interface{}{
				"userId": c.ID,
			},
		}
		// Don't exclude the current client as we're closing the connection anyway
		c.Room.Broadcast(leaveMsg, "")
	}

	// Close channels and connection
	close(c.send)
	c.conn.Close()

	// Remove client from room
	if c.Room != nil {
		c.Room.RemoveClient(c.ID)

		// Check if room is empty and remove it
		if c.Room.IsEmpty() {
			c.hub.RemoveRoom(c.Room.ID)
		}
	}

	util.Info("Client %s disconnected", c.ID)
}

// readPump pumps messages from the websocket to the hub
func (c *Client) readPump() {
	defer c.Close()

	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, rawMsg, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				util.Error("WebSocket read error for client %s: %v", c.ID, err)
			} else {
				util.Debug("WebSocket connection closed for client %s: %v", c.ID, err)
			}
			break
		}

		var msg Message
		if err := json.Unmarshal(rawMsg, &msg); err != nil {
			util.Error("Error parsing message from client %s: %v", c.ID, err)
			continue
		}

		// Set the sender ID
		msg.From = c.ID

		// Handle the message based on its type
		switch msg.Type {
		case "offer", "answer", "ice-candidate":
			// For WebRTC signaling, broadcast to the room
			util.Debug("Received %s from client %s", msg.Type, c.ID)
			c.Room.Broadcast(&msg, c.ID)
		case "chat":
			// For chat messages, broadcast to the room
			util.Debug("Received chat message from client %s", c.ID)
			c.Room.Broadcast(&msg, "")
		case "join":
			// Client joining, notify others in the room
			util.Info("Client %s joining room %s", c.ID, c.Room.ID)
			joinMsg := &Message{
				Type: "user-joined",
				From: c.ID,
				To:   "",
				Data: map[string]interface{}{
					"userId": c.ID,
				},
			}
			c.Room.Broadcast(joinMsg, c.ID)

			// Send list of existing users to the new client
			userList := []string{}
			for _, client := range c.Room.GetClients() {
				if client.ID != c.ID {
					userList = append(userList, client.ID)
				}
			}

			util.Debug("Sending user list to client %s: %v", c.ID, userList)
			c.Send(&Message{
				Type: "user-list",
				To:   c.ID,
				Data: map[string]interface{}{
					"users": userList,
				},
			})
		default:
			util.Warn("Received unknown message type '%s' from client %s", msg.Type, c.ID)
		}
	}
}

// writePump pumps messages from the hub to the websocket connection
func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.Close()
	}()

	for {
		select {
		case msg, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				// The hub closed the channel
				util.Debug("Send channel closed for client %s", c.ID)
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			data, err := json.Marshal(msg)
			if err != nil {
				util.Error("Error marshaling message for client %s: %v", c.ID, err)
				continue
			}

			if err := c.conn.WriteMessage(websocket.TextMessage, data); err != nil {
				util.Warn("Error writing to websocket for client %s: %v", c.ID, err)
				return
			}
		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				util.Debug("Error sending ping to client %s: %v", c.ID, err)
				return
			}
		}
	}
}
