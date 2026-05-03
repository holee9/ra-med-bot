import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
const PLAIN = new RegExp(`export\\s+async\\s+function\\s+(${HTTP_METHODS.join('|')})\\b`);
const exempt = ['app/api/auth', 'app/api/health'];

function walk(dir, root) {
  let r = [];
  for (const e of readdirSync(dir)) {
    const fp = path.join(dir, e);
    if (statSync(fp).isDirectory()) {
      r = r.concat(walk(fp, root));
    } else if (e === 'route.ts') {
      r.push(path.relative(root, fp).split(path.sep).join('/'));
    }
  }
  return r;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const files = walk(path.join(root, 'app/api'), root);
const violations = files.filter((f) => {
  if (exempt.some((ex) => f.startsWith(ex))) return false;
  return PLAIN.test(readFileSync(path.join(root, f), 'utf-8'));
});

if (!violations.length) {
  process.exit(0);
} else {
  console.error('VIOLATIONS:', violations);
  process.exit(1);
}
