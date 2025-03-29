"use client";

import {
  ExclamationCircleIcon,
  MicrophoneIcon,
  NoSymbolIcon,
  UserCircleIcon,
} from "@heroicons/react/24/solid";
import { useEffect, useRef, useState } from "react";

interface VideoStreamProps {
  stream: MediaStream | null;
  muted?: boolean;
  className?: string;
  label?: string;
  isAudioEnabled?: boolean;
  isVideoEnabled?: boolean;
}

export default function VideoStream({
  stream,
  muted = false,
  className = "",
  label,
  isAudioEnabled,
  isVideoEnabled,
}: VideoStreamProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [audioStatus, setAudioStatus] = useState<boolean>(true);
  const [videoStatus, setVideoStatus] = useState<boolean>(true);
  const [streamActive, setStreamActive] = useState<boolean>(false);

  // Monitor track state changes
  useEffect(() => {
    if (!stream) {
      setStreamActive(false);
      return;
    }

    setStreamActive(stream.active);

    const handleTrackEnabled = (track: MediaStreamTrack) => {
      if (track.kind === "audio") setAudioStatus(true);
      if (track.kind === "video") setVideoStatus(true);
    };

    const handleTrackDisabled = (track: MediaStreamTrack) => {
      if (track.kind === "audio") setAudioStatus(false);
      if (track.kind === "video") setVideoStatus(false);
    };

    const handleTrackEnded = () => {
      // Check if any tracks are still active
      const hasActiveTracks = stream
        .getTracks()
        .some((track) => track.readyState === "live");
      setStreamActive(hasActiveTracks);
    };

    // Setup monitors for all tracks
    const tracks = stream.getTracks();

    // If there are no tracks, mark as inactive
    if (tracks.length === 0) {
      setStreamActive(false);
    }

    tracks.forEach((track) => {
      // Set initial status
      if (track.kind === "audio") setAudioStatus(track.enabled);
      if (track.kind === "video") setVideoStatus(track.enabled);

      // Add ended event listener
      track.addEventListener("ended", handleTrackEnded);

      // Override track.enabled to monitor status changes
      const originalEnabledSetter = Object.getOwnPropertyDescriptor(
        track,
        "enabled"
      )?.set;
      if (originalEnabledSetter) {
        Object.defineProperty(track, "enabled", {
          set: function (value) {
            originalEnabledSetter.call(this, value);
            if (value) handleTrackEnabled(track);
            else handleTrackDisabled(track);
          },
          get: function () {
            return track.enabled;
          },
        });
      }
    });

    // Clean up event listeners
    return () => {
      tracks.forEach((track) => {
        track.removeEventListener("ended", handleTrackEnded);
      });
    };
  }, [stream]);

  // Override audio status if explicitly provided
  useEffect(() => {
    if (isAudioEnabled !== undefined) {
      setAudioStatus(isAudioEnabled);
    }
  }, [isAudioEnabled]);

  // Override video status if explicitly provided
  useEffect(() => {
    if (isVideoEnabled !== undefined) {
      setVideoStatus(isVideoEnabled);
    }
  }, [isVideoEnabled]);

  useEffect(() => {
    if (videoRef.current && stream && stream.active) {
      try {
        // Always set video element's srcObject property
        if (videoRef.current.srcObject !== stream) {
          console.log(`Attaching media stream: ${stream.id}`);
          videoRef.current.srcObject = stream;

          // Add debugging info
          const hasVideoTracks = stream.getVideoTracks().length > 0;
          const hasAudioTracks = stream.getAudioTracks().length > 0;
          console.log(
            `Stream ${stream.id} has video: ${hasVideoTracks}, audio: ${hasAudioTracks}`
          );

          if (hasVideoTracks) {
            console.log(
              `Video track settings:`,
              stream.getVideoTracks()[0].getSettings()
            );
          }

          // Force play for some browsers that don't autoplay
          videoRef.current.play().catch((e) => {
            console.warn("Error auto-playing video:", e);
          });
        }

        setIsLoading(false);
        setHasError(false);
        setStreamActive(true);
      } catch (error) {
        console.error("Error setting video stream:", error);
        setHasError(true);
        setIsLoading(false);
      }
    } else if (!stream) {
      setStreamActive(false);
      setHasError(true);
      setIsLoading(false);
    } else if (!stream.active) {
      console.warn(`Stream ${stream.id} is not active`);
      setStreamActive(false);
      setHasError(true);
      setIsLoading(false);
    } else {
      setIsLoading(!hasError);
    }
  }, [stream, hasError, streamActive]);

  const handleCanPlay = () => {
    setIsLoading(false);
  };

  const handleError = () => {
    setHasError(true);
    setIsLoading(false);
  };

  // Get the avatar letter from the label
  const avatarLetter = label ? label.charAt(0).toUpperCase() : "?";

  return (
    <div
      className={`relative rounded-lg overflow-hidden bg-gray-800 ${className}`}
    >
      {isLoading && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 z-10">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-500 border-r-transparent"></div>
        </div>
      )}

      {hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 z-10">
          <div className="flex flex-col items-center">
            <div className="h-16 w-16 rounded-full bg-gray-700 flex items-center justify-center text-gray-300 text-xl font-bold mb-2">
              {avatarLetter}
            </div>
            <div className="text-sm text-center text-gray-400 max-w-[80%]">
              {!stream
                ? "No video stream available"
                : !stream.active
                  ? "Connection inactive"
                  : "Video stream unavailable"}
            </div>
          </div>
        </div>
      )}

      {!videoStatus && !isLoading && !hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/90 z-10">
          <UserCircleIcon className="h-16 w-16 text-gray-400 mb-2" />
          <p className="text-sm text-center text-gray-300">Camera off</p>
        </div>
      )}

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        className="w-full h-full object-cover"
        onCanPlay={handleCanPlay}
        onError={handleError}
      />

      <div className="absolute bottom-0 left-0 right-0 p-2 flex justify-between items-center bg-gradient-to-t from-black/70 to-transparent z-20">
        {label && <div className="text-white text-sm font-medium">{label}</div>}

        <div className="flex space-x-2">
          {!streamActive && (
            <ExclamationCircleIcon
              className="h-4 w-4 text-red-500"
              title="Connection inactive"
            />
          )}
          {!audioStatus && streamActive && (
            <div className="flex items-center" title="Microphone off">
              <MicrophoneIcon className="h-4 w-4 text-red-500" />
              <NoSymbolIcon className="h-4 w-4 text-red-500 -ml-2" />
            </div>
          )}
          {audioStatus && muted && streamActive && (
            <div className="flex items-center" title="Microphone muted">
              <MicrophoneIcon className="h-4 w-4 text-yellow-500" />
              <NoSymbolIcon className="h-4 w-4 text-yellow-500 -ml-2" />
            </div>
          )}
          {audioStatus && !muted && streamActive && (
            <MicrophoneIcon
              className="h-4 w-4 text-green-500"
              title="Microphone on"
            />
          )}
        </div>
      </div>
    </div>
  );
}
