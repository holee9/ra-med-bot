// @MX:NOTE [AUTO] WorkflowsLayout — layout wrapper for the /workflows section.
// @MX:SPEC SPEC-REGULA-WORKFLOWS-001 (M6)

export default function WorkflowsLayout({ children }: { children: React.ReactNode }) {
  return <div className="px-6 py-8">{children}</div>;
}
