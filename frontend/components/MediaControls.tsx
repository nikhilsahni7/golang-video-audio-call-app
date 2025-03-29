"use client";

import {
  ChatBubbleLeftRightIcon,
  ComputerDesktopIcon,
  MicrophoneIcon as MicrophoneIconOutline,
  VideoCameraIcon as VideoCameraIconOutline,
} from "@heroicons/react/24/outline";
import {
  MicrophoneIcon,
  PhoneIcon,
  VideoCameraIcon,
} from "@heroicons/react/24/solid";
import { useState } from "react";

interface MediaControlsProps {
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onLeaveCall: () => void;
}

export default function MediaControls({
  isAudioEnabled,
  isVideoEnabled,
  onToggleAudio,
  onToggleVideo,
  onLeaveCall,
}: MediaControlsProps) {
  const [showTooltip, setShowTooltip] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-center">
      <div className="flex justify-center items-center space-x-4 p-3 bg-gray-100 dark:bg-gray-700 rounded-full shadow-md">
        <button
          onClick={onToggleAudio}
          className={`p-4 rounded-full ${
            isAudioEnabled
              ? "bg-blue-500 text-white hover:bg-blue-600"
              : "bg-red-500 text-white hover:bg-red-600"
          } transition-colors relative`}
          aria-label={isAudioEnabled ? "Mute microphone" : "Unmute microphone"}
          onMouseEnter={() =>
            setShowTooltip(
              isAudioEnabled ? "Mute microphone" : "Unmute microphone"
            )
          }
          onMouseLeave={() => setShowTooltip(null)}
        >
          {isAudioEnabled ? (
            <MicrophoneIcon className="h-6 w-6" />
          ) : (
            <MicrophoneIconOutline className="h-6 w-6" />
          )}
          {showTooltip === "Mute microphone" ||
          showTooltip === "Unmute microphone" ? (
            <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs rounded py-1 px-2 whitespace-nowrap">
              {showTooltip}
            </div>
          ) : null}
        </button>

        <button
          onClick={onToggleVideo}
          className={`p-4 rounded-full ${
            isVideoEnabled
              ? "bg-blue-500 text-white hover:bg-blue-600"
              : "bg-red-500 text-white hover:bg-red-600"
          } transition-colors relative`}
          aria-label={isVideoEnabled ? "Turn off camera" : "Turn on camera"}
          onMouseEnter={() =>
            setShowTooltip(
              isVideoEnabled ? "Turn off camera" : "Turn on camera"
            )
          }
          onMouseLeave={() => setShowTooltip(null)}
        >
          {isVideoEnabled ? (
            <VideoCameraIcon className="h-6 w-6" />
          ) : (
            <VideoCameraIconOutline className="h-6 w-6" />
          )}
          {showTooltip === "Turn off camera" ||
          showTooltip === "Turn on camera" ? (
            <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs rounded py-1 px-2 whitespace-nowrap">
              {showTooltip}
            </div>
          ) : null}
        </button>

        <button
          className="p-4 rounded-full bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors relative"
          aria-label="Share screen"
          onMouseEnter={() => setShowTooltip("Share screen")}
          onMouseLeave={() => setShowTooltip(null)}
        >
          <ComputerDesktopIcon className="h-6 w-6" />
          {showTooltip === "Share screen" ? (
            <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs rounded py-1 px-2 whitespace-nowrap">
              {showTooltip}
            </div>
          ) : null}
        </button>

        <button
          className="p-4 rounded-full bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors relative"
          aria-label="Chat"
          onMouseEnter={() => setShowTooltip("Chat")}
          onMouseLeave={() => setShowTooltip(null)}
        >
          <ChatBubbleLeftRightIcon className="h-6 w-6" />
          {showTooltip === "Chat" ? (
            <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs rounded py-1 px-2 whitespace-nowrap">
              {showTooltip}
            </div>
          ) : null}
        </button>

        <button
          onClick={onLeaveCall}
          className="p-4 rounded-full bg-red-600 text-white hover:bg-red-700 transition-colors relative"
          aria-label="End call"
          onMouseEnter={() => setShowTooltip("End call")}
          onMouseLeave={() => setShowTooltip(null)}
        >
          <PhoneIcon className="h-6 w-6 transform rotate-135" />
          {showTooltip === "End call" ? (
            <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs rounded py-1 px-2 whitespace-nowrap">
              {showTooltip}
            </div>
          ) : null}
        </button>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
        {isAudioEnabled ? "Microphone is active" : "Microphone is muted"} •
        {isVideoEnabled ? " Camera is active" : " Camera is turned off"}
      </p>
    </div>
  );
}
