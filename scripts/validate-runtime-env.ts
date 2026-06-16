#!/usr/bin/env node

// @MX:NOTE Runtime env preflight for public dev validation.
// @MX:SPEC Issue #165 — fail fast before next dev opens a public URL.

import { parseEnv } from '../lib/env.ts';

parseEnv(process.env);
process.stdout.write('[env] runtime validation passed\n');
