// @MX:NOTE [AUTO] Sensitivity Policy Status — shows current sensitivity-policy state.
// Displays policy status or "policy: pending" honestly.
// @MX:SPEC Issue #158 (Group B4 - Admin Documents sensitivity policy status)

interface PolicyStatusProps {
  policyConfigured: boolean;
  policyLevel?: 'public' | 'internal' | 'confidential' | 'restricted';
}

export function SensitivityPolicyStatus({ policyConfigured, policyLevel }: PolicyStatusProps) {
  if (!policyConfigured) {
    return (
      <section className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" />
          <span className="font-medium text-amber-800">민감도 정책: 대기 중</span>
        </div>
        <p className="mt-2 text-amber-700">
          문서 분류 및 접근 제어 정책이 아직 구성되지 않았습니다. 관리자에게 문의하세요.
        </p>
      </section>
    );
  }

  const levelLabels = {
    public: '공개',
    internal: '내부',
    confidential: '기밀',
    restricted: '극비',
  };

  return (
    <section className="rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-sm">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-success-500" aria-hidden="true" />
        <span className="font-medium text-success-800">민감도 정책: 구성됨</span>
      </div>
      <p className="mt-2 text-success-700">
        현재 정책 레벨:{' '}
        <span className="font-semibold">{levelLabels[policyLevel || 'internal']}</span>
      </p>
    </section>
  );
}
