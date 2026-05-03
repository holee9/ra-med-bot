// @MX:NOTE: [AUTO] Langfuse LLM tracing wrapper — REQ-ENTERPRISE-051
// Null-safe: getLangfuseClient returns null when env vars are not set.
// flushAsync is only called when client exists.
// CRITICAL: This module must remain isolated from the audit system (21 CFR Part 11).

import { Langfuse } from 'langfuse';

let client: Langfuse | null = null;

export function getLangfuseClient(): Langfuse | null {
  if (!process.env.LANGFUSE_SECRET_KEY || !process.env.LANGFUSE_PUBLIC_KEY) {
    return null;
  }
  if (!client) {
    client = new Langfuse({
      secretKey: process.env.LANGFUSE_SECRET_KEY,
      publicKey: process.env.LANGFUSE_PUBLIC_KEY,
      baseUrl: process.env.LANGFUSE_BASEURL ?? 'https://cloud.langfuse.com',
    });
  }
  return client;
}

export async function traceLlmCall(params: {
  name: string;
  input: unknown;
  output: unknown;
  model: string;
  tokensIn: number;
  tokensOut: number;
}): Promise<void> {
  const lf = getLangfuseClient();
  if (!lf) return;
  const trace = lf.trace({ name: params.name });
  trace.generation({
    name: params.name,
    model: params.model,
    input: params.input,
    output: params.output,
    usage: { promptTokens: params.tokensIn, completionTokens: params.tokensOut },
  });
  await lf.flushAsync();
}
