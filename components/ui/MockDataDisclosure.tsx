// @MX:NOTE [AUTO] MockDataDisclosure — warning callout that informs users the
// surfaced workflow data is simulated. Surfaces above any mock-driven content
// (e.g. workflows landing) until the real executor is wired up.
// @MX:SPEC SPEC-REGULA-RELEASE-HARDENING-001 (TASK-003)

interface MockDataDisclosureProps {
  className?: string;
  /** Override default Korean copy for tests / English screens. */
  message?: string;
}

const DEFAULT_MESSAGE =
  '이 워크플로는 시뮬레이션 데이터로 동작합니다. 결과는 데모 용도로만 사용하세요.';

export function MockDataDisclosure({
  className = '',
  message = DEFAULT_MESSAGE,
}: MockDataDisclosureProps) {
  return (
    <div
      role="note"
      data-testid="mock-data-disclosure"
      className={`flex items-start gap-2 rounded-lg border border-accent-400 bg-accent-50 px-4 py-3 text-sm text-accent-800 ${className}`}
    >
      <span aria-hidden className="mt-0.5 font-semibold">
        ⚠
      </span>
      <p className="leading-relaxed">{message}</p>
    </div>
  );
}
