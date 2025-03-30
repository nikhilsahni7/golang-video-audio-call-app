"use client";

import {
  MicrophoneIcon,
  NoSymbolIcon,
  SparklesIcon,
  UserGroupIcon,
  VideoCameraIcon,
  VideoCameraSlashIcon,
} from "@heroicons/react/24/solid";
import { useState, useEffect } from "react";
import { Peer } from "../lib/store";

interface ParticipantsListProps {
  peers: Peer[];
  clientId: string | null;
  isAudioEnabled?: boolean;
  isVideoEnabled?: boolean;
  isHost?: boolean;
}

export default function ParticipantsList({
  peers,
  clientId,
  isAudioEnabled = true,
  isVideoEnabled = true,
  isHost = false,
}: ParticipantsListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const activePeers = [...peers];

  // Add ourselves to the list
  if (clientId) {
    activePeers.unshift({
      id: clientId,
      isLocal: true,
    } as Peer);
  }

  // Filter peers based on search query
  const filteredPeers = searchQuery
    ? activePeers.filter((peer) =>
        peer.id.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : activePeers;

  // Add this effect to refresh the component when peers change
  useEffect(() => {
    console.log("ParticipantsList updated with", peers.length, "peers");
  }, [peers]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center">
          <UserGroupIcon className="h-5 w-5 text-blue-500 mr-2" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Participants
          </h3>
        </div>
        <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs font-medium px-2.5 py-0.5 rounded-full">
          {activePeers.length}
        </span>
      </div>

      {activePeers.length > 3 && (
        <div className="px-4 pt-3">
          <input
            type="text"
            placeholder="Search participants..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      <div className="p-4 max-h-[320px] overflow-y-auto">
        {filteredPeers.length === 0 ? (
          <p className="text-center text-gray-500 dark:text-gray-400 py-3 text-sm">
            {searchQuery
              ? "No participants match your search"
              : "No participants in call"}
          </p>
        ) : (
          <ul className="space-y-2">
            {filteredPeers.map((peer) => {
              // Check if peer has audio/video tracks
              const hasAudioTrack = peer.stream
                ? peer.stream.getAudioTracks().length > 0
                : false;
              const hasVideoTrack = peer.stream
                ? peer.stream.getVideoTracks().length > 0
                : false;

              // Check if tracks are enabled
              const isAudioOn = peer.isLocal ? isAudioEnabled : hasAudioTrack;
              const isVideoOn = peer.isLocal ? isVideoEnabled : hasVideoTrack;

              // Create a short ID for display
              const displayId = peer.id.substring(0, 8) + "...";

              // Check if this peer is connecting
              const isConnecting = peer.isConnecting;
              const connectionState = peer.connectionState;

              return (
                <li
                  key={peer.id}
                  className="flex items-center gap-2 p-2 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  title={peer.id}
                >
                  <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white">
                    {peer.isLocal ? "Y" : peer.id.substring(0, 1).toUpperCase()}
                  </div>
                  <div className="flex-grow min-w-0">
                    <div className="flex items-center">
                      <p className="text-sm font-medium truncate">
                        {peer.isLocal ? "You" : displayId}
                      </p>
                      {peer.isLocal && isHost && (
                        <SparklesIcon
                          className="h-4 w-4 text-yellow-500 ml-1"
                          title="Host"
                        />
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {isConnecting ? (
                        <span className="text-amber-500">Connecting...</span>
                      ) : connectionState === "disconnected" ||
                        connectionState === "failed" ? (
                        <span className="text-red-500">Connection issues</span>
                      ) : peer.isLocal ? (
                        isHost ? (
                          "Host (you)"
                        ) : (
                          "Local participant"
                        )
                      ) : (
                        "Remote participant"
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 ml-auto">
                    {/* Audio status icon */}
                    {isAudioOn ? (
                      <span
                        className="w-6 h-6 flex items-center justify-center"
                        title="Audio enabled"
                      >
                        <MicrophoneIcon className="h-4 w-4 text-green-500" />
                      </span>
                    ) : (
                      <span
                        className="w-6 h-6 flex items-center justify-center"
                        title="Audio disabled"
                      >
                        <div className="relative w-4 h-4">
                          <MicrophoneIcon className="h-4 w-4 text-red-500" />
                          <NoSymbolIcon className="absolute top-0 left-0 h-4 w-4 text-red-500 opacity-70" />
                        </div>
                      </span>
                    )}

                    {/* Video status icon */}
                    {isVideoOn ? (
                      <span
                        className="w-6 h-6 flex items-center justify-center"
                        title="Video enabled"
                      >
                        <VideoCameraIcon className="h-4 w-4 text-green-500" />
                      </span>
                    ) : (
                      <span
                        className="w-6 h-6 flex items-center justify-center"
                        title="Video disabled"
                      >
                        <VideoCameraSlashIcon className="h-4 w-4 text-red-500" />
                      </span>
                    )}

                    {peer.isLocal && (
                      <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-300">
                        You
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
