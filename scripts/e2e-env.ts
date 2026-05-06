#!/usr/bin/env node
// Loads .env.test and runs the requested command with those variables.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname ?? __dirname, '..');
const ENV_PATH = path.join(ROOT, '.env.test');

function unquote(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function loadEnvTest(): void {
  if (!fs.existsSync(ENV_PATH)) {
    process.stderr.write(
      '.env.test not found. Copy .env.test.example to .env.test before running E2E commands.\n',
    );
    process.exit(1);
  }

  const contents = fs.readFileSync(ENV_PATH, 'utf8');
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (key && process.env[key] === undefined) {
      process.env[key] = unquote(rawValue ?? '');
    }
  }
}

function main(): void {
  loadEnvTest();

  const [command, ...args] = process.argv.slice(2);
  if (!command) {
    process.stderr.write('Usage: pnpm env:test <command> [...args]\n');
    process.exit(1);
  }

  const child = spawn(command, args, {
    cwd: ROOT,
    env: process.env,
    shell: process.platform === 'win32',
    stdio: 'inherit',
  });

  child.on('error', (error) => {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  });

  child.on('exit', (code) => {
    process.exit(code ?? 1);
  });
}

main();
