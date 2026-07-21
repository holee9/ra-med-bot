// @MX:NOTE [AUTO] Backward-compat re-export shim — scripts/ is on a read-only
// bind mount and cannot be codemod'd. This shim lets scripts/' stale db/client
// imports resolve to the kernel location. SPEC-V3-RESTRUCTURE-001 Phase B.
// Remove when scripts/ is writable.
export * from '../kernel/db/client';
