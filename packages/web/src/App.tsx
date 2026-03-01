import { AgentList } from './components/AgentList';
import { MessageFeed } from './components/MessageFeed';
import { TaskDashboard } from './components/TaskDashboard';
import { useMulticlaude, useDaemonStatus } from './hooks/useMulticlaude';
import { useDaemonCommands } from './hooks/useDaemonCommands';
import { AddRepoModal } from './components/AddRepoModal';
import { useState, useEffect } from 'react';

/**
 * Main dashboard application.
 *
 * Uses hooks from useMulticlaude to fetch and display daemon state.
 * Provides interactive controls for managing agents and workspaces.
 */
function App() {
  const { state, loading, error, refresh } = useMulticlaude();
  const { connected, checking } = useDaemonStatus();
  const {
    stopAllAgents,
    stopDaemon,
    triggerCleanup,
    loading: commandLoading,
    error: commandError,
    clearError,
  } = useDaemonCommands();
  const [currentRepo, setCurrentRepo] = useState<string | null>(null);
  const [showDangerZone, setShowDangerZone] = useState(false);
  const [showAddRepo, setShowAddRepo] = useState(false);

  // Auto-select first repo when state loads
  useEffect(() => {
    if (state && !currentRepo) {
      const repoNames = Object.keys(state.repos);
      const firstRepo = repoNames[0];
      if (firstRepo) {
        setCurrentRepo(firstRepo);
      }
    }
  }, [state, currentRepo]);

  const repos = state ? Object.keys(state.repos) : [];
  const currentAgents = currentRepo ? state?.repos[currentRepo]?.agents ?? {} : {};
  const agentCount = Object.keys(currentAgents).length;
  const runningAgentCount = Object.values(currentAgents).filter(
    (a) => a.pid > 0 && !a.ready_for_cleanup
  ).length;

  const handleStopAll = async () => {
    if (!currentRepo) return;
    const agentNames = Object.keys(currentAgents);
    if (agentNames.length === 0) return;

    const confirmed = window.confirm(
      `Stop all ${agentNames.length} agents in ${currentRepo}?`
    );
    if (!confirmed) return;

    await stopAllAgents(currentRepo, agentNames);
    void refresh();
  };

  const handleStopDaemon = async () => {
    const confirmed = window.confirm(
      'Stop the multiclaude daemon? This will terminate all agents across all repositories.'
    );
    if (!confirmed) return;

    await stopDaemon();
  };

  const handleCleanup = async () => {
    await triggerCleanup();
    void refresh();
  };

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 text-white p-4 flex flex-col h-screen sticky top-0">
        <h1 className="text-xl font-bold mb-6 shrink-0">Multiclaude</h1>

        <nav className="space-y-2 flex-1 overflow-y-auto min-h-0">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs uppercase tracking-wider text-gray-400">
              Repositories
            </h2>
            <button
              onClick={() => setShowAddRepo(true)}
              className="text-gray-400 hover:text-white transition-colors p-0.5 rounded hover:bg-gray-700"
              title="Add repository"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
          {repos.length === 0 ? (
            <p className="text-gray-500 text-sm">No repositories tracked</p>
          ) : (
            repos.map((repo) => {
              const repoAgents = state?.repos[repo]?.agents ?? {};
              const repoAgentCount = Object.keys(repoAgents).length;
              const repoRunning = Object.values(repoAgents).filter(
                (a) => a.pid > 0 && !a.ready_for_cleanup
              ).length;

              return (
                <button
                  key={repo}
                  onClick={() => setCurrentRepo(repo)}
                  className={`w-full text-left px-3 py-2 rounded transition-colors ${
                    currentRepo === repo
                      ? 'bg-mc-primary-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="truncate">{repo}</span>
                    {repoAgentCount > 0 && (
                      <span className="text-xs bg-gray-700 px-1.5 py-0.5 rounded">
                        {repoRunning}/{repoAgentCount}
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </nav>

        {/* Status Section */}
        <div className="mt-8 border-t border-gray-700 pt-4 shrink-0">
          <h2 className="text-xs uppercase tracking-wider text-gray-400 mb-2">
            Status
          </h2>
          <div className="flex items-center gap-2 text-sm">
            <span
              className={`w-2 h-2 rounded-full ${
                checking
                  ? 'bg-yellow-500 animate-pulse'
                  : connected
                    ? 'bg-green-500'
                    : 'bg-red-500'
              }`}
            />
            <span className="text-gray-400">
              Daemon: {checking ? 'Checking...' : connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <button
            onClick={() => void refresh()}
            disabled={loading}
            className="mt-2 text-xs text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {/* Controls Section */}
        <div className="mt-4 border-t border-gray-700 pt-4 shrink-0">
          <h2 className="text-xs uppercase tracking-wider text-gray-400 mb-2">
            Controls
          </h2>
          <div className="space-y-2">
            <button
              onClick={() => void handleCleanup()}
              disabled={commandLoading || !connected}
              className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-800
                         rounded transition-colors disabled:opacity-50"
            >
              Cleanup Dead Agents
            </button>

            <button
              onClick={() => setShowDangerZone(!showDangerZone)}
              className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:text-gray-300
                         rounded transition-colors"
            >
              {showDangerZone ? '▼' : '▶'} Danger Zone
            </button>

            {showDangerZone && (
              <div className="pl-3 space-y-2">
                <button
                  onClick={() => void handleStopDaemon()}
                  disabled={commandLoading || !connected}
                  className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-900/30
                             rounded transition-colors disabled:opacity-50"
                >
                  Stop Daemon
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Command Error Display */}
        {commandError && (
          <div className="mt-4 p-2 bg-red-900/50 border border-red-700 rounded text-red-300 text-xs">
            <div className="flex justify-between">
              <span>{commandError}</span>
              <button onClick={clearError} className="text-red-400 hover:text-red-200">
                ×
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* Main content */}
      <main className="flex-1 p-6 bg-gray-100">
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            <strong>Error:</strong> {error.message}
          </div>
        )}
        {!currentRepo ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500">
              <h2 className="text-2xl font-semibold mb-2">
                Welcome to Multiclaude Dashboard
              </h2>
              <p>Select a repository from the sidebar to get started.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <header className="flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold">{currentRepo}</h2>
                <p className="text-gray-500">
                  {state?.repos[currentRepo]?.github_url ?? 'Loading...'}
                </p>
              </div>

              {/* Repo-level stats and controls */}
              <div className="flex items-center gap-4">
                <div className="text-right text-sm">
                  <div className="text-gray-500">Agents</div>
                  <div className="font-semibold">
                    {runningAgentCount} running / {agentCount} total
                  </div>
                </div>
              </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <AgentList
                agents={currentAgents}
                repoName={currentRepo}
                onStopAll={runningAgentCount > 0 ? () => void handleStopAll() : undefined}
              />
              <MessageFeed repoName={currentRepo} />
            </div>

            <TaskDashboard
              history={state?.repos[currentRepo]?.task_history ?? []}
              agents={currentAgents}
              repoName={currentRepo}
              onRefresh={() => { void refresh(); }}
            />
          </div>
        )}
      </main>

      <AddRepoModal
        isOpen={showAddRepo}
        onClose={() => setShowAddRepo(false)}
        onAdded={() => { void refresh(); }}
      />
    </div>
  );
}

export default App;
