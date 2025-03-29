"use client";

import { ArrowLeftIcon, ShareIcon } from "@heroicons/react/24/solid";
import { useEffect, useState } from "react";
import { useVideoCallStore } from "../lib/store";
import { useWebRTC } from "../lib/useWebRTC";
import JoinRoom from "./JoinRoom";
import MediaControls from "./MediaControls";
import ParticipantsList from "./ParticipantsList";
import VideoStream from "./VideoStream";

export default function VideoCall() {
  const [inCall, setInCall] = useState(false);
  const [currentRoomId, setCurrentRoomId] = useState("");
  const [autoJoinAttempted, setAutoJoinAttempted] = useState(false);
  const [autoJoinError, setAutoJoinError] = useState<string | null>(null);

  const webRTC = useWebRTC();
  const {
    joinRoom,
    leaveRoom,
    toggleAudio,
    toggleVideo,
    localStream,
    peers,
    connected,
    isAudioEnabled,
    isVideoEnabled,
    isHost,
  } = webRTC;

  const clientId = useVideoCallStore((state) => state.clientId);

  // Check URL for room parameter
  useEffect(() => {
    if (typeof window !== "undefined" && !autoJoinAttempted) {
      const params = new URLSearchParams(window.location.search);
      const roomParam = params.get("room");
      const isHostParam = params.get("host") === "true";

      if (roomParam) {
        handleJoinRoom(roomParam, isHostParam).catch((err) => {
          console.error("Failed to auto-join room:", err);
          setAutoJoinError(
            "Failed to automatically join the room. You can try joining manually."
          );
        });
      }

      setAutoJoinAttempted(true);
    }
  }, [autoJoinAttempted]);

  const handleJoinRoom = async (roomId: string, asHost: boolean = false) => {
    const success = await joinRoom(roomId, asHost);
    if (success) {
      setInCall(true);
      setCurrentRoomId(roomId);

      // Update URL with room parameter without reloading the page
      const url = new URL(window.location.href);
      url.searchParams.set("room", roomId);
      if (asHost) {
        url.searchParams.set("host", "true");
      } else {
        url.searchParams.delete("host");
      }
      window.history.pushState({}, "", url.toString());
    }
    return success;
  };

  const handleLeaveCall = () => {
    leaveRoom();
    setInCall(false);
    setCurrentRoomId("");

    // Remove room parameter from URL
    const url = new URL(window.location.href);
    url.searchParams.delete("room");
    url.searchParams.delete("host");
    window.history.pushState({}, "", url.toString());
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      leaveRoom();
    };
  }, [leaveRoom]);

  const shareLink = () => {
    const url = new URL(window.location.origin);
    url.searchParams.set("room", currentRoomId);

    navigator.clipboard
      .writeText(url.toString())
      .then(() => {
        alert("Room link copied to clipboard!");
      })
      .catch((err) => {
        console.error("Failed to copy room link:", err);
      });
  };

  // Filter out peers with valid streams for display
  const peersWithStreams = peers.filter(
    (peer) => peer.stream && !peer.isConnecting
  );
  const connectingPeers = peers.filter((peer) => peer.isConnecting);
  const peersWithoutStreams = peers.filter(
    (peer) => !peer.stream && !peer.isConnecting
  );

  // Debug info
  useEffect(() => {
    if (peers.length > 0) {
      console.log(
        "Current peers:",
        peers.map((p) => ({
          id: p.id,
          hasStream: !!p.stream,
          isConnecting: p.isConnecting,
          connectionState: p.connectionState,
        }))
      );
    }
  }, [peers]);

  // Enhanced reconnection function with proper debugging
  const forceReconnectWithPeers = () => {
    console.log("Force reconnecting with all peers...");

    // Temporarily show a loading indicator
    const reconnectionToast = document.createElement("div");
    reconnectionToast.textContent = "Reconnecting...";
    reconnectionToast.style.position = "fixed";
    reconnectionToast.style.bottom = "20px";
    reconnectionToast.style.right = "20px";
    reconnectionToast.style.padding = "10px 20px";
    reconnectionToast.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
    reconnectionToast.style.color = "white";
    reconnectionToast.style.borderRadius = "5px";
    reconnectionToast.style.zIndex = "9999";
    document.body.appendChild(reconnectionToast);

    // Close all existing peer connections
    peers.forEach((peer) => {
      if (peer.connection) {
        console.log(`Closing connection to ${peer.id}`);
        peer.connection.close();
      }
    });

    // Give some time for connections to close
    setTimeout(() => {
      // Rejoin the same room to establish new connections
      handleJoinRoom(currentRoomId, isHost).finally(() => {
        // Remove the toast after reconnection attempt
        setTimeout(() => {
          document.body.removeChild(reconnectionToast);
        }, 2000);
      });
    }, 500);
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
      {!inCall ? (
        <div className="flex items-center justify-center min-h-[80vh]">
          <div className="w-full max-w-md">
            {autoJoinError && (
              <div className="mb-4 p-3 bg-red-100 border border-red-200 text-red-600 rounded-lg">
                {autoJoinError}
              </div>
            )}
            <JoinRoom onJoin={handleJoinRoom} />
          </div>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center">
              <button
                onClick={handleLeaveCall}
                className="mr-4 p-2 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                title="Leave call"
              >
                <ArrowLeftIcon className="h-5 w-5 text-gray-700 dark:text-gray-200" />
              </button>
              <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center">
                <span className="mr-2">Room:</span>
                <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-3 py-1 rounded-md font-mono">
                  {currentRoomId}
                </span>
                {isHost && (
                  <span className="ml-2 text-sm font-normal bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 px-2 py-1 rounded-full">
                    Host
                  </span>
                )}
                <span className="ml-4 text-sm font-normal bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded-full flex items-center">
                  <div className="h-2 w-2 rounded-full bg-green-500 mr-2"></div>
                  Live
                </span>

                {peers.length > 0 && (
                  <span className="ml-2 text-sm font-normal bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded-full">
                    {peers.length} participants
                  </span>
                )}
              </h1>
            </div>

            <div className="flex space-x-2">
              <button
                onClick={forceReconnectWithPeers}
                className="flex items-center px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-sm"
                title="Use this if you can't see other participants"
              >
                Reconnect
              </button>

              <button
                onClick={() => window.location.reload()}
                className="flex items-center px-4 py-2 text-sm bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors shadow-sm"
                title="Refresh the page if reconnect doesn't work"
              >
                Refresh Page
              </button>

              <button
                onClick={shareLink}
                className="flex items-center px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
              >
                <ShareIcon className="h-4 w-4 mr-2" />
                Share Link
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
                {!connected && (
                  <div className="mb-4 px-3 py-2 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 text-sm rounded-lg">
                    Not connected to the server. Click &quot;Reconnect&quot; to
                    try again.
                  </div>
                )}

                {connected && localStream && peers.length === 0 && (
                  <div className="mb-4 px-3 py-2 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 text-sm rounded-lg">
                    Waiting for participants to join. Share the room link to
                    invite others.
                  </div>
                )}

                {connected &&
                  peers.length > 0 &&
                  peersWithStreams.length === 0 && (
                    <div className="mb-4 px-3 py-2 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 text-sm rounded-lg">
                      Connected to {peers.length} participant(s) but no video
                      streams received yet. Try clicking &quot;Reconnect&quot;
                      if this persists.
                    </div>
                  )}

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {/* Local stream */}
                  <VideoStream
                    stream={localStream}
                    muted={true}
                    label={isHost ? "You (Host)" : "You"}
                    className="aspect-video"
                    isAudioEnabled={isAudioEnabled}
                    isVideoEnabled={isVideoEnabled}
                  />

                  {/* Remote streams */}
                  {peersWithStreams.map((peer) => (
                    <VideoStream
                      key={peer.id}
                      stream={peer.stream || null}
                      label={peer.id.substring(0, 8) + "..."}
                      className="aspect-video"
                    />
                  ))}

                  {/* Connecting peers placeholders */}
                  {connectingPeers.map((peer) => (
                    <div
                      key={peer.id}
                      className="aspect-video bg-gray-200 dark:bg-gray-700 rounded-lg flex flex-col items-center justify-center"
                    >
                      <div className="animate-pulse flex flex-col items-center">
                        <div className="h-12 w-12 bg-blue-400 dark:bg-blue-600 rounded-full mb-2"></div>
                        <div className="h-4 w-24 bg-gray-300 dark:bg-gray-600 rounded mb-3"></div>
                      </div>
                      <p className="text-gray-500 dark:text-gray-400 text-sm">
                        Connecting to {peer.id.substring(0, 8)}...
                      </p>
                      <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">
                        {peer.connectionState || "initializing"}
                      </p>
                    </div>
                  ))}

                  {/* Peers without stream placeholders */}
                  {peersWithoutStreams.map((peer) => (
                    <div
                      key={peer.id}
                      className="aspect-video bg-gray-200 dark:bg-gray-700 rounded-lg flex flex-col items-center justify-center"
                    >
                      <div className="flex flex-col items-center">
                        <div className="h-12 w-12 bg-gray-400 rounded-full mb-2 flex items-center justify-center text-white font-bold text-lg">
                          {peer.id.substring(0, 1).toUpperCase()}
                        </div>
                      </div>
                      <p className="text-gray-500 dark:text-gray-400 text-sm">
                        {peer.id.substring(0, 8)}...
                      </p>
                      <p className="text-red-500 dark:text-red-400 text-xs mt-1">
                        No media stream
                      </p>
                    </div>
                  ))}

                  {/* Empty placeholders to maintain grid layout */}
                  {peers.length === 0 && (
                    <div className="aspect-video bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                      <p className="text-gray-500 dark:text-gray-400 text-center px-4">
                        Waiting for participants to join...
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-8">
                  <MediaControls
                    isAudioEnabled={isAudioEnabled}
                    isVideoEnabled={isVideoEnabled}
                    onToggleAudio={toggleAudio}
                    onToggleVideo={toggleVideo}
                    onLeaveCall={handleLeaveCall}
                  />
                </div>
              </div>
            </div>

            <div className="lg:col-span-1 space-y-6">
              <ParticipantsList
                peers={peers}
                clientId={clientId}
                isAudioEnabled={isAudioEnabled}
                isVideoEnabled={isVideoEnabled}
                isHost={isHost}
              />

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                  Connection Status
                </h3>
                <div className="flex items-center">
                  <div
                    className={`h-3 w-3 rounded-full mr-3 ${
                      connected ? "bg-green-500" : "bg-red-500"
                    }`}
                  ></div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {connected ? "Connected to server" : "Disconnected"}
                  </span>
                </div>

                <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                  <p>
                    Client ID:{" "}
                    <span className="font-mono">
                      {clientId || "Not assigned"}
                    </span>
                  </p>
                  <p className="mt-1">
                    Active participants: {peers.length + 1}
                  </p>
                  {isHost && (
                    <p className="mt-1 text-green-600 dark:text-green-400">
                      You are the host of this room
                    </p>
                  )}
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                  Call Information
                </h3>
                <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                  <p>
                    Share this room with others to invite them to join your
                    call.
                  </p>
                  <p>
                    All participants must allow camera and microphone access.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Debug information */}
          {peers.length > 0 && (
            <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl shadow-md p-4">
              <details className="text-sm">
                <summary className="cursor-pointer font-semibold text-blue-600 dark:text-blue-400">
                  Connection Diagnostics
                </summary>
                <div className="mt-2 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-x-auto">
                  <h3 className="font-semibold mb-2">
                    WebRTC Connection Status
                  </h3>
                  <p className="mb-2">
                    Total peers: {peers.length}, Connected:{" "}
                    {peersWithStreams.length}, Connecting:{" "}
                    {connectingPeers.length}
                  </p>
                  <div className="grid grid-cols-1 gap-2">
                    {peers.map((peer) => (
                      <div
                        key={peer.id}
                        className="p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-600"
                      >
                        <div className="font-medium">Peer: {peer.id}</div>
                        <div className="text-xs">
                          <div>
                            Connection state:{" "}
                            <span
                              className={
                                peer.connectionState === "connected"
                                  ? "text-green-500"
                                  : "text-red-500"
                              }
                            >
                              {peer.connectionState || "unknown"}
                            </span>
                          </div>
                          <div>
                            Has stream:{" "}
                            <span
                              className={
                                peer.stream ? "text-green-500" : "text-red-500"
                              }
                            >
                              {peer.stream ? "Yes" : "No"}
                            </span>
                          </div>
                          {peer.stream && (
                            <div>
                              <div>
                                Stream active:{" "}
                                <span
                                  className={
                                    peer.stream.active
                                      ? "text-green-500"
                                      : "text-red-500"
                                  }
                                >
                                  {peer.stream.active ? "Yes" : "No"}
                                </span>
                              </div>
                              <div>
                                Video tracks:{" "}
                                {peer.stream.getVideoTracks().length}
                              </div>
                              <div>
                                Audio tracks:{" "}
                                {peer.stream.getAudioTracks().length}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </details>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
