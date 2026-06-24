// @MX:TODO [AUTO] QMS (#57) bidirectional sync — stub only.
// @MX:SPEC SPEC-REGULA-CAPA-001 (REQ-009, AC-05)
// @MX:REASON SPEC-REGULA-QMS-001 (#57) is not yet implemented. REQ-009 requires
//           bidirectional CAPA status sync with the QMS. This stub returns a
//           no-op result so the CAPA close flow can proceed without blocking on
//           an unbuilt integration. A follow-up issue will replace this with the
//           real QMS adapter once #57 lands.

/**
 * REQ-009 stub: attempt to sync a CAPA status to the QMS system (#57).
 *
 * Returns a deterministic no-op result. The stub never throws so the close
 * flow is not blocked. When #57 is implemented, this function will call the
 * QMS adapter and return the real sync status.
 *
 * Follow-up: issue TBD (track against SPEC-REGULA-QMS-001).
 */
export async function syncCapaToQms(params: {
  capaId: string;
  status: string;
}): Promise<{ synced: false; reason: 'qms_not_implemented'; qmsRef: null }> {
  // Intentional no-op. The params are accepted so the signature is stable for
  // the future implementation; we just don't act on them yet.
  void params;
  return { synced: false, reason: 'qms_not_implemented', qmsRef: null };
}
