import { getLlmFastModel } from '@/lib/ai/llm-provider';
// @MX:ANCHOR: [AUTO] parseDeviceIntent — fast LLM intent extraction for device description
// @MX:REASON: External AI API boundary; called by classification route; E2E_TEST_MODE guard required
// @MX:SPEC: SPEC-REGULA-CLASSIFY-001 REQ-CLASSIFY-010
import { generateText } from 'ai';
import type { DeviceInput } from './classification-engine';

// E2E_TEST_MODE mock — returns deterministic output for test environments.
const MOCK_DEVICE_INPUT: Omit<DeviceInput, 'deviceDescription'> = {
  deviceType: 'active',
  contactType: 'external',
  hasSoftware: false,
  hasAiMl: false,
  isSterile: false,
};

export async function parseDeviceIntent(
  description: string,
): Promise<Omit<DeviceInput, 'deviceDescription'>> {
  if (process.env.E2E_TEST_MODE === 'true') {
    return { ...MOCK_DEVICE_INPUT };
  }

  const { text: raw } = await generateText({
    model: getLlmFastModel(),
    maxTokens: 512,
    messages: [
      {
        role: 'user',
        content: `Analyze this medical device description and extract classification characteristics. Return ONLY valid JSON with these exact fields:
- deviceType: one of "active"|"non_active"|"software_only"|"ivd"|"implantable"
- contactType: one of "no_contact"|"external"|"internal"|"implant"
- hasSoftware: boolean
- hasAiMl: boolean
- isSterile: boolean

Device description: "${description}"

JSON response only, no explanation:`,
      },
    ],
  });

  const text = raw?.trim() || '{}';
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    return {
      deviceType: (parsed.deviceType as DeviceInput['deviceType']) ?? 'non_active',
      contactType: (parsed.contactType as DeviceInput['contactType']) ?? 'no_contact',
      hasSoftware: Boolean(parsed.hasSoftware),
      hasAiMl: Boolean(parsed.hasAiMl),
      isSterile: Boolean(parsed.isSterile),
    };
  } catch {
    return {
      deviceType: 'non_active',
      contactType: 'no_contact',
      hasSoftware: false,
      hasAiMl: false,
      isSterile: false,
    };
  }
}
