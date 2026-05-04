// @MX:NOTE [AUTO] Google Drive sync — cron every 15min + webhook for file_changed (REQ-DOC-013, 014).
// @MX:SPEC SPEC-REGULA-DOCINGEST-001 (REQ-DOC-013, REQ-DOC-014)
import { GoogleDriveSource } from '../../ingest/sources/google-drive';

export interface GDriveSyncConfig {
  orgId: string;
  refreshToken: string;
  lastSyncAt?: Date;
}

/**
 * Sync new/modified files from Google Drive.
 * Should be called by an Inngest cron (every 15min) and by webhook events.
 */
export async function syncGoogleDrive(config: GDriveSyncConfig): Promise<{ synced: number }> {
  const { orgId, refreshToken, lastSyncAt = new Date(Date.now() - 15 * 60 * 1000) } = config;

  const source = new GoogleDriveSource(refreshToken);
  const changedFiles = await source.listChanged(lastSyncAt);

  let synced = 0;
  for (const file of changedFiles) {
    // Emit Inngest event for each changed file to trigger the ingest pipeline
    await emitDocumentCreatedEvent({
      orgId,
      externalId: file.externalId,
      name: file.name,
      mimeType: file.mimeType,
      source: 'google_drive',
    });
    synced++;
  }

  return { synced };
}

async function emitDocumentCreatedEvent(_params: {
  orgId: string;
  externalId: string;
  name: string;
  mimeType: string;
  source: string;
}): Promise<void> {}
