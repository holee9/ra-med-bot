// @MX:ANCHOR [AUTO] withPermission — mandatory wrapper for all Route Handlers.
// @MX:REASON fan_in >= 3: T-003 will add 10+ Route Handler callers
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-019)

import { writeAudit } from '@/lib/audit';
import { auth } from '@/lib/auth';
import { isOrgMember, isProjectMember } from './acl';
import { PERMISSIONS, type PermissionAction, roleSatisfiesPermission } from './permissions';
import type { Role } from './rbac';

// Auth.js v5 does not include custom fields on session.user by default.
// Cast to this shape — the fields are populated by DrizzleAdapter + session strategy.
interface AuthUser {
  id: string;
  role: Role;
  organizationId?: string;
  email?: string;
}

// The session type returned by auth(), with our custom user shape.
export interface AuthSession {
  user: AuthUser;
}

// Generic route context type — mirrors Next.js App Router route context.
// Ctx carries params (e.g. { id: string }) from the dynamic segment.
type RouteParams = Record<string, string> | Promise<Record<string, string>>;
type Ctx = { params?: RouteParams };

type InnerHandler = (req: Request, ctx: Ctx, session: AuthSession) => Promise<Response>;

// SPEC-REGULA-AUDITOR-VIEW-001 (AC #2): HTTP methods that mutate state.
// Auditor role is blocked from these regardless of the permission action.
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * REQ-ENTERPRISE-019: Wraps a Route Handler with RBAC enforcement.
 *
 * Guards in order:
 *   1. Session existence → 401 if missing
 *   2. SPEC-REGULA-AUDITOR-VIEW-001: auditor write-block → 403 + audit.denied
 *   3. Role check via roleSatisfiesPermission() → 403 + audit if insufficient
 *   4. Membership check (org or project scope) → 403 + audit if not a member
 *   5. Delegates to inner handler with (req, ctx, session)
 */
export function withPermission(action: PermissionAction, handler: InnerHandler) {
  return async (req: Request, ctx: Ctx = {}): Promise<Response> => {
    // 1. Session guard
    const rawSession = await auth();
    if (!rawSession?.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = rawSession.user as AuthUser;
    const session: AuthSession = { user };
    const spec = PERMISSIONS[action];

    // 2. SPEC-REGULA-AUDITOR-VIEW-001: auditor is strictly read-only.
    //    Any write method is rejected before the role/membership checks run,
    //    and the attempt is logged with audit.denied (AC #3).
    if (user.role === 'auditor' && WRITE_METHODS.has(req.method.toUpperCase())) {
      await writeAudit({
        action: 'audit.denied',
        actor_id: user.id,
        resource_type: spec.resourceType,
        resource_id: action,
        meta_json: {
          attemptedAction: action,
          method: req.method.toUpperCase(),
          reason: 'auditor_read_only',
        },
      });
      return Response.json(
        {
          error: 'auditor_read_only',
          required: action,
          read_only_role: true,
        },
        { status: 403 },
      );
    }

    // 3. Role check
    if (!roleSatisfiesPermission(user.role, spec)) {
      await writeAudit({
        action: 'rbac.permission_deny',
        actor_id: user.id,
        resource_type: spec.resourceType,
        resource_id: action,
        meta_json: {
          required: action,
          actualRole: user.role,
          reason: 'role',
        },
      });
      return Response.json(
        { error: 'permission_denied', required: action, actual_role: user.role },
        { status: 403 },
      );
    }

    // 4. Membership check (scope-dependent)
    if (spec.scope === 'org') {
      const orgId = user.organizationId ?? '';
      const member = await isOrgMember(user.id, orgId);
      if (!member) {
        await writeAudit({
          action: 'rbac.permission_deny',
          actor_id: user.id,
          resource_type: spec.resourceType,
          resource_id: orgId,
          meta_json: {
            required: action,
            actualRole: user.role,
            reason: 'org_membership',
          },
        });
        return Response.json(
          { error: 'not_a_member', resource_type: 'org', resource_id: orgId },
          { status: 403 },
        );
      }
    } else if (spec.scope === 'project') {
      // Project id comes from route params. Handle Next.js 15 Promise params properly.
      const rawParams = ctx.params;
      const resolvedParams = rawParams && 'then' in rawParams ? await rawParams : rawParams;
      const projectId = resolvedParams?.id ?? '';
      const member = await isProjectMember(user.id, projectId);
      if (!member) {
        await writeAudit({
          action: 'rbac.permission_deny',
          actor_id: user.id,
          resource_type: spec.resourceType,
          resource_id: projectId,
          meta_json: {
            required: action,
            actualRole: user.role,
            reason: 'project_membership',
          },
        });
        return Response.json(
          { error: 'not_a_member', resource_type: 'project', resource_id: projectId },
          { status: 403 },
        );
      }
    }
    // 'user' and 'none' scopes: no membership check needed.

    // 5. Delegate to inner handler
    return handler(req, ctx, session);
  };
}
