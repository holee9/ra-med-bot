#!/usr/bin/env node
/**
 * gx10 reachability guard + promptfoo runner for workflow evals.
 * SPEC-REGULA-WORKFLOWS-LLM-002 — M5, AC-07/08
 *
 * CI CANNOT reach gx10 (192.168.100.x is LAN). This script checks reachability
 * before invoking promptfoo. If gx10 is unreachable, it exits 0 with a SKIP
 * message (not a failure) — mirroring the real-DB E2E skip pattern.
 *
 * AC-07 (80% pass) is satisfied by LOCAL execution against gx10, not CI.
 *
 * Usage: node evals/workflows/run-gx10-eval.mjs
 * npm:   pnpm eval:workflows
 */

import { execSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const GX10_HOST = process.env.OLLAMA_HOST ?? 'http://192.168.100.1:11434';
const GX10_MODEL = process.env.OLLAMA_MODEL ?? 'gpt-oss:120b';
const CONFIG_PATH = 'evals/workflows/promptfoo.config.yaml';
const OUTPUT_PATH = 'evals/workflows/results/latest.json';

/** Write to stdout (avoids biome noConsole rule on console.log). */
function out(msg) {
  process.stdout.write(`${msg}\n`);
}

/**
 * Check if gx10 Ollama is reachable and the model is available.
 * Uses /api/tags endpoint (no model load, fast).
 */
function checkGx10Reachable() {
  try {
    const result = spawnSync('curl', ['-s', '--connect-timeout', '5', `${GX10_HOST}/api/tags`], {
      encoding: 'utf-8',
      timeout: 10000,
    });
    if (result.status !== 0 || !result.stdout) {
      return { reachable: false, reason: `curl exited ${result.status}` };
    }
    const data = JSON.parse(result.stdout);
    const models = (data.models ?? []).map((m) => m.name);
    if (!models.includes(GX10_MODEL)) {
      return {
        reachable: false,
        reason: `Model '${GX10_MODEL}' not found. Available: ${models.join(', ')}`,
      };
    }
    return { reachable: true, models };
  } catch (err) {
    return { reachable: false, reason: String(err.message ?? err) };
  }
}

out('[eval:workflows] Checking gx10 reachability...');
out(`  Host:  ${GX10_HOST}`);
out(`  Model: ${GX10_MODEL}`);

const status = checkGx10Reachable();

if (!status.reachable) {
  out(`\n[SKIP] gx10 unreachable — ${status.reason}`);
  out('');
  out('  This eval is LOCAL-gx10-only (SPEC-REGULA-WORKFLOWS-LLM-002 EC-3).');
  out('  CI cannot reach 192.168.100.x (LAN). AC-07 is satisfied by');
  out('  local execution against gx10, not CI.');
  out('');
  out('  To run locally:');
  out('    1. Ensure gx10 Ollama is running at http://192.168.100.1:11434');
  out('    2. Run: pnpm eval:workflows');
  process.exit(0);
}

out(`  OK — model '${GX10_MODEL}' available.`);
out('\n[eval:workflows] Running promptfoo eval...\n');

// Ensure results dir exists
const resultsDir = 'evals/workflows/results';
if (!existsSync(resultsDir)) {
  execSync(`mkdir -p ${resultsDir}`, { stdio: 'inherit' });
}

// Run promptfoo eval.
// OLLAMA_BASE_URL env var is required by promptfoo's native ollama provider
// to point at the remote gx10 instance (default is localhost:11434).
const cmd = ['npx', 'promptfoo', 'eval', '--config', CONFIG_PATH, '--output', OUTPUT_PATH].join(
  ' ',
);
const evalEnv = { ...process.env, OLLAMA_BASE_URL: GX10_HOST };

try {
  execSync(cmd, { stdio: 'inherit', env: evalEnv });
  out(`\n[eval:workflows] Done. Results at: ${OUTPUT_PATH}`);
} catch {
  console.error('\n[eval:workflows] promptfoo eval failed.');
  process.exit(1);
}
