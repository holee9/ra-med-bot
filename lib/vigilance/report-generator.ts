// @MX:ANCHOR [AUTO] Report generator — produces FDA MDR 3500A / EU MDV / FSCA draft content.
// @MX:REASON Sole function generating regulated report drafts; called by route handler and exports.
// @MX:SPEC SPEC-REGULA-VIGILANCE-001 (REQ-VIG-011~020)
//
// Uses claude-sonnet-4-5 (or env override) to produce structured field-by-field drafts.
// E2E_TEST_MODE returns deterministic mock drafts without LLM calls.

import { sharedAnthropicClient } from '@/lib/ai/anthropic-client';
import type { AdverseEventInput, ReportabilityDecision } from './reportability-engine';

export type ReportType = 'fda_mdr' | 'eu_mdv' | 'fsca';
export type ReportFormat = 'mdr_3500a' | 'eu_mdv_initial' | 'eu_mdv_final' | 'fsca_notice';

export interface ReportDraftResult {
  reportType: ReportType;
  reportFormat: ReportFormat;
  // field_name → drafted text
  draftContent: Record<string, string>;
  submissionDeadline: string; // ISO date string
}

// @MX:WARN [AUTO] Complex branching — report type determines both prompt and deadline calculation.
// @MX:REASON 3 report types × multiple deadline rules = high branch count; must stay consistent.
function getReportFormat(reportType: ReportType): ReportFormat {
  switch (reportType) {
    case 'fda_mdr':
      return 'mdr_3500a';
    case 'eu_mdv':
      return 'eu_mdv_initial';
    case 'fsca':
      return 'fsca_notice';
  }
}

function calculateDeadline(awarenessDate: string, deadlineDays: number): string {
  const awareness = new Date(awarenessDate);
  awareness.setDate(awareness.getDate() + deadlineDays);
  const isoString = awareness.toISOString();
  return isoString.split('T')[0] ?? isoString;
}

function buildPrompt(event: AdverseEventInput, reportType: ReportType): string {
  const baseContext = `
Device Name: ${event.eventDescription}
Patient Outcome: ${event.patientOutcome}
Event Description: ${event.eventDescription}
Event Date: ${event.eventDate}
Awareness Date: ${event.awarenessDate}
Device Category: ${event.deviceCategory}
`.trim();

  if (reportType === 'fda_mdr') {
    return `You are a regulatory affairs specialist. Generate a draft FDA MedWatch 3500A Medical Device Report based on the following adverse event information:

${baseContext}

Provide a JSON object with these exact keys:
{
  "manufacturer_name": "...",
  "manufacturer_address": "...",
  "device_trade_name": "...",
  "device_model_number": "...",
  "event_description": "...",
  "patient_outcome": "...",
  "initial_reporter_occupation": "...",
  "type_of_report": "...",
  "manufacturer_narrative": "...",
  "remedial_action": "..."
}

Use only information provided. Mark unknown fields as "[TO BE COMPLETED]". Respond with JSON only, no markdown.`;
  }

  if (reportType === 'eu_mdv') {
    return `You are a regulatory affairs specialist. Generate a draft EU MDR Article 87 Medical Device Vigilance Initial Report based on the following adverse event information:

${baseContext}

Provide a JSON object with these exact keys:
{
  "manufacturer_name": "...",
  "manufacturer_address": "...",
  "device_description": "...",
  "device_classification": "...",
  "incident_description": "...",
  "initial_evaluation": "...",
  "corrective_actions_taken": "...",
  "corrective_actions_planned": "...",
  "patient_impact": "...",
  "reporting_deadline_justification": "..."
}

Use only information provided. Mark unknown fields as "[TO BE COMPLETED]". Respond with JSON only, no markdown.`;
  }

  // fsca
  return `You are a regulatory affairs specialist. Generate a draft Field Safety Corrective Action (FSCA) Notice based on the following adverse event information:

${baseContext}

Provide a JSON object with these exact keys:
{
  "device_identification": "...",
  "action_type": "...",
  "reason_for_action": "...",
  "affected_products": "...",
  "health_hazard_assessment": "...",
  "action_description": "...",
  "advice_to_users": "...",
  "expected_completion_date": "..."
}

Use only information provided. Mark unknown fields as "[TO BE COMPLETED]". Respond with JSON only, no markdown.`;
}

function mockDraftContent(reportType: ReportType): Record<string, string> {
  if (reportType === 'fda_mdr') {
    return {
      manufacturer_name: '[E2E TEST] Test Manufacturer Inc.',
      manufacturer_address: '[E2E TEST] 123 Test St, Test City, TS 00000',
      device_trade_name: '[E2E TEST] Test Medical Device',
      device_model_number: '[E2E TEST] MODEL-001',
      event_description: '[E2E TEST] Adverse event description placeholder.',
      patient_outcome: '[E2E TEST] Patient outcome placeholder.',
      initial_reporter_occupation: '[E2E TEST] Physician',
      type_of_report: '[E2E TEST] 30-day MDR',
      manufacturer_narrative: '[E2E TEST] Manufacturer narrative placeholder.',
      remedial_action: '[E2E TEST] TO BE COMPLETED',
    };
  }

  if (reportType === 'eu_mdv') {
    return {
      manufacturer_name: '[E2E TEST] Test Manufacturer Inc.',
      manufacturer_address: '[E2E TEST] 123 Test St',
      device_description: '[E2E TEST] Test Medical Device description.',
      device_classification: '[E2E TEST] Class IIb',
      incident_description: '[E2E TEST] Incident description placeholder.',
      initial_evaluation: '[E2E TEST] Initial evaluation placeholder.',
      corrective_actions_taken: '[E2E TEST] None taken yet.',
      corrective_actions_planned: '[E2E TEST] Investigation in progress.',
      patient_impact: '[E2E TEST] Patient impact placeholder.',
      reporting_deadline_justification: '[E2E TEST] 15-day reporting period.',
    };
  }

  return {
    device_identification: '[E2E TEST] Test Device MODEL-001',
    action_type: '[E2E TEST] Corrective Action',
    reason_for_action: '[E2E TEST] Systematic malfunction identified.',
    affected_products: '[E2E TEST] Lot numbers: TBD',
    health_hazard_assessment: '[E2E TEST] Moderate risk.',
    action_description: '[E2E TEST] Recall and replacement.',
    advice_to_users: '[E2E TEST] Stop use and contact manufacturer.',
    expected_completion_date: '[E2E TEST] TBD',
  };
}

// @MX:ANCHOR [AUTO] generateReportDraft — AI-powered regulatory report draft generator.
// @MX:REASON Called by POST /api/ra/vigilance for each applicable report type (up to 3 per event).
// @MX:SPEC SPEC-REGULA-VIGILANCE-001 (REQ-VIG-011~020)
export async function generateReportDraft(
  event: AdverseEventInput,
  decision: ReportabilityDecision,
  reportType: ReportType,
): Promise<ReportDraftResult> {
  const reportFormat = getReportFormat(reportType);

  // Calculate submission deadline from awareness date
  let deadlineDays = 30;
  if (reportType === 'fda_mdr' && decision.fdaMdrDeadlineDays !== null) {
    deadlineDays = decision.fdaMdrDeadlineDays;
  } else if (reportType === 'eu_mdv' && decision.euMdvDeadlineDays !== null) {
    deadlineDays = decision.euMdvDeadlineDays;
  }
  const submissionDeadline = calculateDeadline(event.awarenessDate, deadlineDays);

  // E2E test mode: return deterministic mock without LLM call
  const isE2EMode = process.env.E2E_TEST_MODE === 'true' && process.env.NODE_ENV !== 'production';
  if (isE2EMode) {
    return {
      reportType,
      reportFormat,
      draftContent: mockDraftContent(reportType),
      submissionDeadline,
    };
  }

  const model = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-5';
  const prompt = buildPrompt(event, reportType);

  const response = await sharedAnthropicClient.messages.create({
    model,
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const rawBlock = response.content[0];
  if (!rawBlock || rawBlock.type !== 'text') {
    throw new Error(`Unexpected response type from report generator for ${reportType}`);
  }

  let draftContent: Record<string, string>;
  try {
    draftContent = JSON.parse(rawBlock.text) as Record<string, string>;
  } catch {
    // If JSON parse fails, wrap the raw text as a single field
    draftContent = { raw_draft: rawBlock.text };
  }

  return {
    reportType,
    reportFormat,
    draftContent,
    submissionDeadline,
  };
}
