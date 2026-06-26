// @MX:NOTE [AUTO] Redaction Blocker Warning — production readiness blocker for #151.
// Warns that 3-layer redaction path is not fully wired (sensitive content may not be redacted).
// @MX:SPEC Issue #158 (Group B4 - Admin Documents #151 redaction blocker warning)

import { Callout } from '@/components/ui/Callout';

export function RedactionBlockerWarning() {
  return (
    <section className="mb-6">
      <Callout variant="danger" title="프로덕션 준비 차단 상태">
        <div className="space-y-2 text-sm">
          <p className="font-medium">
            <strong>3-layer redaction 경로가 완전히 연결되지 않았습니다.</strong>
          </p>
          <ul className="ml-4 list-disc space-y-1 text-ink-700">
            <li>현재 업로드 경로에서 민감 정보(PHI, PII)가 완전히 제거되지 않을 수 있습니다.</li>
            <li>문서 업로드 전 수동 검토가 필요하며, 민감 정보 포함 여부를 확인해야 합니다.</li>
            <li>
              프로덕션 환경에서의 사용은 redaction 경로가 완전히 구현될 때까지 보류해야 합니다.
            </li>
          </ul>
          <div className="mt-3 rounded-md bg-danger-100 px-3 py-2 text-xs text-danger-800">
            <p className="font-medium">보안 경고:</p>
            <p>
              이 상태로 업로드된 문서는 민감 정보를 포함할 수 있으며, 적절한 redaction 없이 검색
              가능한 상태로 저장될 수 있습니다.
            </p>
          </div>
        </div>
        <div className="mt-3 text-xs text-ink-600">
          <a
            href="https://github.com/abyz-lab/ra-med-bot/issues/151"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-700 hover:underline"
          >
            관련 이슈 #151 보기 →
          </a>
        </div>
      </Callout>
    </section>
  );
}
