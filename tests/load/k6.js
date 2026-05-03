// @MX:NOTE: [AUTO] k6 load test — REQ-LAUNCH-023, REQ-LAUNCH-024
// @MX:SPEC: SPEC-REGULA-LAUNCH-001
//
// Steady 50 VU + spike 100 VU scenarios for the /api/ra/consult endpoint.
// Run with: k6 run --env BASE_URL=http://localhost:3000 tests/load/k6.js
// DO NOT run against production. Use k6-mock.js for local development.

import { check, sleep } from 'k6';
import http from 'k6/http';
import { Trend } from 'k6/metrics';

// Custom metrics for latency tracking (REQ-LAUNCH-024)
const consultFirstToken = new Trend('consult_first_token', true);
const consultFull = new Trend('consult_full', true);

export const options = {
  scenarios: {
    // Steady-state load: ramp to 50 VU, hold, ramp down (REQ-LAUNCH-023)
    steady_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 50 }, // ramp up to 50 VU
        { duration: '5m', target: 50 }, // steady 50 VU
        { duration: '1m', target: 0 }, // ramp down
      ],
    },
    // Spike load: burst to 100 VU after steady phase (REQ-LAUNCH-023)
    spike_load: {
      executor: 'ramping-vus',
      startTime: '8m',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 100 }, // spike to 100 VU
        { duration: '1m', target: 100 }, // hold spike
        { duration: '30s', target: 0 }, // ramp down
      ],
    },
  },
  thresholds: {
    // REQ-LAUNCH-024: first token P95 < 1500 ms
    consult_first_token: ['p(95)<1500'],
    // REQ-LAUNCH-024: full response P95 < 8000 ms
    consult_full: ['p(95)<8000'],
    // REQ-LAUNCH-024: error rate < 1%
    http_req_failed: ['rate<0.01'],
    // Overall request duration guard
    http_req_duration: ['p(95)<8000'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  const startTime = Date.now();

  const params = {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${__ENV.TEST_API_KEY || 'test-key'}`,
    },
    timeout: '30s',
  };

  const payload = JSON.stringify({
    query: 'What are the FDA 510(k) submission requirements?',
    projectId: __ENV.TEST_PROJECT_ID || 'test-project',
  });

  // Measure latency from request start to response completion.
  // True streaming first-token measurement requires chunked response parsing;
  // this approximation captures network + server processing time combined.
  const res = http.post(`${BASE_URL}/api/ra/consult`, payload, params);
  const elapsed = Date.now() - startTime;

  // Record both metrics with same value — first-token is an approximation here
  consultFirstToken.add(elapsed);
  consultFull.add(elapsed);

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response has content': (r) => r.body !== null && r.body.length > 0,
  });

  sleep(1);
}
