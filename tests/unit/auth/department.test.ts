import { describe, expect, it } from 'vitest';
import { DEPARTMENT_ACL, hasDepartmentAccess } from '../../../lib/kernel/auth/department';
import type { Department, DepartmentFeature } from '../../../lib/kernel/auth/department';

describe('hasDepartmentAccess', () => {
  it('RA has access to dashboard.team', () => {
    expect(hasDepartmentAccess('RA', 'dashboard.team')).toBe(true);
  });
  it('RA has access to sources.ingest', () => {
    expect(hasDepartmentAccess('RA', 'sources.ingest')).toBe(true);
  });
  it('RA has access to templates.edit', () => {
    expect(hasDepartmentAccess('RA', 'templates.edit')).toBe(true);
  });
  it('Dev does NOT have access to dashboard.team', () => {
    expect(hasDepartmentAccess('Dev', 'dashboard.team')).toBe(false);
  });
  it('Dev has access to sources.ingest', () => {
    expect(hasDepartmentAccess('Dev', 'sources.ingest')).toBe(true);
  });
  it('Dev has access to templates.edit', () => {
    expect(hasDepartmentAccess('Dev', 'templates.edit')).toBe(true);
  });
  it('Exec has access to dashboard.team', () => {
    expect(hasDepartmentAccess('Exec', 'dashboard.team')).toBe(true);
  });
  it('Exec does NOT have access to sources.ingest', () => {
    expect(hasDepartmentAccess('Exec', 'sources.ingest')).toBe(false);
  });
  it('External has no access to any feature', () => {
    const features: DepartmentFeature[] = ['dashboard.team', 'sources.ingest', 'templates.edit'];
    for (const f of features) {
      expect(hasDepartmentAccess('External', f)).toBe(false);
    }
  });
  it('null department grants access (unrestricted)', () => {
    expect(hasDepartmentAccess(null, 'dashboard.team')).toBe(true);
    expect(hasDepartmentAccess(undefined, 'sources.ingest')).toBe(true);
  });
  it('DEPARTMENT_ACL covers all 4 departments', () => {
    const departments: Department[] = ['RA', 'Dev', 'Exec', 'External'];
    for (const d of departments) {
      expect(DEPARTMENT_ACL[d]).toBeDefined();
      expect(Array.isArray(DEPARTMENT_ACL[d])).toBe(true);
    }
  });
});
