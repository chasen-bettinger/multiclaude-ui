import { useState, useCallback } from 'react';

interface DaemonResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

/**
 * Hook for sending commands to the multiclaude daemon.
 *
 * @example
 * ```tsx
 * const { sendCommand, loading, error } = useDaemon();
 *
 * const handleKill = async () => {
 *   await sendCommand('remove_agent', { repo: 'my-repo', name: 'worker-1' });
 * };
 * ```
 */
export function useDaemon() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendCommand = useCallback(
    async (command: string, args?: Record<string, unknown>): Promise<unknown> => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch('/api/daemon', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command, args }),
        });

        const data = (await res.json()) as DaemonResponse;

        if (!res.ok || data.error) {
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }

        return data.data;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Convenience methods for common operations
  const killAgent = useCallback(
    (repo: string, name: string) => sendCommand('remove_agent', { repo, name }),
    [sendCommand]
  );

  const restartAgent = useCallback(
    (repo: string, name: string) => sendCommand('restart_agent', { repo, name }),
    [sendCommand]
  );

  const stopRepo = useCallback(
    async (repo: string) => {
      // Stop all agents in a repo by removing each one
      // First get the list, then remove each
      const result = await sendCommand('list_agents', { repo }) as { agents: Record<string, unknown> };
      const names = Object.keys(result.agents || {});
      await Promise.all(names.map((name) => sendCommand('remove_agent', { repo, name })));
      return { stopped: names.length };
    },
    [sendCommand]
  );

  const triggerCleanup = useCallback(
    () => sendCommand('trigger_cleanup'),
    [sendCommand]
  );

  const spawnWorker = useCallback(
    (repo: string, task: string, name?: string) =>
      sendCommand('add_agent', {
        repo,
        name: name ?? generateWorkerName(),
        type: 'worker',
        task,
      }),
    [sendCommand]
  );

  const initRepo = useCallback(
    (githubUrl: string, name?: string, noMergeQueue?: boolean, mqTrack?: string) =>
      sendCommand('repo_init', { github_url: githubUrl, name, no_merge_queue: noMergeQueue, mq_track: mqTrack }),
    [sendCommand]
  );

  return {
    sendCommand,
    killAgent,
    restartAgent,
    stopRepo,
    triggerCleanup,
    spawnWorker,
    initRepo,
    loading,
    error,
  };
}

/** Generate a random worker name (adjective-animal) */
function generateWorkerName(): string {
  const adjectives = [
    'swift', 'clever', 'brave', 'keen', 'bold', 'calm', 'eager', 'fair',
    'glad', 'happy', 'jolly', 'kind', 'lively', 'merry', 'nice', 'proud',
    'quick', 'ready', 'silly', 'witty', 'zesty', 'bright', 'cool', 'daring',
  ];
  const animals = [
    'fox', 'owl', 'bear', 'wolf', 'deer', 'hawk', 'lion', 'seal',
    'duck', 'frog', 'goat', 'hare', 'lynx', 'mole', 'newt', 'orca',
    'puma', 'robin', 'swan', 'tiger', 'whale', 'zebra', 'eagle', 'otter',
  ];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const animal = animals[Math.floor(Math.random() * animals.length)];
  return `${adj}-${animal}`;
}
