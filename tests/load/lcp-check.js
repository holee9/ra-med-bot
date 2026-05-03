import { check } from 'k6';
import { chromium } from 'k6/experimental/browser';

export const options = {
  scenarios: {
    lcp_check: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 3,
      options: {
        browser: {
          type: 'chromium',
        },
      },
    },
  },
  thresholds: {
    browser_web_vital_lcp: ['p(95)<2500'], // Good LCP < 2.5s (Core Web Vitals)
    browser_web_vital_fid: ['p(95)<100'], // Good FID < 100ms
    browser_web_vital_cls: ['p(95)<0.1'], // Good CLS < 0.1
  },
};

export default async function () {
  const browser = chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

  try {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    const lcp = await page.evaluate(() => {
      return new Promise((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          resolve(lastEntry ? lastEntry.startTime : 0);
        }).observe({ type: 'largest-contentful-paint', buffered: true });
        setTimeout(() => resolve(0), 5000);
      });
    });

    check(page, {
      'LCP is acceptable': () => lcp < 2500,
    });
  } finally {
    await page.close();
    await context.close();
    await browser.close();
  }
}
