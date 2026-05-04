// @MX:ANCHOR [AUTO] withDocumentPermission — Route Handler HOF for document access control.
// @MX:REASON fan_in >= 3: Phase 8 document API routes will all use this wrapper.
// @MX:SPEC SPEC-REGULA-DOCINGEST-001 (REQ-DOC-8B-3)

import { writeAudit } from '@/lib/audit';
import { auth } from '@/lib/auth';
import type { Role } from '@/lib/auth/rbac';
import { DocClass } from '@/lib/ingest/doc-class';
import { checkDocumentPermission, type DocumentAction } from './document-acl';

interface AuthUser {
  id: string;
  role: Role;
  organizationId?: string;
  projectIds?: string[];
}

type Ctx = { params?: Promise<Record<string, string>> | Record<string, string> };
type NextRouteHandler = (req: Request, ctx: Ctx) => Promise<Response>;

/**
 * Higher-order function that wraps a Route Handler with document-level ACL.
 *
 * Guards in order:
 *   1. Session existence → 401 if missing
 *   2. checkDocumentPermission → 403 if insufficient
 *   3. Writes document.access audit log (21 CFR Part 11)
 *   4. Delegates to inner handler
 */
export function withDocumentPermission(
  docClass: DocClass,
  action: DocumentAction,
): (handler: NextRouteHandler) => NextRouteHandler {
  return (handler) =>
    async (req: Request, ctx: Ctx): Promise<Response> => {
      // 1. Session guard
      const rawSession = await auth();
      if (!rawSession?.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const user = rawSession.user as AuthUser;
      const projectIds = user.projectIds ?? [];

      // 2. ACL check
      const allowed = checkDocumentPermission(
        user.role,
        docClass,
        null,
        projectIds,
        action,
      );

      if (!allowed) {
        await writeAudit({
          action: 'rbac.permission_deny',
          actor_id: user.id,
          resource_type: 'document',
          resource_id: docClass,
          meta_json: {
            docClass,
            requiredAction: action,
            actualRole: user.role,
          },
        });
        return Response.json(
          { error: 'permission_denied', doc_class: docClass, required_action: action },
          { status: 403 },
        );
      }

      // 3. Audit log — all document access must be recorded (21 CFR Part 11)
      await writeAudit({
        action: 'document.access',
        actor_id: user.id,
        resource_type: 'document',
        resource_id: docClass,
        meta_json: {
          docClass,
          accessType: action,
          organizationId: user.organizationId,
        },
      });

      // 4. Delegate to inner handler
      return handler(req, ctx);
    };
}
