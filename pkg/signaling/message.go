package signaling

// Message represents a communication between clients
type Message struct {
	// Type of message: "offer", "answer", "ice-candidate", "chat", "join", etc.
	Type string `json:"type"`

	// Sender's ID
	From string `json:"from,omitempty"`

	// Recipient's ID, empty for broadcasts
	To string `json:"to,omitempty"`

	// Message content, depends on the message type
	Data map[string]interface{} `json:"data,omitempty"`

	// Host status indication
	IsHost bool `json:"isHost,omitempty"`
}
