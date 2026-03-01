import { useState } from 'react';
import { Modal } from './Modal';
import { useDaemon } from '../hooks/useDaemon';

interface AddRepoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdded: () => void;
}

/**
 * Modal form for adding a new repository via `multiclaude repo init`.
 */
export function AddRepoModal({ isOpen, onClose, onAdded }: AddRepoModalProps) {
  const { initRepo, loading } = useDaemon();
  const [githubUrl, setGithubUrl] = useState('');
  const [name, setName] = useState('');
  const [mergeQueue, setMergeQueue] = useState(true);
  const [mqTrack, setMqTrack] = useState('all');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!githubUrl.trim()) return;

    setError(null);
    try {
      await initRepo(
        githubUrl.trim(),
        name.trim() || undefined,
        !mergeQueue || undefined,
        mergeQueue ? mqTrack : undefined
      );
      setGithubUrl('');
      setName('');
      setMergeQueue(true);
      setMqTrack('all');
      onAdded();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Repository">
      <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
        <div>
          <label htmlFor="github-url" className="block text-sm font-medium text-gray-700 mb-1">
            GitHub URL <span className="text-red-500">*</span>
          </label>
          <input
            id="github-url"
            type="text"
            value={githubUrl}
            onChange={(e) => setGithubUrl(e.target.value)}
            placeholder="https://github.com/owner/repo"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2
                       focus:ring-mc-primary-500 focus:border-mc-primary-500"
            autoFocus
            required
          />
        </div>

        <div>
          <label htmlFor="repo-name" className="block text-sm font-medium text-gray-700 mb-1">
            Name
          </label>
          <input
            id="repo-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Derived from URL if omitted"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2
                       focus:ring-mc-primary-500 focus:border-mc-primary-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            id="merge-queue"
            type="checkbox"
            checked={mergeQueue}
            onChange={(e) => setMergeQueue(e.target.checked)}
            className="h-4 w-4 text-mc-primary-600 rounded border-gray-300
                       focus:ring-mc-primary-500"
          />
          <label htmlFor="merge-queue" className="text-sm text-gray-700">
            Enable Merge Queue
          </label>
        </div>

        {mergeQueue && (
          <div>
            <label htmlFor="mq-track" className="block text-sm font-medium text-gray-700 mb-1">
              MQ Track Mode
            </label>
            <select
              id="mq-track"
              value={mqTrack}
              onChange={(e) => setMqTrack(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2
                         focus:ring-mc-primary-500 focus:border-mc-primary-500"
            >
              <option value="all">All</option>
              <option value="author">Author</option>
              <option value="assigned">Assigned</option>
            </select>
          </div>
        )}

        {error && (
          <div className="p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading || !githubUrl.trim()}
            className="px-4 py-2 bg-mc-primary-600 text-white rounded-lg
                       hover:bg-mc-primary-700 disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors flex items-center gap-2"
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Adding...
              </>
            ) : (
              'Add Repository'
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
