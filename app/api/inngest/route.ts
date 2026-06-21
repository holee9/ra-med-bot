// @MX:NOTE [AUTO] Inngest serve endpoint — exposes all registered background functions
// to the Inngest dev/prod server. SPEC-REGULA-DIGEST-001 / SPEC-REGULA-DOCINGEST-001.
// @MX:SPEC SPEC-REGULA-DIGEST-001 (REQ-DIGEST cron auto-trigger)
//
// Dev: run `npx inngest-cli@latest dev` and point it at http://localhost:3000/api/inngest
// Prod: configure INNGEST_SIGNING_KEY + INNGEST_EVENT_KEY env vars; the Inngest cloud
//       auto-discovers this endpoint.

import { inngest } from '@/lib/inngest/client';
import { functions } from '@/lib/inngest/functions';
import { serve } from 'inngest/next';

const handler = serve({ client: inngest, functions });

export const GET = handler;
export const POST = handler;
export const PUT = handler;
