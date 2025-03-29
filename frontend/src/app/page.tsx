"use client";

import { useEffect, useState } from "react";
import VideoCall from "../../components/VideoCall";

export default function Home() {
  const [isServerRunning, setIsServerRunning] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if the backend server is running
    const checkServerStatus = async () => {
      try {
        const protocol =
          window.location.protocol === "https:" ? "https:" : "http:";
        const response = await fetch(`${protocol}//localhost:8080/api/health`);
        if (response.ok) {
          setIsServerRunning(true);
        } else {
          setIsServerRunning(false);
        }
      } catch (error) {
        console.error("Error checking server status:", error);
        setIsServerRunning(false);
      }
    };

    checkServerStatus();
  }, []);

  if (isServerRunning === null) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="text-center">
          <div
            className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] text-blue-600 motion-reduce:animate-[spin_1.5s_linear_infinite]"
            role="status"
          >
            <span className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">
              Loading...
            </span>
          </div>
          <p className="mt-2 text-gray-600 dark:text-gray-300">
            Checking server connection...
          </p>
        </div>
      </main>
    );
  }

  if (isServerRunning === false) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full">
          <h2 className="text-2xl font-bold text-red-600 mb-4">
            Server Connection Error
          </h2>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            Could not connect to the backend server. Please ensure that the
            server is running on localhost:8080.
          </p>
          <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-md text-sm font-mono mb-4">
            <p className="text-gray-800 dark:text-gray-300">
              Run this command to start the server:
            </p>
            <code className="text-blue-600 dark:text-blue-400">
              go run main.go
            </code>
          </div>
          <button
            onClick={() => setIsServerRunning(null)}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded"
          >
            Retry Connection
          </button>
        </div>
      </main>
    );
  }

  return (
    <main>
      <VideoCall />
    </main>
  );
}
