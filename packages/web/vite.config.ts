import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'http';

const execAsync = promisify(exec);
const MULTICLAUDE_DIR = join(homedir(), '.multiclaude');
const STATE_PATH = join(MULTICLAUDE_DIR, 'state.json');

/**
 * Execute a multiclaude CLI command.
 */
async function runMulticlaudeCommand(args: string[]): Promise<{ stdout: string; stderr: string }> {
  const cmd = `multiclaude ${args.join(' ')}`;
  try {
    const result = await execAsync(cmd, { timeout: 30000 });
    return result;
  } catch (err) {
    const error = err as { stdout?: string; stderr?: string; message?: string };
    throw new Error(error.stderr || error.message || 'Command failed');
  }
}

/**
 * Map API commands to multiclaude CLI commands.
 */
async function handleDaemonCommand(
  command: string,
  args?: Record<string, unknown>
): Promise<unknown> {
  switch (command) {
    case 'remove_agent': {
      const repo = args?.repo as string;
      const name = args?.name as string;
      if (!repo || !name) throw new Error('Missing repo or name');
      await runMulticlaudeCommand(['worker', 'rm', name, '--repo', repo]);
      return { success: true, message: `Removed ${name}` };
    }

    case 'add_agent': {
      const repo = args?.repo as string;
      const task = args?.task as string;
      if (!repo || !task) throw new Error('Missing repo or task');
      const cliArgs = ['worker', 'create', `"${task}"`, '--repo', repo];
      await runMulticlaudeCommand(cliArgs);
      return { success: true };
    }

    case 'trigger_cleanup': {
      await runMulticlaudeCommand(['cleanup']);
      return { success: true };
    }

    case 'list_agents': {
      const repo = args?.repo as string;
      if (!repo) throw new Error('Missing repo');
      // Read from state.json instead of CLI
      const state = JSON.parse(readFileSync(STATE_PATH, 'utf-8'));
      const agents = state.repos?.[repo]?.agents || {};
      return { agents };
    }

    case 'stop': {
      await runMulticlaudeCommand(['stop-all']);
      return { success: true };
    }

    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

/**
 * Parse JSON body from request.
 */
function parseBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Vite plugin for multiclaude API endpoints.
 */
function multiclaueApiPlugin(): Plugin {
  return {
    name: 'multiclaude-api',
    configureServer(server) {
      // GET /api/daemon-status - Check if daemon is running via CLI
      server.middlewares.use('/api/daemon-status', async (_req: IncomingMessage, res: ServerResponse) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');

        try {
          const { stdout } = await execAsync('multiclaude daemon status', { timeout: 5000 });
          const running = !stdout.includes('Daemon is not running');
          res.end(JSON.stringify({ running }));
        } catch {
          res.end(JSON.stringify({ running: false }));
        }
      });

      // GET /api/state - Read state.json
      server.middlewares.use('/api/state', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');

        if (!existsSync(STATE_PATH)) {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: 'state.json not found' }));
          return;
        }

        try {
          res.end(readFileSync(STATE_PATH, 'utf-8'));
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: String(err) }));
        }
      });

      // POST /api/daemon - Send command to daemon
      server.middlewares.use('/api/daemon', async (req: IncomingMessage, res: ServerResponse) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.end();
          return;
        }

        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        try {
          const body = await parseBody(req);
          const command = body.command as string;
          const args = body.args as Record<string, unknown> | undefined;

          if (!command) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Missing command' }));
            return;
          }

          const result = await handleDaemonCommand(command, args);
          res.end(JSON.stringify({ success: true, data: result }));
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: String(err instanceof Error ? err.message : err) }));
        }
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), multiclaueApiPlugin()],
  server: {
    port: 3000,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
