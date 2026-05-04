// @MX:NOTE [AUTO] Google Drive source — OAuth2 refresh_token flow (REQ-DOC-012).
// @MX:SPEC SPEC-REGULA-DOCINGEST-001 (REQ-DOC-012)
import type { IngestionSource, RawFile, RawMetadata } from './base';

export class GoogleDriveSource implements IngestionSource {
  private accessToken: string | null = null;

  constructor(private readonly orgRefreshToken: string) {}

  private async refreshAccessToken(): Promise<string> {
    const clientId = process.env.GDRIVE_CLIENT_ID;
    const clientSecret = process.env.GDRIVE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('GDRIVE_CLIENT_ID and GDRIVE_CLIENT_SECRET must be set');
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: this.orgRefreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) throw new Error('Failed to refresh Google Drive token');
    const data = (await response.json()) as { access_token: string };
    this.accessToken = data.access_token;
    return this.accessToken;
  }

  async listChanged(since: Date): Promise<RawFile[]> {
    const token = await this.refreshAccessToken();
    const sinceStr = since.toISOString();

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=modifiedTime>'${sinceStr}'&fields=files(id,name,mimeType,size,modifiedTime)`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    if (!response.ok) return [];
    const data = (await response.json()) as { files: Array<{ id: string; name: string; mimeType: string; size: string; modifiedTime: string }> };

    return (data.files ?? []).map((f) => ({
      externalId: f.id,
      name: f.name,
      mimeType: f.mimeType,
      size: parseInt(f.size ?? '0', 10),
      modifiedAt: new Date(f.modifiedTime),
    }));
  }

  async download(externalId: string): Promise<Buffer> {
    const token = await this.refreshAccessToken();
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${externalId}?alt=media`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!response.ok) throw new Error(`Failed to download Drive file: ${externalId}`);
    return Buffer.from(await response.arrayBuffer());
  }

  async getMetadata(externalId: string): Promise<RawMetadata> {
    const token = await this.refreshAccessToken();
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${externalId}?fields=id,name,mimeType,size,modifiedTime`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!response.ok) throw new Error(`Failed to get Drive metadata: ${externalId}`);
    const f = (await response.json()) as { id: string; name: string; mimeType: string; size: string; modifiedTime: string };
    return {
      externalId: f.id,
      name: f.name,
      mimeType: f.mimeType,
      size: parseInt(f.size ?? '0', 10),
      modifiedAt: new Date(f.modifiedTime),
      source: 'google_drive',
    };
  }
}
