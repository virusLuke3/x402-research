import fs from 'fs';
import path from 'path';
import { execFileSync, spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(frontendRoot, '..', '..');
const preferredPort = '5173';
const stalePorts = ['5173', '5174'];
let child = null;
let isStopping = false;

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

function isFrontendProcess(command) {
  return command.includes(repoRoot) && command.includes('vite');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function clearStaleFrontendPorts() {
  for (const port of stalePorts) {
    const pids = getListeningPids(port);
    if (!pids.length) continue;

    for (const pid of pids) {
      const command = getCommandForPid(pid);
      if (!isFrontendProcess(command)) {
        console.error(`Port ${port} is already in use by another process: ${command || pid}`);
        process.exit(1);
      }
    }

    for (const pid of pids) {
      console.log(`Stopping stale frontend dev server on port ${port} (pid ${pid})...`);
      await stopProcess(pid);
    }
  }
}

function resolveViteBin() {
  const candidates = [
    path.resolve(repoRoot, 'node_modules', 'vite', 'bin', 'vite.js'),
    path.resolve(frontendRoot, 'node_modules', 'vite', 'bin', 'vite.js')
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error('Unable to locate vite binary');
}

async function main() {
  await clearStaleFrontendPorts();
  const viteBin = resolveViteBin();
  child = spawn(process.execPath, [viteBin, '--host', '0.0.0.0', '--port', preferredPort, '--strictPort'], {
    cwd: frontendRoot,
    env: process.env,
    stdio: 'inherit'
  });

  const shutdown = async () => {
    if (isStopping) return;
    isStopping = true;
    if (child) {
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
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  child.on('exit', (code, signal) => {
    child = null;
    if (isStopping) return;
    process.exit(code ?? (signal === 'SIGTERM' ? 0 : 1));
  });
}

main().catch((error) => {
  console.error('Failed to start frontend dev runner:', error);
  process.exit(1);
});
