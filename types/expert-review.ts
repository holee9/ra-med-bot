// @MX:NOTE [AUTO] ExpertReview type — T-007 (REQ-ENTERPRISE-024~030).
// Mirrors the expert_reviews DB table shape from lib/kernel/db/schema.ts.
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-024)

export interface ExpertReview {
  id: string;
  conversationId: string;
  messageId: string;
  requestedBy: string;
  assignedTo: string | null;
  status: 'pending' | 'in_progress' | 'resolved';
  notes: string | null;
  createdAt: Date;
  updatedAt: Date | null;
}
