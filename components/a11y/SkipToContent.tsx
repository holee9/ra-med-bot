// @MX:NOTE [AUTO] SkipToContent — REQ-ENTERPRISE-044. Server component (no 'use client').
// Renders a visually hidden skip link that becomes visible on keyboard focus.
// Must be the first element inside <body> in app/layout.tsx.

export function SkipToContent() {
  return (
    <a href="#main-content" className="skip-to-content" data-testid="skip-to-content">
      콘텐츠로 건너뛰기
    </a>
  );
}
