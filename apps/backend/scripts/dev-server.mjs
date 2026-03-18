import fs from 'fs';
import path from 'path';
import { execFileSync, spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(backendRoot, '..', '..');
const srcDir = path.resolve(backendRoot, 'src');
const envFile = path.resolve(repoRoot, '.env');

function readConfiguredPort() {
  if (fs.existsSync(envFile)) {
    const lines = fs.readFileSync(envFile, 'utf8').split('\n');
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#') || !line.startsWith('PORT=')) continue;
      const value = line.slice('PORT='.length).trim().replace(/^['"]|['"]$/g, '');
      if (value) return value;
    }
  }
  return process.env.PORT || '8787';
}

const port = String(readConfiguredPort());

let child = null;
let watcher = null;
let restartTimer = null;
let isStopping = false;
let isRestarting = false;

function shouldIgnoreWatchEvent(filename = '') {
  const normalized = String(filename || '').replace(/\\/g, '/');
  return (
    normalized.includes('/__pycache__/')
    || normalized.endsWith('.pyc')
    || normalized.endsWith('.pyo')
    || normalized.endsWith('.log')
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeExec(command, args) {
  try {
    return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

function getListeningPids(targetPort) {
  const output = safeExec('lsof', ['-tiTCP:' + targetPort, '-sTCP:LISTEN']);
  return output
    .split('\n')
    .map((value) => value.trim())
    .filter(Boolean);
}

function getCommandForPid(pid) {
  return safeExec('ps', ['-p', String(pid), '-o', 'command=']);
}

function isBackendProcess(command) {
  return command.includes('src/server.js') && command.includes('node');
}

async function stopProcess(pid) {
  try {
    process.kill(Number(pid), 'SIGTERM');
  } catch {
    return;
  }

  for (let attempt = 0; attempt < 20; attempt += 1) {
    await sleep(150);
    try {
      process.kill(Number(pid), 0);
    } catch {
      return;
    }
  }

  try {
    process.kill(Number(pid), 'SIGKILL');
  } catch {
    return;
  }
}

async function clearStaleBackendOnPort() {
  const pids = getListeningPids(port);
  if (!pids.length) return;

  for (const pid of pids) {
    const command = getCommandForPid(pid);
    if (!isBackendProcess(command)) {
      console.error(`Port ${port} is already in use by another process: ${command || pid}`);
      process.exit(1);
    }
  }

  for (const pid of pids) {
    console.log(`Stopping stale backend process on port ${port} (pid ${pid})...`);
    await stopProcess(pid);
  }
}

function spawnServer() {
  child = spawn(process.execPath, ['src/server.js'], {
    cwd: backendRoot,
    env: process.env,
    stdio: 'inherit'
  });

  child.on('exit', (code, signal) => {
    child = null;
    if (isStopping) return;
    if (isRestarting) {
      isRestarting = false;
      spawnServer();
      return;
    }
    if (code !== 0 && signal !== 'SIGTERM') {
      console.error(`Backend exited unexpectedly (${signal || code}). Waiting for file changes...`);
    }
  });
}

async function stopChild() {
  if (!child) return;
  const current = child;
  child = null;
  current.kill('SIGTERM');
  await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      current.kill('SIGKILL');
      resolve();
    }, 4000);
    current.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

function scheduleRestart(reason) {
  if (isStopping) return;
  clearTimeout(restartTimer);
  restartTimer = setTimeout(async () => {
    if (isRestarting) return;
    console.log(`Restarting backend (${reason})...`);
    isRestarting = true;
    await stopChild();
  }, 120);
}

function watchTarget(target) {
  if (!fs.existsSync(target)) return null;
  return fs.watch(target, { recursive: fs.statSync(target).isDirectory() }, (_eventType, filename) => {
    if (shouldIgnoreWatchEvent(filename)) return;
    scheduleRestart(filename ? `${path.basename(target)}:${filename}` : path.basename(target));
  });
}

async function shutdown() {
  if (isStopping) return;
  isStopping = true;
  clearTimeout(restartTimer);
  watcher?.close?.();
  await stopChild();
  process.exit(0);
}

async function main() {
  await clearStaleBackendOnPort();
  spawnServer();

  const watchers = [watchTarget(srcDir), watchTarget(envFile)].filter(Boolean);
  watcher = {
    close() {
      for (const item of watchers) item.close();
    }
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error('Failed to start backend dev runner:', error);
  process.exit(1);
});
