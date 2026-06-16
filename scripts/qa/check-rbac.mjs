// @MX:NOTE [AUTO] RBAC coverage CI script — validates API route handlers and admin page route matrix.
// @MX:SPEC SPEC-REGULA-QUALITY-001 (REQ-QUAL-024, REQ-QUAL-025)
//
// Two-part validation:
//   1) API routes (app/api/**): every route.ts must wrap HTTP exports with withPermission (or be exempt).
//   2) Admin page routes (app/(app)/admin/**): every page.tsx must appear in ADMIN_PAGE_MATRIX,
//      and ADMIN_PAGE_MATRIX must not reference pages that no longer exist.
//      Additionally, the admin section layout (app/(app)/admin/layout.tsx) must enforce an
//      admin-only role guard; otherwise ra-lead users would see admin pages whose APIs reject them.
//
// Exits 1 on any violation; exits 0 when complete.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
const PLAIN = new RegExp(`export\\s+async\\s+function\\s+(${HTTP_METHODS.join('|')})\\b`);
const exempt = ['app/api/auth', 'app/api/health', 'app/api/ra/digest/[weekId]/route.ts'];

// REQ-QUAL-024: admin page route coverage matrix.
// Each entry asserts the expected RBAC outcome for non-admin / admin users.
// The actual enforcement lives in app/(app)/admin/layout.tsx (role guard -> redirect '/403').
// This matrix drives the gap-detection (REQ-QUAL-025) and serves as living documentation.
const ADMIN_PAGE_MATRIX = [
  {
    route: '/admin/documents',
    file: 'app/(app)/admin/documents/page.tsx',
    expectNonAdmin: 403,
    expectAdmin: 200,
    description: 'Internal SOP document list',
  },
  {
    route: '/admin/documents/upload',
    file: 'app/(app)/admin/documents/upload/page.tsx',
    expectNonAdmin: 403,
    expectAdmin: 200,
    description: 'Internal SOP upload form',
  },
  {
    route: '/admin/documents/[id]',
    file: 'app/(app)/admin/documents/[id]/page.tsx',
    expectNonAdmin: 403,
    expectAdmin: 200,
    description: 'Internal SOP document detail',
  },
  {
    route: '/admin/radar',
    file: 'app/(app)/admin/radar/page.tsx',
    expectNonAdmin: 403,
    expectAdmin: 200,
    description: 'Regulatory radar dashboard',
  },
];

function walk(dir, root) {
  let r = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return r;
  }
  for (const e of entries) {
    const fp = path.join(dir, e);
    let st;
    try {
      st = statSync(fp);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      r = r.concat(walk(fp, root));
    } else if (e === 'route.ts') {
      r.push(path.relative(root, fp).split(path.sep).join('/'));
    }
  }
  return r;
}

function findAdminPages(dir, root) {
  let r = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return r;
  }
  for (const e of entries) {
    const fp = path.join(dir, e);
    let st;
    try {
      st = statSync(fp);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      r = r.concat(findAdminPages(fp, root));
    } else if (e === 'page.tsx') {
      r.push(path.relative(root, fp).split(path.sep).join('/'));
    }
  }
  return r;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');

// --- Part 1: API route handler RBAC coverage (REQ-QUAL-024) ---
const files = walk(path.join(root, 'app/api'), root);
const apiViolations = files.filter((f) => {
  if (exempt.some((ex) => f.startsWith(ex))) return false;
  return PLAIN.test(readFileSync(path.join(root, f), 'utf-8'));
});

// --- Part 2: Admin page route matrix (REQ-QUAL-024) + gap detection (REQ-QUAL-025) ---
const adminPagesDir = path.join(root, 'app', '(app)', 'admin');
const discoveredPages = findAdminPages(adminPagesDir, root);
const matrixFiles = new Set(ADMIN_PAGE_MATRIX.map((e) => e.file));
const discoveredSet = new Set(discoveredPages);

// REQ-QUAL-025: any admin page in filesystem but NOT in matrix is a violation.
const missingFromMatrix = discoveredPages.filter((p) => !matrixFiles.has(p));
// Any matrix entry pointing to non-existent file is also a violation (stale matrix).
const missingFromFilesystem = ADMIN_PAGE_MATRIX.filter((e) => !discoveredSet.has(e.file)).map(
  (e) => e.file,
);

// --- Part 3: Admin layout role guard verification ---
const adminLayoutPath = path.join(root, 'app', '(app)', 'admin', 'layout.tsx');
let layoutGuardOk = false;
let layoutGuardReason = '';
if (!existsSync(adminLayoutPath)) {
  layoutGuardReason = 'app/(app)/admin/layout.tsx missing';
} else {
  const layoutSrc = readFileSync(adminLayoutPath, 'utf-8');
  const hasAuthCall = /\bauth\s*\(/.test(layoutSrc);
  const hasAdminCheck = /\badmin\b/.test(layoutSrc);
  const allowsRaLead = /\bra-lead\b/.test(layoutSrc);
  const hasRedirectOrForbidden = /\bredirect\s*\(\s*['"]\/403['"]\s*\)|notFound\s*\(/.test(
    layoutSrc,
  );
  layoutGuardOk = hasAuthCall && hasAdminCheck && !allowsRaLead && hasRedirectOrForbidden;
  if (!layoutGuardOk) {
    layoutGuardReason = `auth=${hasAuthCall} adminCheck=${hasAdminCheck} allowsRaLead=${allowsRaLead} redirect403=${hasRedirectOrForbidden}`;
  }
}

// --- Reporting ---
let failed = false;

if (apiViolations.length > 0) {
  failed = true;
  console.error('[rbac] API route handlers without withPermission wrapping:');
  for (const v of apiViolations) console.error(`  - ${v}`);
}

if (missingFromMatrix.length > 0) {
  failed = true;
  console.error(
    '[rbac] REQ-QUAL-025 violation — admin page exists in filesystem but missing from ADMIN_PAGE_MATRIX:',
  );
  for (const v of missingFromMatrix) console.error(`  - ${v}`);
  console.error('  Add an entry to ADMIN_PAGE_MATRIX in scripts/qa/check-rbac.mjs.');
}

if (missingFromFilesystem.length > 0) {
  failed = true;
  console.error('[rbac] Stale ADMIN_PAGE_MATRIX entry — file no longer exists in filesystem:');
  for (const v of missingFromFilesystem) console.error(`  - ${v}`);
}

if (!layoutGuardOk) {
  failed = true;
  console.error(
    `[rbac] Admin layout role guard missing or weakened (${layoutGuardReason}). All admin pages rely on app/(app)/admin/layout.tsx calling auth() and redirect('/403') for every non-admin user.`,
  );
}

if (!failed) {
  process.exit(0);
} else {
  process.exit(1);
}
