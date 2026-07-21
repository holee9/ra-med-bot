// @MX:NOTE [AUTO] Backward-compat re-export shim — scripts/ is on a read-only
// bind mount and cannot be codemod'd. This shim lets scripts/' stale
// `../lib/audit/cold-storage` import resolve to the kernel location.
// SPEC-V3-RESTRUCTURE-001 Phase B (B1+B5). Remove when scripts/ is writable.
export * from '../kernel/audit/cold-storage';
