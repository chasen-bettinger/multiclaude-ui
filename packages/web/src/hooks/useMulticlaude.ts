import { useState, useEffect, useCallback, useRef } from 'react';
import type { State } from '@multiclaude/core';

/** Interval for auto-refresh in milliseconds */
const REFRESH_INTERVAL = 2000;

/**
 * Hook for integrating with multiclaude state.
 *
 * Fetches state from /api/state endpoint (served by Vite plugin in dev,
 * or a backend API in production). Auto-refreshes every 2 seconds.
 */
export function useMulticlaude() {
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/state');
      if (!res.ok) {
        const errData = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errData.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as State;
      setState(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    // Auto-refresh every 2 seconds for live updates
    intervalRef.current = window.setInterval(() => void refresh(), REFRESH_INTERVAL);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [refresh]);

  return { state, error, loading, refresh };
}

/**
 * Hook for daemon connection status.
 *
 * Checks if the daemon is running by calling `multiclaude daemon status`
 * via the /api/daemon-status endpoint.
 */
export function useDaemonStatus() {
  const [connected, setConnected] = useState(false);
  const [checking, setChecking] = useState(true);

  const checkConnection = useCallback(async () => {
    setChecking(true);
    try {
      const res = await fetch('/api/daemon-status');
      if (res.ok) {
        const data = (await res.json()) as { running: boolean };
        setConnected(data.running);
      } else {
        setConnected(false);
      }
    } catch {
      setConnected(false);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void checkConnection();
    const interval = setInterval(() => void checkConnection(), 30000);
    return () => clearInterval(interval);
  }, [checkConnection]);

  return { connected, checking, checkConnection };
}
