// @MX:NOTE [AUTO] RTL tests for ClassificationWizard — SPEC-REGULA-CLASSIFY-001 (Issue #59, T3).
// Covers: (a) wizard renders steps, (b) submit calls POST /api/classify/run with the
// correct WizardAnswers body, (c) result renders 5 jurisdictions, (d) role-gating
// (hidden for unauthorized — canGenerate=false), (e) citations render.
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClassificationWizard } from '../../../../app/(app)/workflows/classification/_components/ClassificationWizard';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

// A fully-populated 5-jurisdiction result matching the committed API contract.
const MOCK_RESULT = {
  workflowRunId: 'run-uuid-123',
  result: {
    fda: {
      class: 'Class II',
      path: '510(k)',
      ruleNumbers: ['21 CFR 807.81'],
      citations: [{ source: '21 CFR 880.2900', id: 'FDA classification' }],
      rationale: 'Non-invasive external device, 510(k) pathway.',
      nextSteps: ['510(k)Predicate 검토', '성능 테스트 계획 수립'],
    },
    euMdr: {
      class: 'Class IIa',
      path: 'notified_body',
      ruleNumbers: ['Annex VIII Rule 6'],
      citations: [{ source: 'EU MDR 2017/745', id: 'Annex VIII Rule 6' }],
      rationale: 'Short-term external contact, Rule 6 applies.',
      nextSteps: ['기술문서 작성', 'NB 선정'],
    },
    mfds: {
      class: '2등급',
      path: '등가심사',
      ruleNumbers: ['의료기기법 시행규칙 별표 3'],
      citations: [{ source: '의료기기법', id: '별표 3' }],
      rationale: '2등급 해당 — 등가심사 대상.',
      nextSteps: ['MFDS 신고서 준비'],
    },
    nmpa: {
      class: 'Class II',
      path: '형식검사',
      ruleNumbers: ['분류목록'],
      citations: [{ source: 'NMPA 分类目录', id: '분류목록' }],
      rationale: 'NMPA Class II — 형식검사 대상.',
      nextSteps: ['NMPA 등록 계획'],
    },
    pmda: {
      class: '第II種',
      path: '인증',
      ruleNumbers: ['薬機法'],
      citations: [{ source: '薬機法', id: '第II種' }],
      rationale: 'PMDA 第II種 — 등록인증부 대상.',
      nextSteps: ['PMDA 상담 신청'],
    },
    samdFlag: 'none' as const,
  },
};

function fillValidForm() {
  // Device description (>= 10 chars)
  const textarea = screen.getByLabelText(/기기 설명/i);
  fireEvent.change(textarea, { target: { value: '혈압 모니터링용 비침습적 의료기기입니다.' } });

  // Device type radio — pick first option (능동형)
  const deviceRadios = screen.getAllByRole('radio', { name: /능동형/i });
  const activeDeviceRadio = deviceRadios.at(0);
  if (activeDeviceRadio) fireEvent.click(activeDeviceRadio);

  // Contact type radio — pick external
  const contactRadios = screen.getAllByRole('radio', { name: /외부/i });
  const externalContactRadio = contactRadios.at(0);
  if (externalContactRadio) fireEvent.click(externalContactRadio);
}

describe('ClassificationWizard — rendering (a)', () => {
  it('renders the wizard heading and required field markers', () => {
    render(<ClassificationWizard canGenerate={true} />);
    expect(screen.getByText('기기 정보')).toBeTruthy();
    expect(screen.getByRole('button', { name: /분류 실행/i })).toBeTruthy();
  });

  it('renders all 5 device type options and 4 contact type options', () => {
    render(<ClassificationWizard canGenerate={true} />);
    // 5 device-type + 4 contact-type = 9 radios total.
    const radios = screen.getAllByRole('radio');
    expect(radios.length).toBe(9);
    // Device type labels (5)
    expect(screen.getByText('능동형 (Active)')).toBeTruthy();
    expect(screen.getByText('비능동형 (Non-active)')).toBeTruthy();
    expect(screen.getByText('소프트웨어 단독 (SaMD)')).toBeTruthy();
    expect(screen.getByText('체외진단의료기기 (IVD)')).toBeTruthy();
    expect(screen.getByText('체내이식형 (Implantable)')).toBeTruthy();
    // Contact type labels (4)
    expect(screen.getByText('환자 접촉 없음')).toBeTruthy();
    expect(screen.getByText('외부 (피부 접촉)')).toBeTruthy();
    expect(screen.getByText('내부 (체강)')).toBeTruthy();
    expect(screen.getByText('이식 (Implant)')).toBeTruthy();
  });
});

describe('ClassificationWizard — role gating (d)', () => {
  it('disables submit and shows permission notice when canGenerate=false', () => {
    render(<ClassificationWizard canGenerate={false} />);
    const submit = screen.getByRole('button', { name: /분류 실행/i });
    expect((submit as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('classify-permission-notice')).toBeTruthy();
  });

  it('enables submit when canGenerate=true and form is valid', () => {
    render(<ClassificationWizard canGenerate={true} />);
    fillValidForm();
    const submit = screen.getByTestId('classify-submit');
    expect((submit as HTMLButtonElement).disabled).toBe(false);
  });
});

describe('ClassificationWizard — submit + API contract (b)', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => MOCK_RESULT,
    }) as unknown as typeof fetch;
  });

  it('POSTs to /api/classify/run with the correct WizardAnswers body', async () => {
    render(<ClassificationWizard canGenerate={true} />);
    fillValidForm();
    // Toggle the AI/ML checkbox to verify boolean passthrough.
    const aiMlLabel = screen.getByText(/AI\/ML 구성/i).closest('label');
    const aiMlCheckbox = aiMlLabel?.querySelector('input[type="checkbox"]');
    if (aiMlCheckbox) fireEvent.click(aiMlCheckbox);

    fireEvent.click(screen.getByTestId('classify-submit'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    const calls = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls;
    const firstCall = calls.at(0);
    expect(firstCall).toBeDefined();
    if (!firstCall) return;
    const [endpoint, init] = firstCall as [string, RequestInit];
    expect(endpoint).toBe('/api/classify/run');
    expect(init).toMatchObject({ method: 'POST' });
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toMatchObject({
      deviceType: 'active',
      contactType: 'external',
      hasSoftware: false,
      hasAiMl: true,
      isSterile: false,
    });
    expect(body.deviceDescription.length).toBeGreaterThanOrEqual(10);
  });
});

describe('ClassificationWizard — result rendering (c, e)', () => {
  it('renders 5 jurisdiction cards with class, rationale, citations, and next steps', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => MOCK_RESULT,
    }) as unknown as typeof fetch;

    render(<ClassificationWizard canGenerate={true} />);
    fillValidForm();
    fireEvent.click(screen.getByTestId('classify-submit'));

    // Wait for result view.
    await waitFor(() => {
      expect(screen.getByTestId('classify-result')).toBeTruthy();
    });

    // 5 jurisdictions present
    expect(screen.getByTestId('classify-jurisdiction-FDA (US)')).toBeTruthy();
    expect(screen.getByTestId('classify-jurisdiction-EU MDR')).toBeTruthy();
    expect(screen.getByTestId('classify-jurisdiction-MFDS (한국)')).toBeTruthy();
    expect(screen.getByTestId('classify-jurisdiction-NMPA (중국)')).toBeTruthy();
    expect(screen.getByTestId('classify-jurisdiction-PMDA (일본)')).toBeTruthy();

    // Class badges rendered
    expect(screen.getByTestId('classify-class-FDA (US)').textContent).toContain('Class II');
    expect(screen.getByTestId('classify-class-EU MDR').textContent).toContain('Class IIa');
    expect(screen.getByTestId('classify-class-MFDS (한국)').textContent).toContain('2등급');

    // Rationale rendered
    expect(screen.getByTestId('classify-rationale-FDA (US)').textContent).toContain(
      'Non-invasive external device',
    );

    // Citations rendered (e) — source identifier visible
    expect(screen.getByTestId('classify-citations-FDA (US)')).toBeTruthy();
    expect(screen.getByText('21 CFR 880.2900')).toBeTruthy();
    expect(screen.getByText('FDA classification')).toBeTruthy();

    // Next steps rendered
    expect(screen.getByTestId('classify-nextsteps-FDA (US)')).toBeTruthy();
    expect(screen.getByText('510(k)Predicate 검토')).toBeTruthy();

    // Workflow run ID surfaced for audit traceability
    expect(screen.getByTestId('classify-run-id').textContent).toBe('run-uuid-123');
  });

  it('shows the SaMD flag note when AI/ML is detected', async () => {
    const withSamd = {
      ...MOCK_RESULT,
      result: { ...MOCK_RESULT.result, samdFlag: 'detected' as const },
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => withSamd,
    }) as unknown as typeof fetch;

    render(<ClassificationWizard canGenerate={true} />);
    fillValidForm();
    fireEvent.click(screen.getByTestId('classify-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('classify-samd-flag')).toBeTruthy();
    });
    expect(screen.getByTestId('classify-samd-flag').textContent).toMatch(/AI\/ML 구성 감지됨/);
  });

  it('renders the error state when the API returns a non-OK response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: '권한 없음' }),
    }) as unknown as typeof fetch;

    render(<ClassificationWizard canGenerate={true} />);
    fillValidForm();
    fireEvent.click(screen.getByTestId('classify-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('classify-error')).toBeTruthy();
    });
    expect(screen.getByTestId('classify-error').textContent).toContain('권한 없음');
  });
});
