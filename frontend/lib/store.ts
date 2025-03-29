import { create } from "zustand";

// Define types for our store
export interface Peer {
  id: string;
  stream?: MediaStream;
  connection?: RTCPeerConnection;
  isLocal?: boolean;
  isConnecting?: boolean;
  connectionState?: string;
}

interface VideoCallState {
  // Local state
  localStream: MediaStream | null;
  roomId: string;
  connected: boolean;
  clientId: string | null;
  isHost: boolean;

  // Remote peers
  peers: Map<string, Peer>;

  // WebSocket connection
  socket: WebSocket | null;

  // Media controls
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;

  // Actions
  setLocalStream: (stream: MediaStream | null) => void;
  setRoomId: (roomId: string) => void;
  setConnected: (connected: boolean) => void;
  setClientId: (clientId: string | null) => void;
  setSocket: (socket: WebSocket | null) => void;
  setIsHost: (isHost: boolean) => void;

  // Peer management
  addPeer: (
    peerId: string,
    stream?: MediaStream,
    connection?: RTCPeerConnection
  ) => void;
  updatePeer: (peerId: string, updates: Partial<Peer>) => void;
  removePeer: (peerId: string) => void;

  // Media controls
  toggleAudio: () => void;
  toggleVideo: () => void;

  // Connection management
  disconnect: () => void;
}

// Create the store
export const useVideoCallStore = create<VideoCallState>((set) => ({
  // Initial state
  localStream: null,
  roomId: "",
  connected: false,
  clientId: null,
  peers: new Map(),
  socket: null,
  isAudioEnabled: true,
  isVideoEnabled: true,
  isHost: false,

  // Set actions
  setLocalStream: (stream) => set({ localStream: stream }),
  setRoomId: (roomId) => set({ roomId }),
  setConnected: (connected) => set({ connected }),
  setClientId: (clientId) => set({ clientId }),
  setSocket: (socket) => set({ socket }),
  setIsHost: (isHost) => set({ isHost }),

  // Peer management
  addPeer: (peerId, stream, connection) =>
    set((state) => {
      const newPeers = new Map(state.peers);
      newPeers.set(peerId, {
        id: peerId,
        stream,
        connection,
        isConnecting: true,
        connectionState: connection?.connectionState || "new",
      });
      return { peers: newPeers };
    }),

  updatePeer: (peerId, updates) =>
    set((state) => {
      const newPeers = new Map(state.peers);
      const currentPeer = newPeers.get(peerId);
      if (currentPeer) {
        newPeers.set(peerId, { ...currentPeer, ...updates });
      }
      return { peers: newPeers };
    }),

  removePeer: (peerId) =>
    set((state) => {
      const newPeers = new Map(state.peers);
      newPeers.delete(peerId);
      return { peers: newPeers };
    }),

  // Media controls
  toggleAudio: () =>
    set((state) => {
      if (state.localStream) {
        state.localStream.getAudioTracks().forEach((track) => {
          track.enabled = !track.enabled;
        });
      }
      return { isAudioEnabled: !state.isAudioEnabled };
    }),

  toggleVideo: () =>
    set((state) => {
      if (state.localStream) {
        state.localStream.getVideoTracks().forEach((track) => {
          track.enabled = !track.enabled;
        });
      }
      return { isVideoEnabled: !state.isVideoEnabled };
    }),

  // Clean up
  disconnect: () =>
    set((state) => {
      // Close all peer connections
      state.peers.forEach((peer) => {
        if (peer.connection) {
          peer.connection.close();
        }
        if (peer.stream) {
          peer.stream.getTracks().forEach((track) => track.stop());
        }
      });

      // Close local stream
      if (state.localStream) {
        state.localStream.getTracks().forEach((track) => track.stop());
      }

      // Close websocket
      if (state.socket) {
        state.socket.close();
      }

      return {
        peers: new Map(),
        localStream: null,
        socket: null,
        connected: false,
        clientId: null,
      };
    }),
}));
