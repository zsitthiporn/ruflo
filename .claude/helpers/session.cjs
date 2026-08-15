#!/usr/bin/env node
/**
 * Claude Flow Cross-Platform Session Manager
 * Works on Windows, macOS, and Linux
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const platform = os.platform();
const homeDir = os.homedir();

// Resolve the workspace root the same way the rest of the state layer does.
// #19 follow-up: this used to read process.cwd() directly and, when that
// directory had no .claude-flow, fall back to ONE unnamespaced user-scope
// sessions directory shared by every project on the machine. It happens to
// land project-side today only because Claude Code runs hooks with the
// workspace as cwd — any invocation that does not (an MCP server, a daemon,
// a shell started elsewhere) silently shared session state across projects.
function projectRoot() {
  const pin = process.env.CLAUDE_FLOW_CWD;
  if (pin && pin !== '/' && pin !== process.env.HOME) return pin;
  return process.cwd();
}

function workspaceSlug(root) {
  const digest = crypto.createHash('sha256').update(root).digest('hex').slice(0, 8);
  const name = path.basename(root).replace(/[^A-Za-z0-9._-]/g, '_') || 'workspace';
  return name + '-' + digest;
}

function getDataDir() {
  const root = projectRoot();
  const localDir = path.join(root, '.claude-flow', 'sessions');

  // An explicit pin is an instruction, not a hint: honour it before
  // .claude-flow exists, which is what a freshly wired workspace looks like.
  if (root !== process.cwd() || fs.existsSync(path.join(root, '.claude-flow'))) {
    return localDir;
  }

  // Project-less invocation: still user-scope, but namespaced per workspace
  // so two projects can never share one session file.
  const slug = workspaceSlug(root);
  switch (platform) {
    case 'win32':
      return path.join(process.env.APPDATA || homeDir, 'claude-flow', 'sessions', 'workspaces', slug);
    case 'darwin':
      return path.join(homeDir, 'Library', 'Application Support', 'claude-flow', 'sessions', 'workspaces', slug);
    default:
      return path.join(homeDir, '.claude-flow', 'sessions', 'workspaces', slug);
  }
}

const SESSION_DIR = getDataDir();
const SESSION_FILE = path.join(SESSION_DIR, 'current.json');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const commands = {
  start: () => {
    ensureDir(SESSION_DIR);
    const sessionId = `session-${Date.now()}`;
    const session = {
      id: sessionId,
      startedAt: new Date().toISOString(),
      platform: platform,
      cwd: process.cwd(),
      context: {},
      metrics: { edits: 0, commands: 0, tasks: 0, errors: 0 }
    };
    fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2));
    console.log(`Session started: ${sessionId}`);
    return session;
  },

  restore: () => {
    if (!fs.existsSync(SESSION_FILE)) {
      console.log('No session to restore');
      return null;
    }
    const session = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
    session.restoredAt = new Date().toISOString();
    fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2));
    console.log(`Session restored: ${session.id}`);
    return session;
  },

  end: () => {
    if (!fs.existsSync(SESSION_FILE)) {
      console.log('No active session');
      return null;
    }
    const session = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
    session.endedAt = new Date().toISOString();
    session.duration = Date.now() - new Date(session.startedAt).getTime();

    const archivePath = path.join(SESSION_DIR, `${session.id}.json`);
    fs.writeFileSync(archivePath, JSON.stringify(session, null, 2));
    fs.unlinkSync(SESSION_FILE);

    console.log(`Session ended: ${session.id}`);
    console.log(`Duration: ${Math.round(session.duration / 1000 / 60)} minutes`);
    return session;
  },

  status: () => {
    if (!fs.existsSync(SESSION_FILE)) {
      console.log('No active session');
      return null;
    }
    const session = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
    const duration = Date.now() - new Date(session.startedAt).getTime();
    console.log(`Session: ${session.id}`);
    console.log(`Platform: ${session.platform}`);
    console.log(`Started: ${session.startedAt}`);
    console.log(`Duration: ${Math.round(duration / 1000 / 60)} minutes`);
    return session;
  },

  metric: (name) => {
    if (!fs.existsSync(SESSION_FILE)) {
      return null;
    }
    const session = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
    if (session.metrics[name] !== undefined) {
      session.metrics[name]++;
      fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2));
    }
    return session;
  }
};

module.exports = commands;

// CLI - only run when executed directly
if (require.main === module) {
  const [,, command, ...args] = process.argv;
  if (command && commands[command]) {
    commands[command](...args);
  } else {
    console.log('Usage: session.js <start|restore|end|status|metric>');
    console.log(`Platform: ${platform}`);
    console.log(`Data dir: ${SESSION_DIR}`);
  }
}
