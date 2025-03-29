// Chat Video App - WebRTC Client

class VideoChat {
  constructor() {
    this.localStream = null;
    this.peerConnections = {};
    this.socket = null;
    this.roomId = "default-room";
    this.clientId = null;

    // ICE servers for WebRTC (STUN/TURN)
    this.iceServers = {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    };

    // DOM elements
    this.elements = {
      localVideo: document.getElementById("localVideo"),
      remoteVideos: document.getElementById("remoteVideos"),
      roomIdInput: document.getElementById("roomId"),
      joinButton: document.getElementById("joinBtn"),
      audioButton: document.getElementById("audioBtn"),
      videoButton: document.getElementById("videoBtn"),
      statusDiv: document.getElementById("status"),
    };

    // Initialize
    this.addEventListeners();
  }

  addEventListeners() {
    // Join room button
    this.elements.joinButton.addEventListener("click", () => {
      this.roomId = this.elements.roomIdInput.value || "default-room";
      this.joinRoom();
    });

    // Mute/unmute audio
    this.elements.audioButton.addEventListener("click", () => {
      if (this.localStream) {
        const audioTracks = this.localStream.getAudioTracks();
        if (audioTracks.length > 0) {
          const enabled = !audioTracks[0].enabled;
          audioTracks[0].enabled = enabled;
          this.elements.audioButton.textContent = enabled
            ? "Mute Audio"
            : "Unmute Audio";
        }
      }
    });

    // Toggle video
    this.elements.videoButton.addEventListener("click", () => {
      if (this.localStream) {
        const videoTracks = this.localStream.getVideoTracks();
        if (videoTracks.length > 0) {
          const enabled = !videoTracks[0].enabled;
          videoTracks[0].enabled = enabled;
          this.elements.videoButton.textContent = enabled
            ? "Turn Off Video"
            : "Turn On Video";
        }
      }
    });
  }

  // Connect to the signaling server
  connectSocket() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws?roomId=${this.roomId}`;

    this.socket = new WebSocket(wsUrl);

    this.socket.onopen = () => {
      this.updateStatus("Connected to server");
      this.sendJoinMessage();
    };

    this.socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleSignalingMessage(message);
    };

    this.socket.onerror = (error) => {
      this.updateStatus(`WebSocket error: ${error}`);
      console.error("WebSocket error:", error);
    };

    this.socket.onclose = () => {
      this.updateStatus("Disconnected from server");
      // Try to reconnect after a delay
      setTimeout(() => {
        if (this.socket.readyState === WebSocket.CLOSED) {
          this.connectSocket();
        }
      }, 5000);
    };
  }

  // Send a join message to the server
  sendJoinMessage() {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(
        JSON.stringify({
          type: "join",
          data: { roomId: this.roomId },
        })
      );
    }
  }

  // Join a room and start video chat
  async joinRoom() {
    try {
      // Get local media stream
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });

      // Display local video
      this.elements.localVideo.srcObject = this.localStream;

      // Connect to signaling server
      this.connectSocket();

      this.updateStatus("Joined room: " + this.roomId);
    } catch (error) {
      this.updateStatus(`Error accessing media devices: ${error.message}`);
      console.error("Error accessing media devices:", error);
    }
  }

  // Handle incoming signaling messages
  handleSignalingMessage(message) {
    switch (message.type) {
      case "user-joined":
        this.handleUserJoined(message.from);
        break;
      case "user-list":
        this.handleUserList(message.data.users);
        break;
      case "offer":
        this.handleOffer(message);
        break;
      case "answer":
        this.handleAnswer(message);
        break;
      case "ice-candidate":
        this.handleIceCandidate(message);
        break;
      default:
        console.log("Unknown message type:", message.type);
    }
  }

  // When a new user joins, create an offer
  handleUserJoined(userId) {
    this.createPeerConnection(userId);
    this.createOffer(userId);
  }

  // Initialize connections with existing users
  handleUserList(users) {
    users.forEach((userId) => {
      this.createPeerConnection(userId);
    });
  }

  // Create RTCPeerConnection for a user
  createPeerConnection(userId) {
    if (this.peerConnections[userId]) {
      console.log(`Connection to ${userId} already exists`);
      return;
    }

    const peerConnection = new RTCPeerConnection(this.iceServers);
    this.peerConnections[userId] = peerConnection;

    // Add local stream to peer connection
    this.localStream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, this.localStream);
    });

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignalingMessage({
          type: "ice-candidate",
          to: userId,
          data: {
            candidate: event.candidate,
          },
        });
      }
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      console.log(
        `Connection state with ${userId}: ${peerConnection.connectionState}`
      );
    };

    // Handle remote streams
    peerConnection.ontrack = (event) => {
      // Create or get video element for this peer
      let videoElement = document.getElementById(`remote-video-${userId}`);

      if (!videoElement) {
        const peerContainer = document.createElement("div");
        peerContainer.className = "remote-peer";

        videoElement = document.createElement("video");
        videoElement.id = `remote-video-${userId}`;
        videoElement.autoplay = true;
        videoElement.playsInline = true;

        const peerLabel = document.createElement("div");
        peerLabel.className = "peer-label";
        peerLabel.textContent = `User: ${userId}`;

        peerContainer.appendChild(videoElement);
        peerContainer.appendChild(peerLabel);
        this.elements.remoteVideos.appendChild(peerContainer);
      }

      // Set the stream as the source for the video element
      if (videoElement.srcObject !== event.streams[0]) {
        videoElement.srcObject = event.streams[0];
      }
    };

    console.log(`Created peer connection for ${userId}`);
    return peerConnection;
  }

  // Create and send an offer to a peer
  async createOffer(userId) {
    const peerConnection = this.peerConnections[userId];
    if (!peerConnection) return;

    try {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      this.sendSignalingMessage({
        type: "offer",
        to: userId,
        data: {
          sdp: peerConnection.localDescription,
        },
      });
    } catch (error) {
      console.error("Error creating offer:", error);
    }
  }

  // Handle incoming offer
  async handleOffer(message) {
    const userId = message.from;
    const peerConnection = this.createPeerConnection(userId);

    try {
      await peerConnection.setRemoteDescription(
        new RTCSessionDescription(message.data.sdp)
      );
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      this.sendSignalingMessage({
        type: "answer",
        to: userId,
        data: {
          sdp: peerConnection.localDescription,
        },
      });
    } catch (error) {
      console.error("Error handling offer:", error);
    }
  }

  // Handle incoming answer
  async handleAnswer(message) {
    const userId = message.from;
    const peerConnection = this.peerConnections[userId];

    if (peerConnection) {
      try {
        await peerConnection.setRemoteDescription(
          new RTCSessionDescription(message.data.sdp)
        );
      } catch (error) {
        console.error("Error handling answer:", error);
      }
    }
  }

  // Handle incoming ICE candidates
  async handleIceCandidate(message) {
    const userId = message.from;
    const peerConnection = this.peerConnections[userId];

    if (peerConnection) {
      try {
        await peerConnection.addIceCandidate(
          new RTCIceCandidate(message.data.candidate)
        );
      } catch (error) {
        console.error("Error adding ICE candidate:", error);
      }
    }
  }

  // Send signaling message through WebSocket
  sendSignalingMessage(message) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  // Update status display
  updateStatus(message) {
    this.elements.statusDiv.textContent = message;
  }
}

// Initialize when the document is loaded
document.addEventListener("DOMContentLoaded", () => {
  window.videoChat = new VideoChat();
});
