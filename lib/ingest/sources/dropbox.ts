// @MX:NOTE [AUTO] Dropbox source — files.list_folder API (REQ-DOC-019).
// @MX:SPEC SPEC-REGULA-DOCINGEST-001 (REQ-DOC-019)
import type { IngestionSource, RawFile, RawMetadata } from './base';

export class DropboxSource implements IngestionSource {
  private async getAccessToken(): Promise<string> {
    const refreshToken = process.env.DROPBOX_REFRESH_TOKEN;
    const clientId = process.env.DROPBOX_CLIENT_ID;
    const clientSecret = process.env.DROPBOX_CLIENT_SECRET;

    if (!refreshToken || !clientId || !clientSecret) {
      throw new Error('DROPBOX_REFRESH_TOKEN, DROPBOX_CLIENT_ID, DROPBOX_CLIENT_SECRET must be set');
    }

    const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!response.ok) throw new Error('Failed to refresh Dropbox token');
    const data = (await response.json()) as { access_token: string };
    return data.access_token;
  }

  async listChanged(since: Date): Promise<RawFile[]> {
    const token = await this.getAccessToken();

    const response = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path: '', recursive: true }),
    });

    if (!response.ok) return [];
    const data = (await response.json()) as { entries: Array<{ '.tag': string; id: string; name: string; server_modified: string; size: number }> };

    return (data.entries ?? [])
      .filter((e) => e['.tag'] === 'file' && new Date(e.server_modified) >= since)
      .map((e) => ({
        externalId: e.id,
        name: e.name,
        mimeType: 'application/octet-stream',
        size: e.size,
        modifiedAt: new Date(e.server_modified),
      }));
  }

  async download(externalId: string): Promise<Buffer> {
    const token = await this.getAccessToken();
    const response = await fetch('https://content.dropboxapi.com/2/files/download', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Dropbox-API-Arg': JSON.stringify({ path: externalId }),
      },
    });
    if (!response.ok) throw new Error(`Failed to download Dropbox file: ${externalId}`);
    return Buffer.from(await response.arrayBuffer());
  }

  async getMetadata(externalId: string): Promise<RawMetadata> {
    const token = await this.getAccessToken();
    const response = await fetch('https://api.dropboxapi.com/2/files/get_metadata', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path: externalId }),
    });
    if (!response.ok) throw new Error(`Failed to get Dropbox metadata: ${externalId}`);
    const item = (await response.json()) as { id: string; name: string; server_modified: string; size: number };
    return {
      externalId: item.id,
      name: item.name,
      mimeType: 'application/octet-stream',
      size: item.size,
      modifiedAt: new Date(item.server_modified),
      source: 'dropbox',
    };
  }
}
