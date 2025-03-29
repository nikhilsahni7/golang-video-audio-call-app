import { Peer } from "./store";

export interface VideoCallState {
  // Local state
  localStream: MediaStream | null;
  roomId: string;
  connected: boolean;
  clientId: string | null;

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
