"use client";

import { useEffect, useState, useRef } from "react";
import type { JobProgressEvent } from "@repo/shared-types";

interface UseJobProgressOptions {
  /**
   * Auto-connect on mount
   * @default true
   */
  autoConnect?: boolean;
  /**
   * Filter events by job name
   */
  jobName?: string;
  /**
   * Reconnect on connection loss
   * @default true
   */
  autoReconnect?: boolean;
  /**
   * Reconnect delay in milliseconds
   * @default 3000
   */
  reconnectDelay?: number;
}

export function useJobProgress(options: UseJobProgressOptions = {}) {
  const {
    autoConnect = true,
    jobName,
    autoReconnect = true,
    reconnectDelay = 3000,
  } = options;

  const [events, setEvents] = useState<JobProgressEvent[]>([]);
  const [latestEvent, setLatestEvent] = useState<JobProgressEvent | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const shouldReconnectRef = useRef(autoConnect);

  const connect = () => {
    if (eventSourceRef.current) {
      return; // Already connected
    }

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      // Remove trailing slash and /api if present to avoid double /api/
      const baseUrl = apiUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
      const url = `${baseUrl}/api/jobs/progress`;

      console.log("[JobProgress] Connecting to SSE:", url);

      const eventSource = new EventSource(url);

      eventSource.onopen = () => {
        console.log("[JobProgress] Connected to SSE stream");
        setIsConnected(true);
        setError(null);
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Skip connection messages
          if (data.type === "connected") {
            return;
          }

          const jobEvent = data as JobProgressEvent;

          // Filter by job name if specified
          if (jobName && jobEvent.jobName !== jobName) {
            return;
          }

          setLatestEvent(jobEvent);
          setEvents((prev) => [...prev, jobEvent]);
        } catch (err) {
          console.error("[JobProgress] Failed to parse event:", err);
        }
      };

      eventSource.onerror = (err) => {
        console.error("[JobProgress] SSE error:", err);
        setIsConnected(false);
        setError(new Error("Connection lost"));

        // Close current connection
        eventSource.close();
        eventSourceRef.current = null;

        // Attempt reconnection if enabled
        if (autoReconnect && shouldReconnectRef.current) {
          console.log(
            `[JobProgress] Reconnecting in ${reconnectDelay}ms...`
          );
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectDelay);
        }
      };

      eventSourceRef.current = eventSource;
    } catch (err) {
      console.error("[JobProgress] Failed to connect:", err);
      setError(
        err instanceof Error ? err : new Error("Failed to connect")
      );
    }
  };

  const disconnect = () => {
    shouldReconnectRef.current = false;

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setIsConnected(false);
    }
  };

  const clearEvents = () => {
    setEvents([]);
    setLatestEvent(null);
  };

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, jobName]);

  // Get events for specific job
  const getJobEvents = (name: string) => {
    return events.filter((e) => e.jobName === name);
  };

  // Get latest event for specific job
  const getLatestJobEvent = (name: string) => {
    const jobEvents = getJobEvents(name);
    return jobEvents[jobEvents.length - 1] || null;
  };

  // Check if job is running
  const isJobRunning = (name: string) => {
    const latest = getLatestJobEvent(name);
    return latest?.status === "started" || latest?.status === "progress";
  };

  return {
    events,
    latestEvent,
    isConnected,
    error,
    connect,
    disconnect,
    clearEvents,
    getJobEvents,
    getLatestJobEvent,
    isJobRunning,
  };
}
