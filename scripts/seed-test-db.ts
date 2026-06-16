#!/usr/bin/env node
// Seeds deterministic records for local Playwright smoke paths.

import bcrypt from 'bcryptjs';
import postgres from 'postgres';

const ORG_ID = '10000000-0000-4000-8000-000000000001';
const RA_LEAD_ID = '10000000-0000-4000-8000-000000000101';
const VIEWER_ID = '10000000-0000-4000-8000-000000000102';
const ADMIN_ID = '10000000-0000-4000-8000-000000000103';
const PROJECT_ID = '10000000-0000-4000-8000-000000000201';
const CONVERSATION_ID = '10000000-0000-4000-8000-000000000301';
const USER_MESSAGE_ID = '10000000-0000-4000-8000-000000000401';
const ASSISTANT_MESSAGE_ID = '10000000-0000-4000-8000-000000000402';
const AUDIT_LOG_ID = '10000000-0000-4000-8000-000000000501';
const CHAT_QUERY_AUDIT_LOG_ID = '10000000-0000-4000-8000-000000000502';

// Fixed password for the E2E ra-lead test user — matches E2E_TEST_USER_PASSWORD in .env.test
const E2E_PASSWORD = 'TestE2EPassword123!';

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    process.stderr.write('DATABASE_URL is required. Run through `pnpm db:test:seed`.\n');
    process.exit(1);
  }

  const sql = postgres(databaseUrl, { max: 1 });
  const passwordHash = await bcrypt.hash(E2E_PASSWORD, 12);

  try {
    await sql.begin(async (tx) => {
      await tx`
        insert into organizations (id, name, tier)
        values (${ORG_ID}, 'Regula Test Organization', 'test')
        on conflict (id) do update set
          name = excluded.name,
          tier = excluded.tier
      `;

      await tx`
        insert into users (
          id, email, name, role, locale, theme_pref, department,
          password_hash, status, must_change_password
        )
        values
          (
            ${RA_LEAD_ID}, 'ra.lead@example.test', 'RA Lead', 'ra-lead', 'ko', 'system', 'RA',
            ${passwordHash}, 'active', false
          ),
          (
            ${VIEWER_ID}, 'viewer@example.test', 'Viewer', 'viewer', 'en', 'system', 'External',
            null, 'active', false
          ),
          (
            ${ADMIN_ID}, 'admin@example.test', 'Admin', 'admin', 'ko', 'system', 'RA',
            ${passwordHash}, 'active', false
          )
        on conflict (id) do update set
          email = excluded.email,
          name = excluded.name,
          role = excluded.role,
          locale = excluded.locale,
          theme_pref = excluded.theme_pref,
          department = excluded.department,
          password_hash = excluded.password_hash,
          status = excluded.status,
          must_change_password = excluded.must_change_password
      `;

      await tx`
        insert into projects (
          id,
          organization_id,
          name,
          device_class,
          target_markets,
          color,
          submission_date,
          status
        )
        values (
          ${PROJECT_ID},
          ${ORG_ID},
          'E2E Predicate Smoke Project',
          'Class II',
          ARRAY['US', 'EU'],
          'brand',
          '2026-06-30',
          'active'
        )
        on conflict (id) do update set
          organization_id = excluded.organization_id,
          name = excluded.name,
          device_class = excluded.device_class,
          target_markets = excluded.target_markets,
          color = excluded.color,
          submission_date = excluded.submission_date,
          status = excluded.status
      `;

      await tx`
        insert into org_members (user_id, org_id)
        values
          (${RA_LEAD_ID}, ${ORG_ID}),
          (${VIEWER_ID}, ${ORG_ID}),
          (${ADMIN_ID}, ${ORG_ID})
        on conflict do nothing
      `;

      await tx`
        insert into project_members (user_id, project_id)
        values
          (${RA_LEAD_ID}, ${PROJECT_ID}),
          (${VIEWER_ID}, ${PROJECT_ID}),
          (${ADMIN_ID}, ${PROJECT_ID})
        on conflict do nothing
      `;

      await tx`
        insert into conversations (id, project_id, user_id, title, status)
        values (${CONVERSATION_ID}, ${PROJECT_ID}, ${RA_LEAD_ID}, '510(k) predicate smoke', 'active')
        on conflict (id) do update set
          project_id = excluded.project_id,
          user_id = excluded.user_id,
          title = excluded.title,
          status = excluded.status
      `;

      await tx`
        insert into messages (
          id,
          conversation_id,
          role,
          content_prose,
          confidence_level,
          confidence_score,
          expert_review_required,
          model
        )
        values
          (
            ${USER_MESSAGE_ID},
            ${CONVERSATION_ID},
            'user',
            'Find likely FDA 510(k) predicate candidates for a Class II monitoring device.',
            null,
            null,
            false,
            null
          ),
          (
            ${ASSISTANT_MESSAGE_ID},
            ${CONVERSATION_ID},
            'assistant',
            'Predicate candidates require verified device classification, intended use, and source citations.',
            'med',
            0.720,
            true,
            'local-e2e'
          )
        on conflict (id) do update set
          conversation_id = excluded.conversation_id,
          role = excluded.role,
          content_prose = excluded.content_prose,
          confidence_level = excluded.confidence_level,
          confidence_score = excluded.confidence_score,
          expert_review_required = excluded.expert_review_required,
          model = excluded.model
      `;

      await tx`
        insert into audit_logs (
          id,
          actor_id,
          action,
          resource_type,
          resource_id,
          conversation_id,
          meta_json
        )
        values (
          ${AUDIT_LOG_ID},
          ${RA_LEAD_ID},
          'conversation.view',
          'conversation',
          ${CONVERSATION_ID},
          ${CONVERSATION_ID},
          '{"seededBy":"scripts/seed-test-db.ts","purpose":"local-e2e"}'::jsonb
        )
        on conflict (id) do update set
          actor_id = excluded.actor_id,
          action = excluded.action,
          resource_type = excluded.resource_type,
          resource_id = excluded.resource_id,
          conversation_id = excluded.conversation_id,
          meta_json = excluded.meta_json
      `;

      await tx`
        insert into audit_logs (
          id,
          actor_id,
          action,
          resource_type,
          resource_id,
          conversation_id,
          meta_json
        )
        values (
          ${CHAT_QUERY_AUDIT_LOG_ID},
          ${RA_LEAD_ID},
          'chat.query',
          'message',
          ${ASSISTANT_MESSAGE_ID},
          ${CONVERSATION_ID},
          '{"seededBy":"scripts/seed-test-db.ts","purpose":"local-e2e-chat-query"}'::jsonb
        )
        on conflict (id) do update set
          actor_id = excluded.actor_id,
          action = excluded.action,
          resource_type = excluded.resource_type,
          resource_id = excluded.resource_id,
          conversation_id = excluded.conversation_id,
          meta_json = excluded.meta_json
      `;
    });

    process.stdout.write('Seeded local E2E test database.\n');
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  const reason = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Failed to seed local E2E test database: ${reason}\n`);
  process.exit(1);
});
