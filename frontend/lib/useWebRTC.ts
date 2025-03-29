"use client";

import { useCallback, useEffect, useRef } from "react";
import { useVideoCallStore } from "./store";

// Types
interface SignalingMessage {
  type: string;
  to?: string;
  from?: string;
  data?: {
    roomId?: string;
    sdp?: RTCSessionDescriptionInit;
    candidate?: RTCIceCandidate;
    users?: string[];
    isHost?: boolean;
    hostId?: string;
  };
}

// Configuration for WebRTC
const rtcConfig = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
    { urls: "stun:stun.stunprotocol.org:3478" },
    { urls: "stun:stun.voiparound.com:3478" },
    { urls: "stun:stun.schlund.de:3478" },
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443?transport=tcp",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:turn.nextcloud.com:443?transport=tcp",
      username: "nextcloud",
      credential: "nextcloud",
    },
  ],
  iceCandidatePoolSize: 10,
  bundlePolicy: "max-bundle" as RTCBundlePolicy,
  iceTransportPolicy: "all" as RTCIceTransportPolicy,
  rtcpMuxPolicy: "require" as RTCRtcpMuxPolicy,
  sdpSemantics: "unified-plan" as "unified-plan" | "plan-b",
};

export function useWebRTC() {
  // Get state and actions from the store
  const {
    roomId,
    localStream,
    socket,
    peers,
    clientId,
    connected,
    isAudioEnabled,
    isVideoEnabled,

    setLocalStream,
    setSocket,
    setClientId,
    setConnected,
    setRoomId,
    setIsHost,

    addPeer,
    updatePeer,
    removePeer,

    toggleAudio,
    toggleVideo,
    disconnect,
  } = useVideoCallStore();

  // Use a ref to maintain references across renders
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());

  // Send a message through the signaling channel
  const sendSignalingMessage = useCallback(
    (message: SignalingMessage) => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message));
      } else {
        console.warn("Cannot send message, WebSocket is not open");
      }
    },
    [socket]
  );

  // Create and send an offer to a peer
  const createOffer = useCallback(
    async (peerId: string, peerConnection: RTCPeerConnection) => {
      try {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        if (peerConnection.localDescription) {
          sendSignalingMessage({
            type: "offer",
            to: peerId,
            data: { sdp: peerConnection.localDescription },
          });
        }
      } catch (error) {
        console.error("Error creating offer:", error);
      }
    },
    [sendSignalingMessage]
  );

  // Remove a peer connection
  const removePeerConnection = useCallback(
    (peerId: string) => {
      const peerConnection = peerConnectionsRef.current.get(peerId);

      if (peerConnection) {
        peerConnection.close();
        peerConnectionsRef.current.delete(peerId);
        removePeer(peerId);
      }
    },
    [removePeer]
  );

  // Create a peer connection to a remote peer
  const createPeerConnection = useCallback(
    (peerId: string) => {
      if (!peerId) {
        console.error("Cannot create peer connection with empty peer ID");
        return undefined;
      }

      if (peerConnectionsRef.current.has(peerId)) {
        console.log(`Connection to ${peerId} already exists`);
        return peerConnectionsRef.current.get(peerId);
      }

      console.log(`Creating new peer connection to ${peerId}`);

      try {
        // Create new RTCPeerConnection with advanced options
        const peerConnection = new RTCPeerConnection({
          ...rtcConfig,
          // Add mdns candidate generation for local machine testing
          iceServers: rtcConfig.iceServers,
        });

        // Enable trickle ICE
        peerConnection.onicecandidate = (event) => {
          if (!event.candidate) {
            console.log(`ICE candidate gathering complete for ${peerId}`);
            return;
          }

          console.log(
            `Generated ICE candidate for ${peerId}:`,
            event.candidate.candidate.substring(0, 50) + "..."
          );

          // Send ICE candidate to the peer immediately
          const candidate = event.candidate as RTCIceCandidate;
          sendSignalingMessage({
            type: "ice-candidate",
            to: peerId,
            data: { candidate },
          });
        };

        // Add to our maps
        peerConnectionsRef.current.set(peerId, peerConnection);

        // Ensure we have local stream before continuing
        const currentLocalStream =
          localStream || useVideoCallStore.getState().localStream;

        // Add all local tracks to the connection
        if (currentLocalStream) {
          // Log what we're adding
          const videoTracks = currentLocalStream.getVideoTracks();
          const audioTracks = currentLocalStream.getAudioTracks();
          console.log(
            `Adding ${videoTracks.length} video tracks and ${audioTracks.length} audio tracks to connection with ${peerId}`
          );

          try {
            // Try adding all tracks at once first
            currentLocalStream.getTracks().forEach((track) => {
              try {
                console.log(
                  `Adding ${track.kind} track (${track.id}) to peer ${peerId}`
                );
                peerConnection.addTrack(track, currentLocalStream);
              } catch (err) {
                console.error(`Error adding ${track.kind} track:`, err);
              }
            });

            // Mark as connecting in store
            updatePeer(peerId, {
              isConnecting: true,
              connectionState: "connecting",
            });
          } catch (err) {
            console.error(`Error adding tracks to peer connection:`, err);
          }
        } else {
          console.warn(
            "No local stream available when creating peer connection with peer:",
            peerId
          );
        }

        // ICE connection state changes
        peerConnection.oniceconnectionstatechange = () => {
          const state = peerConnection.iceConnectionState;
          console.log(`ICE connection state with ${peerId}: ${state}`);

          updatePeer(peerId, {
            connectionState: peerConnection.connectionState,
            isConnecting: peerConnection.connectionState !== "connected",
          });

          if (state === "connected" || state === "completed") {
            console.log(`ICE connection established with ${peerId}`);
          } else if (state === "failed") {
            console.log(`Attempting to restart ICE for peer ${peerId}`);
            peerConnection.restartIce();
          } else if (state === "disconnected") {
            console.log(
              `ICE connection disconnected with ${peerId}, waiting for reconnection...`
            );
            // Allow some time for reconnection before cleaning up
            setTimeout(() => {
              if (peerConnection.iceConnectionState === "disconnected") {
                console.log(
                  `Connection with ${peerId} still disconnected, cleaning up`
                );
                removePeerConnection(peerId);
              }
            }, 10000); // 10 seconds timeout
          }
        };

        // Connection state changes
        peerConnection.onconnectionstatechange = () => {
          console.log(
            `Connection state with ${peerId}: ${peerConnection.connectionState}`
          );

          updatePeer(peerId, {
            connectionState: peerConnection.connectionState,
            isConnecting: peerConnection.connectionState !== "connected",
          });

          if (peerConnection.connectionState === "connected") {
            console.log(
              `Peer connection with ${peerId} established successfully`
            );
          } else if (
            peerConnection.connectionState === "disconnected" ||
            peerConnection.connectionState === "failed" ||
            peerConnection.connectionState === "closed"
          ) {
            console.log(
              `Peer connection with ${peerId} is no longer active, cleaning up`
            );
            removePeerConnection(peerId);
          }
        };

        // Negotiation needed event - important for renegotiation
        peerConnection.onnegotiationneeded = async () => {
          console.log(`Negotiation needed for peer ${peerId}`);

          // Only the host or the peer with the "lower" ID creates offers to avoid collision
          const currentIsHost = useVideoCallStore.getState().isHost;
          const currentClientId = useVideoCallStore.getState().clientId;

          if (
            currentIsHost ||
            (currentClientId &&
              peerId &&
              currentClientId.localeCompare(peerId) < 0)
          ) {
            try {
              await createOffer(peerId, peerConnection);
            } catch (error) {
              console.error(`Error during negotiation with ${peerId}:`, error);
            }
          }
        };

        // Listen for remote tracks
        peerConnection.ontrack = (event) => {
          console.log(
            `Received ${event.track.kind} track from ${peerId}`,
            event
          );

          // Make sure we have a stream associated with this track
          if (event.streams && event.streams[0]) {
            const remoteStream = event.streams[0];
            console.log(
              `Updating peer ${peerId} with stream ID: ${remoteStream.id}, track ${event.track.kind}`
            );

            // Check the stream's active status and available tracks
            const hasVideoTracks = remoteStream.getVideoTracks().length > 0;
            const hasAudioTracks = remoteStream.getAudioTracks().length > 0;
            const isStreamActive = remoteStream.active;

            console.log(
              `Stream from ${peerId} - active: ${isStreamActive}, video tracks: ${hasVideoTracks}, audio tracks: ${hasAudioTracks}`
            );

            // This ensures we get all tracks (audio and video)
            updatePeer(peerId, {
              stream: remoteStream,
              isConnecting: false,
            });

            // Setup track ended handler
            event.track.onended = () => {
              console.log(
                `Remote ${event.track.kind} track from ${peerId} ended`
              );

              // If it's a video track, check if there are any video tracks left
              if (event.track.kind === "video") {
                const remainingVideoTracks = remoteStream
                  .getVideoTracks()
                  .filter((track) => track.readyState === "live");

                if (remainingVideoTracks.length === 0) {
                  console.log(`No remaining video tracks for peer ${peerId}`);
                }
              }
            };

            // Setup track mute/unmute handler
            event.track.onmute = () => {
              console.log(
                `Remote ${event.track.kind} track from ${peerId} muted`
              );
            };

            event.track.onunmute = () => {
              console.log(
                `Remote ${event.track.kind} track from ${peerId} unmuted`
              );
            };
          } else {
            console.warn(
              `Received track event without associated stream from ${peerId}`
            );
          }
        };

        // Add to store so the UI can be updated
        addPeer(peerId, undefined, peerConnection);

        return peerConnection;
      } catch (error) {
        console.error(`Error creating peer connection for ${peerId}:`, error);
        return undefined;
      }
    },
    [
      localStream,
      addPeer,
      updatePeer,
      sendSignalingMessage,
      removePeerConnection,
      createOffer,
    ]
  );

  // Handle an incoming offer
  const handleOffer = useCallback(
    async (message: SignalingMessage) => {
      if (!message.from) {
        console.error("Received offer without sender ID");
        return;
      }

      const peerId = message.from;
      console.log(`Processing offer from peer ${peerId}`);

      try {
        // Create a connection if it doesn't exist
        let peerConnection = peerConnectionsRef.current.get(peerId);
        if (!peerConnection) {
          console.log(`No existing connection for ${peerId}, creating new one`);
          peerConnection = createPeerConnection(peerId);
          if (!peerConnection) {
            console.error(`Failed to create peer connection for ${peerId}`);
            return;
          }
        }

        if (!message.data?.sdp) {
          console.error(`Offer from ${peerId} missing SDP`);
          return;
        }

        const offerSdp = new RTCSessionDescription(message.data.sdp);

        // Check if we're in a compatible state to set remote description
        const signalingState = peerConnection.signalingState;
        console.log(`Current signaling state for ${peerId}: ${signalingState}`);

        if (
          signalingState === "stable" ||
          signalingState === "have-local-offer"
        ) {
          console.log(`Setting remote description (offer) for ${peerId}`);
          await peerConnection.setRemoteDescription(offerSdp);

          console.log(`Creating answer for ${peerId}`);
          const answer = await peerConnection.createAnswer();

          console.log(`Setting local description (answer) for ${peerId}`);
          await peerConnection.setLocalDescription(answer);

          // Send the answer
          sendSignalingMessage({
            type: "answer",
            to: peerId,
            data: { sdp: peerConnection.localDescription || undefined },
          });

          // Update peer connection state in store
          updatePeer(peerId, { isConnecting: false });

          console.log(`Answer sent to ${peerId}`);
        } else {
          console.warn(
            `Cannot process offer in signaling state: ${signalingState}`
          );
        }
      } catch (error) {
        console.error(`Error handling offer from ${peerId}:`, error);
      }
    },
    [createPeerConnection, sendSignalingMessage, updatePeer]
  );

  // Handle an incoming answer
  const handleAnswer = useCallback(async (message: SignalingMessage) => {
    if (!message.from) {
      console.error("Received answer without sender ID");
      return;
    }

    const peerId = message.from;
    console.log(`Processing answer from peer ${peerId}`);

    try {
      const peerConnection = peerConnectionsRef.current.get(peerId);

      if (!peerConnection) {
        console.error(`No connection found for peer ${peerId}`);
        return;
      }

      if (!message.data?.sdp) {
        console.error(`Answer from ${peerId} missing SDP`);
        return;
      }

      const answerSdp = new RTCSessionDescription(message.data.sdp);

      // Check signaling state before setting remote description
      const signalingState = peerConnection.signalingState;
      console.log(`Current signaling state for ${peerId}: ${signalingState}`);

      if (signalingState === "have-local-offer") {
        console.log(`Setting remote description (answer) for ${peerId}`);
        await peerConnection.setRemoteDescription(answerSdp);
        console.log(`Connection setup complete for ${peerId}`);
      } else {
        console.warn(
          `Cannot process answer in signaling state: ${signalingState}`
        );

        // If in stable state, might be a late answer, try to apply it anyway
        if (signalingState === "stable") {
          console.log(`Attempting to apply late answer from ${peerId}`);
          await peerConnection.setRemoteDescription(answerSdp);
        }
      }
    } catch (error) {
      console.error(`Error handling answer from ${peerId}:`, error);
    }
  }, []);

  // Handle an incoming ICE candidate
  const handleIceCandidate = useCallback(async (message: SignalingMessage) => {
    if (!message.from) {
      console.error("Received ICE candidate without sender ID");
      return;
    }

    const peerId = message.from;
    console.log(`Processing ICE candidate from peer ${peerId}`);

    try {
      const peerConnection = peerConnectionsRef.current.get(peerId);

      if (!peerConnection) {
        console.error(
          `No connection found for peer ${peerId} to add ICE candidate`
        );
        return;
      }

      if (!message.data?.candidate) {
        console.error(`ICE candidate from ${peerId} missing candidate data`);
        return;
      }

      // Check connection state
      if (
        peerConnection.connectionState === "closed" ||
        peerConnection.connectionState === "failed"
      ) {
        console.warn(
          `Cannot add ICE candidate in connection state: ${peerConnection.connectionState}`
        );
        return;
      }

      // Check if we have remote description set
      if (
        peerConnection.remoteDescription === null &&
        peerConnection.signalingState !== "have-local-pranswer" &&
        peerConnection.signalingState !== "have-remote-pranswer"
      ) {
        console.warn(
          `Received ICE candidate before remote description for ${peerId}, queueing...`
        );
        // We could implement a queue here for early ICE candidates
        return;
      }

      console.log(`Adding ICE candidate for ${peerId}`);
      // Explicitly create a new RTCIceCandidate to avoid type issues
      const candidate = new RTCIceCandidate(message.data.candidate);
      await peerConnection.addIceCandidate(candidate);
      console.log(`Successfully added ICE candidate for ${peerId}`);
    } catch (error) {
      console.error(`Error adding ICE candidate from ${peerId}:`, error);
    }
  }, []);

  // Handle incoming signaling messages
  const handleSignalingMessage = useCallback(
    (message: SignalingMessage) => {
      console.log("Received message type:", message.type, message);

      switch (message.type) {
        case "welcome":
          // Server welcomes us - we now have our client ID
          if (message.data && message.to) {
            console.log("Welcome message received with client ID:", message.to);
            setClientId(message.to);

            // Check if we're designated as host
            if (message.data.isHost) {
              console.log("We are the host of this room");
              setIsHost(true);
            }
          }
          break;

        case "host-status":
          // Update our host status
          if (message.data && typeof message.data.isHost === "boolean") {
            console.log("Host status updated:", message.data.isHost);
            setIsHost(message.data.isHost);
          }
          break;

        case "host-change":
          // Host has changed
          if (message.data && message.data.hostId) {
            console.log("Host changed to:", message.data.hostId);

            // If we are the new host
            if (message.data.isHost) {
              setIsHost(true);
            }
          }
          break;

        case "user-joined":
          console.log(`User joined:`, message);
          if (message.from) {
            // Create peer connection to the new user
            console.log(
              `Creating peer connection to new user: ${message.from}`
            );

            // Create connection and add to peers
            const connection = createPeerConnection(message.from);

            // Always initiate an offer when someone joins to ensure connection
            if (connection) {
              // Add a small delay to ensure both peers are ready
              const peerId = message.from; // Capture peerId to avoid TypeScript errors
              setTimeout(() => {
                console.log(`Initiating offer to new participant: ${peerId}`);
                createOffer(peerId, connection);
              }, 1000);
            }
          }
          break;

        case "user-left":
          console.log(`User left: ${message.from}`);
          if (message.from) {
            console.log(`Removing peer connection for user: ${message.from}`);
            removePeerConnection(message.from);
          }
          break;

        case "user-list":
          console.log("Received user list:", message.data?.users);
          if (message.data?.users && Array.isArray(message.data.users)) {
            message.data.users.forEach((userId: string) => {
              if (!peerConnectionsRef.current.has(userId)) {
                console.log(
                  `Creating peer connection to existing user: ${userId}`
                );
                const connection = createPeerConnection(userId);

                // For existing users, the host should always initiate
                const currentIsHost = useVideoCallStore.getState().isHost;
                if (currentIsHost && connection) {
                  setTimeout(() => {
                    console.log(
                      `Host initiating offer to existing participant: ${userId}`
                    );
                    createOffer(userId, connection);
                  }, 1500);
                }
              }
            });
          }
          break;

        case "offer":
          console.log(`Received offer from ${message.from}`);
          handleOffer(message);
          break;

        case "answer":
          console.log(`Received answer from ${message.from}`);
          handleAnswer(message);
          break;

        case "ice-candidate":
          console.log(`Received ICE candidate from ${message.from}`);
          handleIceCandidate(message);
          break;

        default:
          console.log("Unknown message type:", message.type);
      }
    },
    [
      createPeerConnection,
      removePeerConnection,
      handleOffer,
      handleAnswer,
      handleIceCandidate,
      setClientId,
      setIsHost,
      createOffer,
    ]
  );

  // Send a join message
  const sendJoinMessage = useCallback(() => {
    sendSignalingMessage({
      type: "join",
      data: { roomId },
    });
  }, [roomId, sendSignalingMessage]);

  // Initialize media and join a room
  const joinRoom = useCallback(
    async (newRoomId: string, asHost: boolean = false) => {
      try {
        console.log(
          `Joining room: ${newRoomId} as ${asHost ? "host" : "participant"}`
        );

        // Clean up any existing connections first
        disconnect();

        // Clear peers first
        peerConnectionsRef.current = new Map();

        // Set room ID and host status in store
        setRoomId(newRoomId);
        setIsHost(asHost);

        // Request user media with constraints
        console.log("Requesting media devices...");
        const constraints = {
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: "user",
          },
        };

        // Get local media stream
        const stream = await navigator.mediaDevices
          .getUserMedia(constraints)
          .catch((error) => {
            console.error("Error accessing media devices:", error);

            // Try fallback with just audio if video fails
            if (
              error.name === "NotAllowedError" ||
              error.name === "NotFoundError"
            ) {
              alert(
                "Unable to access camera or microphone. Please check permissions and try again."
              );
              return null;
            }

            console.log("Attempting fallback to audio-only...");
            return navigator.mediaDevices
              .getUserMedia({ audio: true })
              .catch((audioError) => {
                console.error("Audio fallback also failed:", audioError);
                alert(
                  "Could not access any media devices. Please check permissions."
                );
                return null;
              });
          });

        if (!stream) {
          console.error("Failed to get media stream");
          return false;
        }

        console.log(
          "Media access granted",
          stream
            .getTracks()
            .map((t) => t.kind)
            .join(", ")
        );
        setLocalStream(stream);

        // Check if we're running locally (same-origin) for debug mode
        const isLocalTesting =
          window.location.hostname === "localhost" ||
          window.location.hostname === "127.0.0.1";

        // Initialize WebSocket connection to signaling server
        console.log("Connecting to signaling server...");
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || "localhost:8080";
        const wsUrl = `${protocol}//${baseUrl}/ws?roomId=${newRoomId}${
          asHost ? "&isHost=true" : ""
        }${isLocalTesting ? "&debug=true" : ""}`;

        // Close existing socket if any
        if (socket) {
          console.log("Closing existing socket connection");
          socket.close();
          setSocket(null);
        }

        const newSocket = new WebSocket(wsUrl);
        setSocket(newSocket);

        let connectionTimeout: ReturnType<typeof setTimeout> | null = null;

        // Set connection timeout
        connectionTimeout = setTimeout(() => {
          if (newSocket.readyState !== WebSocket.OPEN) {
            console.error("WebSocket connection timeout");
            setConnected(false);
            alert(
              "Unable to connect to signaling server. Please check if the server is running."
            );

            if (stream) {
              console.log("Stopping media tracks due to connection timeout");
              stream.getTracks().forEach((track) => track.stop());
              setLocalStream(null);
            }

            if (newSocket && newSocket.readyState !== WebSocket.CLOSED) {
              newSocket.close();
              setSocket(null);
            }
          }
        }, 10000); // 10 seconds timeout

        // WebSocket event handlers
        newSocket.onopen = () => {
          console.log("Connected to signaling server");
          setConnected(true);
          if (connectionTimeout) {
            clearTimeout(connectionTimeout);
          }

          console.log("Sending join message for room:", newRoomId);
          sendJoinMessage();
        };

        newSocket.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data) as SignalingMessage;
            console.log("Received message:", message);

            // Set our client ID from the first received message that has 'to' field
            if (!clientId && message.to) {
              console.log("Set client ID:", message.to);
              setClientId(message.to);
            }

            handleSignalingMessage(message);
          } catch (error) {
            console.error("Error handling WebSocket message:", error);
          }
        };

        newSocket.onerror = (error) => {
          console.error("WebSocket error:", error);
          setConnected(false);
          alert("Connection error. Please try again.");
        };

        newSocket.onclose = (event) => {
          console.log(
            `Disconnected from signaling server: ${event.code} ${event.reason}`
          );
          setConnected(false);
          if (connectionTimeout) {
            clearTimeout(connectionTimeout);
          }
        };

        return true;
      } catch (error) {
        console.error("Error joining room:", error);
        alert("Error joining room. Please try again.");
        return false;
      }
    },
    [
      disconnect,
      setRoomId,
      setLocalStream,
      setSocket,
      setConnected,
      setClientId,
      clientId,
      sendJoinMessage,
      handleSignalingMessage,
      socket,
      setIsHost,
    ]
  );

  // Socket connection effect
  useEffect(() => {
    if (socket && socket.readyState === WebSocket.OPEN && !clientId) {
      // Socket is ready and we don't have a client ID yet, send join message
      try {
        sendJoinMessage();
      } catch (error) {
        console.error("Error sending join message:", error);
        setConnected(false);
      }
    }

    // Cleanup when unmounting
    return () => {
      if (socket) {
        try {
          // Reset onmessage to avoid memory leaks
          socket.onmessage = null;
        } catch (error) {
          console.error("Error cleaning up socket:", error);
        }
      }
    };
  }, [socket, clientId, sendJoinMessage, setConnected]);

  // Cleanup when unmounting
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  // Return the public API
  return {
    joinRoom,
    leaveRoom: disconnect,
    toggleAudio,
    toggleVideo,
    localStream,
    peers: Array.from(peers.values()),
    connected,
    isAudioEnabled,
    isVideoEnabled,
    isHost: useVideoCallStore((state) => state.isHost),
  };
}
