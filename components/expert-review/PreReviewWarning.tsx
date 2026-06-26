// @MX:NOTE [AUTO] Pre-Review Warning — warns that answers are decision-support.
// Explicit warning that expert review is required before regulatory use ([지양-4]).
// @MX:SPEC Issue #158 (Group B3 - Expert Review pre-review warning)

import { Callout } from '@/components/ui/Callout';

export function PreReviewWarning() {
  return (
    <section className="mb-6">
      <Callout variant="warn" title="검토 전 경고">
        <div className="space-y-2 text-sm">
          <p className="font-medium">
            이 시스템의 답변은 <strong>규제 준계 의사결정 지원</strong> 목적으로 제공됩니다.
          </p>
          <ul className="ml-4 list-disc space-y-1 text-ink-700">
            <li>
              답변은 참고 자료로만 사용해야 하며, 단독으로 규제 의사결정에 사용할 수 없습니다.
            </li>
            <li>모든 규제 관련 의사결정은 반드시 전문가 검토 후 이루어져야 합니다.</li>
            <li>답변의 정확성을 확인하기 위해 관련 문서와 출처를 직접 검토해야 합니다.</li>
          </ul>
          <p className="text-xs text-ink-600">
            [지양-4] 이 시스템은 규제 판단을 대신하거나 법적 조언을 제공하지 않습니다.
          </p>
        </div>
      </Callout>
    </section>
  );
}
