// @MX:NOTE Explicit RBAC matrix for predicate permission helpers (REQ-PRE-029).
// Each helper is a pure function of the caller's department string; these tests
// pin the full matrix so a refactor of any route cannot silently widen access.

import { describe, expect, it } from 'vitest';
import {
  canClearPredicateCache,
  canExportComparisons,
  canManageComparisons,
  canSearchPredicates,
  canViewComparisons,
} from '@/lib/auth/predicate-permissions';

// RBAC matrix (REQ-PRE-029):
//   dept   | search | manage | view  | export | clearCache
//   RA     | true   | true   | true  | true   | false
//   Dev    | true   | true   | true  | true   | true
//   Exec   | false  | false  | true  | false  | false
//   ext/∅  | false  | false  | false | false  | false

describe('predicate RBAC helpers', () => {
  describe('canSearchPredicates — RA/Dev only', () => {
    it('allows RA', () => expect(canSearchPredicates('RA')).toBe(true));
    it('allows Dev', () => expect(canSearchPredicates('Dev')).toBe(true));
    it('denies Exec', () => expect(canSearchPredicates('Exec')).toBe(false));
    it('denies External', () => expect(canSearchPredicates('External')).toBe(false));
    it('denies null', () => expect(canSearchPredicates(null)).toBe(false));
  });

  describe('canManageComparisons — RA/Dev only', () => {
    it('allows RA', () => expect(canManageComparisons('RA')).toBe(true));
    it('allows Dev', () => expect(canManageComparisons('Dev')).toBe(true));
    it('denies Exec', () => expect(canManageComparisons('Exec')).toBe(false));
    it('denies External', () => expect(canManageComparisons('External')).toBe(false));
    it('denies null', () => expect(canManageComparisons(null)).toBe(false));
  });

  describe('canViewComparisons — RA/Dev/Exec', () => {
    it('allows RA', () => expect(canViewComparisons('RA')).toBe(true));
    it('allows Dev', () => expect(canViewComparisons('Dev')).toBe(true));
    it('allows Exec', () => expect(canViewComparisons('Exec')).toBe(true));
    it('denies External', () => expect(canViewComparisons('External')).toBe(false));
    it('denies null', () => expect(canViewComparisons(null)).toBe(false));
  });

  describe('canExportComparisons — RA/Dev only', () => {
    it('allows RA', () => expect(canExportComparisons('RA')).toBe(true));
    it('allows Dev', () => expect(canExportComparisons('Dev')).toBe(true));
    it('denies Exec', () => expect(canExportComparisons('Exec')).toBe(false));
    it('denies External', () => expect(canExportComparisons('External')).toBe(false));
    it('denies null', () => expect(canExportComparisons(null)).toBe(false));
  });

  describe('canClearPredicateCache — Dev only', () => {
    it('denies RA', () => expect(canClearPredicateCache('RA')).toBe(false));
    it('allows Dev', () => expect(canClearPredicateCache('Dev')).toBe(true));
    it('denies Exec', () => expect(canClearPredicateCache('Exec')).toBe(false));
    it('denies External', () => expect(canClearPredicateCache('External')).toBe(false));
    it('denies null', () => expect(canClearPredicateCache(null)).toBe(false));
  });

  it('treats unknown/garbage departments as denied everywhere', () => {
    const dept = 'Marketing';
    expect(canSearchPredicates(dept)).toBe(false);
    expect(canManageComparisons(dept)).toBe(false);
    expect(canViewComparisons(dept)).toBe(false);
    expect(canExportComparisons(dept)).toBe(false);
    expect(canClearPredicateCache(dept)).toBe(false);
  });
});
