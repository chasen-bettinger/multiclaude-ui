#!/usr/bin/env node

import { createServer } from 'vite';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const MULTICLAUDE_DIR = join(homedir(), '.multiclaude');
const STATE_PATH = join(MULTICLAUDE_DIR, 'state.json');

// Check if multiclaude daemon is running
try {
  const { stdout } = await execAsync('multiclaude daemon status', { timeout: 5000 });
  if (stdout.includes('Daemon is not running')) {
    console.error('❌ multiclaude daemon is not running');
    console.error('   Start the daemon first: multiclaude start');
    process.exit(1);
  }
} catch {
  console.error('❌ Could not check multiclaude daemon status');
  console.error('   Make sure multiclaude is installed and daemon is running: multiclaude start');
  process.exit(1);
}

console.log('🚀 Starting multiclaude-ui dashboard...');
console.log('   Reading state from:', STATE_PATH);

async function runMulticlaudeCommand(args) {
  const cmd = `multiclaude ${args.join(' ')}`;
  try {
    return await execAsync(cmd, { timeout: 30000 });
  } catch (err) {
    throw new Error(err.stderr || err.message || 'Command failed');
  }
}

async function handleDaemonCommand(command, args) {
  switch (command) {
    case 'remove_agent': {
      const { repo, name } = args || {};
      if (!repo || !name) throw new Error('Missing repo or name');
      await runMulticlaudeCommand(['worker', 'rm', name, '--repo', repo]);
      return { success: true, message: `Removed ${name}` };
    }
    case 'add_agent': {
      const { repo, task } = args || {};
      if (!repo || !task) throw new Error('Missing repo or task');
      await runMulticlaudeCommand(['worker', 'create', `"${task}"`, '--repo', repo]);
      return { success: true };
    }
    case 'trigger_cleanup': {
      await runMulticlaudeCommand(['cleanup']);
      return { success: true };
    }
    case 'list_agents': {
      const { repo } = args || {};
      if (!repo) throw new Error('Missing repo');
      const state = JSON.parse(readFileSync(STATE_PATH, 'utf-8'));
      return { agents: state.repos?.[repo]?.agents || {} };
    }
    case 'stop': {
      await runMulticlaudeCommand(['stop-all']);
      return { success: true };
    }
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

const server = await createServer({
  root,
  server: { port: 3000 },
  plugins: [{
    name: 'multiclaude-api',
    configureServer(server) {
      server.middlewares.use('/api/daemon-status', async (_req, res) => {
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

      server.middlewares.use('/api/daemon', async (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        try {
          const body = await parseBody(req);
          const result = await handleDaemonCommand(body.command, body.args);
          res.end(JSON.stringify({ success: true, data: result }));
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    }
  }]
});

await server.listen();
server.printUrls();
console.log('\n   Press Ctrl+C to stop\n');
