"use client";

import { ArrowRightIcon, PlusCircleIcon } from "@heroicons/react/24/solid";
import { useEffect, useState } from "react";

interface JoinRoomProps {
  onJoin: (roomId: string, asHost: boolean) => Promise<boolean>;
}

export default function JoinRoom({ onJoin }: JoinRoomProps) {
  const [roomId, setRoomId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeRooms, setActiveRooms] = useState<string[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);

  // Fetch active rooms from the server
  useEffect(() => {
    const fetchRooms = async () => {
      setIsLoadingRooms(true);
      try {
        const protocol =
          window.location.protocol === "https:" ? "https:" : "http:";
        // Update this URL when you deploy
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || "localhost:8080";
        const response = await fetch(`${protocol}//${baseUrl}/api/rooms`);
        if (response.ok) {
          const rooms = await response.json();
          setActiveRooms(rooms);
        }
      } catch (error) {
        console.error("Failed to fetch active rooms:", error);
      } finally {
        setIsLoadingRooms(false);
      }
    };

    fetchRooms();
    // Refresh room list every 10 seconds
    const interval = setInterval(fetchRooms, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e: React.FormEvent, asHost: boolean) => {
    e.preventDefault();
    if (!roomId.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const success = await onJoin(roomId.trim(), asHost);
      if (!success) {
        setError(
          `Failed to ${asHost ? "create" : "join"} room. Please try again.`
        );
      }
    } catch (error) {
      console.error("Error joining room:", error);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Generate a random room ID
  const generateRandomRoom = () => {
    const randomId = Math.random().toString(36).substring(2, 10);
    setRoomId(randomId);
  };

  return (
    <div className="max-w-md w-full mx-auto p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
      <h2 className="text-2xl font-bold text-center mb-6 text-gray-800 dark:text-white">
        Video Call
      </h2>

      <form className="space-y-4">
        <div>
          <label
            htmlFor="roomId"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Room ID
          </label>
          <div className="flex">
            <input
              type="text"
              id="roomId"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder="Enter room ID or create a new one"
              required
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <button
              type="button"
              onClick={generateRandomRoom}
              className="ml-2 px-3 py-2 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-white"
            >
              Random
            </button>
          </div>
        </div>

        {error && <div className="text-red-500 text-sm">{error}</div>}

        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={(e) => handleSubmit(e, true)}
            disabled={isLoading || !roomId.trim()}
            className={`w-full flex items-center justify-center py-2 px-4 border border-transparent rounded-lg ${
              isLoading || !roomId.trim()
                ? "bg-purple-300 cursor-not-allowed text-white"
                : "bg-purple-600 hover:bg-purple-700 text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
            } transition-colors duration-200`}
          >
            <PlusCircleIcon className="h-5 w-5 mr-1" />
            Create as Host
          </button>

          <button
            type="button"
            onClick={(e) => handleSubmit(e, false)}
            disabled={isLoading || !roomId.trim()}
            className={`w-full flex items-center justify-center py-2 px-4 border border-transparent rounded-lg ${
              isLoading || !roomId.trim()
                ? "bg-blue-300 cursor-not-allowed text-white"
                : "bg-blue-600 hover:bg-blue-700 text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            } transition-colors duration-200`}
          >
            <ArrowRightIcon className="h-5 w-5 mr-1" />
            Join Room
          </button>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-2">
            <svg
              className="animate-spin h-5 w-5 text-blue-500"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <span className="ml-2 text-blue-600 dark:text-blue-400">
              {isLoading ? "Connecting..." : ""}
            </span>
          </div>
        )}
      </form>

      {/* Active Rooms Section */}
      <div className="mt-6">
        <h3 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-2">
          Active Rooms
        </h3>
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
          {isLoadingRooms ? (
            <div className="flex justify-center py-2">
              <div className="animate-pulse h-4 w-4 rounded-full bg-blue-500"></div>
              <div className="animate-pulse h-4 w-4 rounded-full bg-blue-500 ml-1"></div>
              <div className="animate-pulse h-4 w-4 rounded-full bg-blue-500 ml-1"></div>
            </div>
          ) : activeRooms.length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {activeRooms.map((room) => (
                <button
                  key={room}
                  onClick={() => setRoomId(room)}
                  className="text-left px-3 py-2 text-sm bg-white dark:bg-gray-600 hover:bg-gray-100 dark:hover:bg-gray-500 rounded border border-gray-200 dark:border-gray-500 text-blue-600 dark:text-blue-300 truncate"
                  title={room}
                >
                  {room}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
              No active rooms. Be the first to create one!
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
        <p>Create a room as host or join an existing room.</p>
        <p className="mt-1">
          Participants will be able to see and hear each other.
        </p>
      </div>
    </div>
  );
}
