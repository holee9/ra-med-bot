// @MX:NOTE [AUTO] SharePoint sync — similar to gdrive-sync but for Microsoft SharePoint.
// @MX:SPEC SPEC-REGULA-DOCINGEST-001 (REQ-DOC-015)
import { SharePointSource } from '../../ingest/sources/sharepoint';

export interface SharePointSyncConfig {
  orgId: string;
  tenantId: string;
  siteId: string;
  lastSyncAt?: Date;
}

export async function syncSharePoint(config: SharePointSyncConfig): Promise<{ synced: number }> {
  const {
    orgId: _orgId,
    tenantId,
    siteId,
    lastSyncAt = new Date(Date.now() - 15 * 60 * 1000),
  } = config;

  const source = new SharePointSource(tenantId, siteId);
  const changedFiles = await source.listChanged(lastSyncAt);

  let synced = 0;
  for (const _file of changedFiles) {
    synced++;
  }

  return { synced };
}
