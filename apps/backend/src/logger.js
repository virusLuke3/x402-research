import fs from 'fs';
import path from 'path';

const DEFAULT_LOG_PATH = path.resolve(process.cwd(), 'logs', 'backend.log');
const LOG_PATH = process.env.BACKEND_LOG_PATH || DEFAULT_LOG_PATH;
const REDACT_KEYS = new Set([
  'authorization',
  'apiKey',
  'openai_api_key',
  'openaiapikey',
  'mnemonic',
  'stacks_deployer_mnemonic',
  'token',
  'paymenttoken',
]);

function ensureLogDir() {
  fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
}

function truncate(value, max = 500) {
  const text = String(value ?? '');
  return text.length > max ? `${text.slice(0, max)}...<truncated>` : text;
}

function sanitize(value, seen = new WeakSet()) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return truncate(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Error) {
    return {
      name: value.name,
      message: truncate(value.message),
      stack: truncate(value.stack, 2000),
    };
  }
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitize(item, seen));
  }
  if (typeof value !== 'object') return truncate(value);
  if (seen.has(value)) return '[Circular]';
  seen.add(value);

  const entries = Object.entries(value).slice(0, 50).map(([key, entryValue]) => {
    const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (REDACT_KEYS.has(normalized)) {
      return [key, '[REDACTED]'];
    }
    return [key, sanitize(entryValue, seen)];
  });

  return Object.fromEntries(entries);
}

function write(level, event, meta = {}) {
  try {
    ensureLogDir();
    const record = {
      ts: new Date().toISOString(),
      level,
      event,
      meta: sanitize(meta),
    };
    fs.appendFileSync(LOG_PATH, `${JSON.stringify(record)}\n`, 'utf8');
  } catch (error) {
    console.error('Failed to write backend log:', error);
  }
}

export function createRequestId(prefix = 'req') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function getLogPath() {
  return LOG_PATH;
}

export function logInfo(event, meta = {}) {
  write('info', event, meta);
}

export function logWarn(event, meta = {}) {
  write('warn', event, meta);
}

export function logError(event, meta = {}) {
  write('error', event, meta);
}
