import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const execFileAsync = promisify(execFile);

export async function ensureDir(dirPath) {
  await mkdir(dirPath, { recursive: true });
}

export async function runCommand(command, args, options = {}) {
  const { stdout, stderr } = await execFileAsync(command, args, {
    maxBuffer: 50 * 1024 * 1024,
    ...options,
  });
  return { stdout, stderr };
}

export function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200);
}

export function getTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

export function resolvePath(...segments) {
  return path.resolve(...segments);
}
