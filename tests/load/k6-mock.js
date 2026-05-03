// @MX:NOTE: [AUTO] k6 mock-mode load test — REQ-LAUNCH-025, REQ-LAUNCH-028
// @MX:SPEC: SPEC-REGULA-LAUNCH-001
//
// Lightweight smoke test using MSW-backed local dev server.
// Run with: k6 run --env BASE_URL=http://localhost:3000 tests/load/k6-mock.js
//
// REQ-LAUNCH-028: Production URL guard — this script MUST NOT run against prod.

import { check, sleep } from 'k6';
import http from 'k6/http';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Production URL guard (REQ-LAUNCH-028)
// Executed at module-level so it aborts before any VUs start.
if (
  BASE_URL.includes('regula.') ||
  BASE_URL.includes('vercel.app') ||
  BASE_URL.includes('neon.tech')
) {
  throw new Error(
    `ABORT: BASE_URL appears to be a production URL: ${BASE_URL}. Use a staging or local URL only. Never run load tests against production.`,
  );
}

export const options = {
  vus: 5,
  duration: '1m',
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const res = http.get(`${BASE_URL}/api/health`);
  check(res, { 'health ok': (r) => r.status === 200 });
  sleep(0.5);
}
