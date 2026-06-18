import { type Page, expect, test } from '@playwright/test';

/**
 * Go/No-Go Criteria Evaluation E2E Test
 *
 * Purpose: Evaluate Go/No-Go criteria for each persona
 *
 * Criteria Structure:
 * - Go: Meets minimum requirements
 * - No-Go: Does not meet minimum requirements
 */

// Go/No-Go Criteria Definitions
const RA_LEAD_GO_CRITERIA = {
  experience: {
    fda_510k: '5년 이상',
    eu_mdr: 'Class IIb/III 제출 경험 2건 이상',
  },
  knowledge: {
    regulation: 'FDA/EU MDR/MFDS/NMPA/PMDA 규제 지식',
    documentation: '영어 문서 작성 능력',
  },
  passingScore: 0.8,
};

const RA_SPECIALIST_GO_CRITERIA = {
  experience: {
    regional_submission: '지역별 규제 제출 경험 3년 이상',
  },
  knowledge: {
    regional_regulation: '지역별 규제 전문 지식',
    documentation: '영어 문서 작성 능력',
  },
  passingScore: 0.75,
};

const CLINICAL_LEAD_GO_CRITERIA = {
  experience: {
    medical_clinical: '의학/임상 경력 10년 이상',
    clinical_research: '임상 연구 경험 3건 이상',
  },
  certification: {
    medical_license: '의사 면허 필수',
  },
  knowledge: {
    literature_review: '문헌 평가 경험',
  },
  passingScore: 0.8,
};

const MEDICAL_WRITER_GO_CRITERIA = {
  experience: {
    medical_writing: '의학 저술 경력 3년 이상',
  },
  knowledge: {
    literature_review: '문헌 평가 경험',
    documentation: '영어 문서 작성 능력',
  },
  passingScore: 0.75,
};

const RD_LEAD_GO_CRITERIA = {
  experience: {
    rd_experience: '의료기기 R&D 경력 10년 이상',
    technical_evaluation: '기술적 평가 경험 5건 이상',
  },
  knowledge: {
    engineering: '공학적 지식 (기계/전공/소프트웨어)',
  },
  passingScore: 0.8,
};

const ENGINEERING_SPECIALIST_GO_CRITERIA = {
  experience: {
    engineering: '기계/전공/소프트웨어 공학 경력 5년 이상',
  },
  knowledge: {
    technical_evaluation: '의료기기 기술적 평가 경험',
    documentation: '기술적 문서 작성 능력',
  },
  passingScore: 0.75,
};

const QA_LEAD_GO_CRITERIA = {
  certification: {
    qm_license: '품질경리(QM) 자격증 보유',
  },
  experience: {
    qa_experience: '의료기기 QA 경력 5년 이상',
  },
  knowledge: {
    quality_assurance: '문서 품질 보증 경험',
  },
  passingScore: 0.8,
};

const DOCUMENTATION_SPECIALIST_GO_CRITERIA = {
  experience: {
    technical_writing: '기술 문서 작성 경력 3년 이상',
  },
  knowledge: {
    format_management: '포맷 관리 경험',
    documentation: '문서 형식 승인 권한',
  },
  passingScore: 0.75,
};

const LEGAL_COUNSEL_GO_CRITERIA = {
  experience: {
    legal_experience: '의료기기 규제 법무 경력 5년 이상',
  },
  knowledge: {
    risk_evaluation: '법적 리스크 평가 경험',
    expert_review: 'Expert Review Gate 승인 권한',
  },
  passingScore: 0.8,
};

const RISK_MANAGER_GO_CRITERIA = {
  experience: {
    risk_evaluation: '위험성 평가 경력 5년 이상',
  },
  knowledge: {
    report_authoring: '리스크 평가 보고서 작성 권한',
    mitigation_strategy: '완화 전략 수립 경험',
  },
  passingScore: 0.75,
};

type GoNoGoCriteria = {
  passingScore: number;
} & Record<string, Record<string, string> | number>;

type PersonaName =
  | 'ra-lead'
  | 'ra-specialist'
  | 'clinical-lead'
  | 'medical-writer'
  | 'rd-lead'
  | 'engineering-specialist'
  | 'qa-lead'
  | 'documentation-specialist'
  | 'legal-counsel'
  | 'risk-manager';

function requireText(value: string | null, selector: string): string {
  if (value === null) {
    throw new Error(`Missing text content for ${selector}`);
  }
  return value;
}

// Evaluation Helper Functions
async function evaluateGoNoGo(page: Page, criteria: GoNoGoCriteria, personaName: PersonaName) {
  // Navigate to evaluation page
  await page.goto(`/evaluation/${personaName}`);

  // Fill evaluation form
  for (const [category, requirements] of Object.entries(criteria)) {
    if (category === 'passingScore') continue;
    if (typeof requirements === 'object' && requirements !== null) {
      for (const [key, value] of Object.entries(requirements)) {
        const selector = `[data-testid="${category}-${key}"]`;
        await page.fill(selector, value);
      }
    }
  }

  // Run evaluation
  await page.click('[data-testid="run-evaluation"]');

  // Wait for results
  await page.waitForSelector('[data-testid="evaluation-results"]');

  // Get evaluation results
  const decision = await page.textContent('[data-testid="go-no-go-decision"]');
  const score = Number.parseFloat(
    requireText(await page.textContent('[data-testid="evaluation-score"]'), 'evaluation-score'),
  );
  const details = await page.textContent('[data-testid="evaluation-details"]');

  return {
    decision: decision === 'GO' ? 'GO' : 'NO-GO',
    score,
    details,
    passed: decision === 'GO' && score >= criteria.passingScore,
  };
}

test.describe('RA Lead Go/No-Go Evaluation', () => {
  test.beforeEach(async ({ page }) => {
    // Login as evaluator
    await page.goto('/login');
    await page.fill('[name="email"]', 'evaluator@example.test');
    await page.fill('[name="password"]', 'test-password');
    await page.click('[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('RA Lead Go/No-Go 기준 충족', async ({ page }) => {
    const evaluation = await evaluateGoNoGo(page, RA_LEAD_GO_CRITERIA, 'ra-lead');

    // Verify Go decision
    expect(evaluation.decision).toBe('GO');
    expect(evaluation.score).toBeGreaterThanOrEqual(RA_LEAD_GO_CRITERIA.passingScore);
    expect(evaluation.passed).toBe(true);

    // Verify specific criteria
    await expect(page.locator('[data-testid="fda_510k-experience"]')).toContainText('5년 이상');
    await expect(page.locator('[data-testid="eu_mdr-experience"]')).toContainText(
      'Class IIb/III 제출 경험 2건 이상',
    );
    await expect(page.locator('[data-testid="regulation-knowledge"]')).toContainText(
      'FDA/EU MDR/MFDS/NMPA/PMDA 규제 지식',
    );
    await expect(page.locator('[data-testid="documentation-knowledge"]')).toContainText(
      '영어 문서 작성 능력',
    );
  });

  test('RA Lead Go/No-Go 기준 미충족', async ({ page }) => {
    // Fill insufficient experience
    await page.goto('/evaluation/ra-lead');
    await page.fill('[data-testid="experience-fda_510k"]', '2년'); // Less than 5 years
    await page.fill('[data-testid="experience-eu_mdr"]', '0건'); // Less than 2 cases

    // Run evaluation
    await page.click('[data-testid="run-evaluation"]');
    await page.waitForSelector('[data-testid="evaluation-results"]');

    // Verify No-Go decision
    const decision = await page.textContent('[data-testid="go-no-go-decision"]');
    expect(decision).toBe('NO-GO');

    const score = Number.parseFloat(
      requireText(await page.textContent('[data-testid="evaluation-score"]'), 'evaluation-score'),
    );
    expect(score).toBeLessThan(RA_LEAD_GO_CRITERIA.passingScore);
  });
});

test.describe('RA Specialist Go/No-Go Evaluation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'evaluator@example.test');
    await page.fill('[name="password"]', 'test-password');
    await page.click('[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('RA Specialist Go/No-Go 기준 충족', async ({ page }) => {
    const evaluation = await evaluateGoNoGo(page, RA_SPECIALIST_GO_CRITERIA, 'ra-specialist');

    expect(evaluation.decision).toBe('GO');
    expect(evaluation.score).toBeGreaterThanOrEqual(RA_SPECIALIST_GO_CRITERIA.passingScore);
    expect(evaluation.passed).toBe(true);
  });
});

test.describe('Clinical Lead Go/No-Go Evaluation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'evaluator@example.test');
    await page.fill('[name="password"]', 'test-password');
    await page.click('[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('Clinical Lead Go/No-Go 기준 충족', async ({ page }) => {
    const evaluation = await evaluateGoNoGo(page, CLINICAL_LEAD_GO_CRITERIA, 'clinical-lead');

    expect(evaluation.decision).toBe('GO');
    expect(evaluation.score).toBeGreaterThanOrEqual(CLINICAL_LEAD_GO_CRITERIA.passingScore);
    expect(evaluation.passed).toBe(true);

    // Verify medical license requirement
    await expect(page.locator('[data-testid="medical_license-certification"]')).toContainText(
      '의사 면허 필수',
    );
  });

  test('Clinical Lead Go/No-Go 기준 미충족 (면허 없음)', async ({ page }) => {
    // Fill without medical license
    await page.goto('/evaluation/clinical-lead');
    await page.fill('[data-testid="experience-medical_clinical"]', '8년'); // Less than 10 years
    await page.uncheck('[data-testid="certification-medical_license"]'); // No license

    // Run evaluation
    await page.click('[data-testid="run-evaluation"]');
    await page.waitForSelector('[data-testid="evaluation-results"]');

    // Verify No-Go decision
    const decision = await page.textContent('[data-testid="go-no-go-decision"]');
    expect(decision).toBe('NO-GO');

    const details = await page.textContent('[data-testid="evaluation-details"]');
    expect(details).toContain('의사 면허 필수');
  });
});

test.describe('Medical Writer Go/No-Go Evaluation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'evaluator@example.test');
    await page.fill('[name="password"]', 'test-password');
    await page.click('[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('Medical Writer Go/No-Go 기준 충족', async ({ page }) => {
    const evaluation = await evaluateGoNoGo(page, MEDICAL_WRITER_GO_CRITERIA, 'medical-writer');

    expect(evaluation.decision).toBe('GO');
    expect(evaluation.score).toBeGreaterThanOrEqual(MEDICAL_WRITER_GO_CRITERIA.passingScore);
    expect(evaluation.passed).toBe(true);
  });
});

test.describe('R&D Lead Go/No-Go Evaluation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'evaluator@example.test');
    await page.fill('[name="password"]', 'test-password');
    await page.click('[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('R&D Lead Go/No-Go 기준 충족', async ({ page }) => {
    const evaluation = await evaluateGoNoGo(page, RD_LEAD_GO_CRITERIA, 'rd-lead');

    expect(evaluation.decision).toBe('GO');
    expect(evaluation.score).toBeGreaterThanOrEqual(RD_LEAD_GO_CRITERIA.passingScore);
    expect(evaluation.passed).toBe(true);

    // Verify engineering knowledge requirement
    await expect(page.locator('[data-testid="engineering-knowledge"]')).toContainText(
      '공학적 지식 (기계/전공/소프트웨어)',
    );
  });
});

test.describe('Engineering Specialist Go/No-Go Evaluation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'evaluator@example.test');
    await page.fill('[name="password"]', 'test-password');
    await page.click('[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('Engineering Specialist Go/No-Go 기준 충족', async ({ page }) => {
    const evaluation = await evaluateGoNoGo(
      page,
      ENGINEERING_SPECIALIST_GO_CRITERIA,
      'engineering-specialist',
    );

    expect(evaluation.decision).toBe('GO');
    expect(evaluation.score).toBeGreaterThanOrEqual(
      ENGINEERING_SPECIALIST_GO_CRITERIA.passingScore,
    );
    expect(evaluation.passed).toBe(true);
  });
});

test.describe('QA Lead Go/No-Go Evaluation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'evaluator@example.test');
    await page.fill('[name="password"]', 'test-password');
    await page.click('[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('QA Lead Go/No-Go 기준 충족', async ({ page }) => {
    const evaluation = await evaluateGoNoGo(page, QA_LEAD_GO_CRITERIA, 'qa-lead');

    expect(evaluation.decision).toBe('GO');
    expect(evaluation.score).toBeGreaterThanOrEqual(QA_LEAD_GO_CRITERIA.passingScore);
    expect(evaluation.passed).toBe(true);

    // Verify QM license requirement
    await expect(page.locator('[data-testid="qm_license-certification"]')).toContainText(
      '품질경리(QM) 자격증 보유',
    );
  });
});

test.describe('Documentation Specialist Go/No-Go Evaluation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'evaluator@example.test');
    await page.fill('[name="password"]', 'test-password');
    await page.click('[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('Documentation Specialist Go/No-Go 기준 충족', async ({ page }) => {
    const evaluation = await evaluateGoNoGo(
      page,
      DOCUMENTATION_SPECIALIST_GO_CRITERIA,
      'documentation-specialist',
    );

    expect(evaluation.decision).toBe('GO');
    expect(evaluation.score).toBeGreaterThanOrEqual(
      DOCUMENTATION_SPECIALIST_GO_CRITERIA.passingScore,
    );
    expect(evaluation.passed).toBe(true);
  });
});

test.describe('Legal Counsel Go/No-Go Evaluation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'evaluator@example.test');
    await page.fill('[name="password"]', 'test-password');
    await page.click('[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('Legal Counsel Go/No-Go 기준 충족', async ({ page }) => {
    const evaluation = await evaluateGoNoGo(page, LEGAL_COUNSEL_GO_CRITERIA, 'legal-counsel');

    expect(evaluation.decision).toBe('GO');
    expect(evaluation.score).toBeGreaterThanOrEqual(LEGAL_COUNSEL_GO_CRITERIA.passingScore);
    expect(evaluation.passed).toBe(true);

    // Verify Expert Review Gate authority
    await expect(page.locator('[data-testid="expert_review-knowledge"]')).toContainText(
      'Expert Review Gate 승인 권한',
    );
  });
});

test.describe('Risk Manager Go/No-Go Evaluation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'evaluator@example.test');
    await page.fill('[name="password"]', 'test-password');
    await page.click('[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('Risk Manager Go/No-Go 기준 충족', async ({ page }) => {
    const evaluation = await evaluateGoNoGo(page, RISK_MANAGER_GO_CRITERIA, 'risk-manager');

    expect(evaluation.decision).toBe('GO');
    expect(evaluation.score).toBeGreaterThanOrEqual(RISK_MANAGER_GO_CRITERIA.passingScore);
    expect(evaluation.passed).toBe(true);
  });
});

test.describe('종합 Go/No-Go 결정 프로세스', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'evaluator@example.test');
    await page.fill('[name="password"]', 'test-password');
    await page.click('[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('모든 페르소나 Go/No-Go 평가 및 종합 결정', async ({ page }) => {
    // Evaluate all personas
    const personas: Array<{ name: PersonaName; criteria: GoNoGoCriteria }> = [
      { name: 'ra-lead', criteria: RA_LEAD_GO_CRITERIA },
      { name: 'ra-specialist', criteria: RA_SPECIALIST_GO_CRITERIA },
      { name: 'clinical-lead', criteria: CLINICAL_LEAD_GO_CRITERIA },
      { name: 'medical-writer', criteria: MEDICAL_WRITER_GO_CRITERIA },
      { name: 'rd-lead', criteria: RD_LEAD_GO_CRITERIA },
      { name: 'engineering-specialist', criteria: ENGINEERING_SPECIALIST_GO_CRITERIA },
      { name: 'qa-lead', criteria: QA_LEAD_GO_CRITERIA },
      { name: 'documentation-specialist', criteria: DOCUMENTATION_SPECIALIST_GO_CRITERIA },
      { name: 'legal-counsel', criteria: LEGAL_COUNSEL_GO_CRITERIA },
      { name: 'risk-manager', criteria: RISK_MANAGER_GO_CRITERIA },
    ];

    const evaluations: Array<{ persona: PersonaName; score: number }> = [];

    for (const persona of personas) {
      const evaluation = await evaluateGoNoGo(page, persona.criteria, persona.name);
      evaluations.push({ persona: persona.name, ...evaluation });
    }

    // Calculate overall score (weighted average)
    const weights: Record<PersonaName, number> = {
      'ra-lead': 0.2,
      'ra-specialist': 0.1,
      'clinical-lead': 0.15,
      'medical-writer': 0.1,
      'rd-lead': 0.15,
      'engineering-specialist': 0.1,
      'qa-lead': 0.1,
      'documentation-specialist': 0.05,
      'legal-counsel': 0.05,
      'risk-manager': 0.05,
    };

    let totalScore = 0;
    for (const evaluation of evaluations) {
      totalScore += evaluation.score * weights[evaluation.persona];
    }

    // Verify overall Go decision
    await page.goto('/evaluation/overall');
    await page.click('[data-testid="calculate-overall-decision"]');
    await page.waitForSelector('[data-testid="overall-decision"]');

    const overallDecision = await page.textContent('[data-testid="overall-decision"]');
    const overallScore = Number.parseFloat(
      requireText(await page.textContent('[data-testid="overall-score"]'), 'overall-score'),
    );

    expect(overallDecision).toBe(totalScore >= 0.8 ? 'GO' : 'NO-GO');
    expect(overallScore).toBeCloseTo(totalScore, 1);

    // Verify audit_logs entry
    await page.goto('/audit-logs');
    await expect(page.locator('[data-testid="audit-entry"]')).toContainText(
      'Overall Go/No-Go decision: GO',
    );

    // Generate evaluation report
    await page.click('[data-testid="generate-evaluation-report"]');
    await page.waitForSelector('[data-testid="evaluation-report"]');

    // Verify report structure
    await expect(page.locator('[data-testid="report-summary"]')).toBeVisible();
    await expect(page.locator('[data-testid="report-persona-results"]')).toBeVisible();
    await expect(page.locator('[data-testid="report-decision"]')).toBeVisible();
    await expect(page.locator('[data-testid="report-feedback"]')).toBeVisible();
  });
});
