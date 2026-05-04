// @MX:NOTE [AUTO] SharePoint source — Microsoft Graph API v1.0 delta query (REQ-DOC-015).
// @MX:SPEC SPEC-REGULA-DOCINGEST-001 (REQ-DOC-015)
import type { IngestionSource, RawFile, RawMetadata } from './base';

export class SharePointSource implements IngestionSource {
  private accessToken: string | null = null;

  constructor(
    private readonly tenantId: string,
    private readonly siteId: string,
  ) {}

  private async getToken(): Promise<string> {
    const clientId = process.env.SHAREPOINT_CLIENT_ID;
    const clientCert = process.env.SHAREPOINT_CLIENT_CERT;

    if (!clientId || !clientCert) {
      throw new Error('SHAREPOINT_CLIENT_ID and SHAREPOINT_CLIENT_CERT must be set');
    }

    // Certificate-based auth via MSAL (simplified — real impl uses MSAL library)
    const response = await fetch(
      `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
          client_assertion: clientCert,
          grant_type: 'client_credentials',
          scope: 'https://graph.microsoft.com/.default',
        }),
      },
    );

    if (!response.ok) throw new Error('Failed to get SharePoint token');
    const data = (await response.json()) as { access_token: string };
    this.accessToken = data.access_token;
    return this.accessToken;
  }

  async listChanged(since: Date): Promise<RawFile[]> {
    const token = await this.getToken();
    const sinceStr = since.toISOString();

    const response = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${this.siteId}/drive/root/delta?$filter=lastModifiedDateTime ge '${sinceStr}'`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    if (!response.ok) return [];
    const data = (await response.json()) as {
      value: Array<{
        id: string;
        name: string;
        file?: { mimeType: string };
        size: number;
        lastModifiedDateTime: string;
      }>;
    };

    return (data.value ?? [])
      .filter((item) => item.file) // Only files, not folders
      .map((item) => ({
        externalId: item.id,
        name: item.name,
        mimeType: item.file?.mimeType ?? 'application/octet-stream',
        size: item.size,
        modifiedAt: new Date(item.lastModifiedDateTime),
      }));
  }

  async download(externalId: string): Promise<Buffer> {
    const token = await this.getToken();
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${this.siteId}/drive/items/${externalId}/content`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!response.ok) throw new Error(`Failed to download SharePoint file: ${externalId}`);
    return Buffer.from(await response.arrayBuffer());
  }

  async getMetadata(externalId: string): Promise<RawMetadata> {
    const token = await this.getToken();
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${this.siteId}/drive/items/${externalId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!response.ok) throw new Error(`Failed to get SharePoint metadata: ${externalId}`);
    const item = (await response.json()) as {
      id: string;
      name: string;
      file?: { mimeType: string };
      size: number;
      lastModifiedDateTime: string;
    };
    return {
      externalId: item.id,
      name: item.name,
      mimeType: item.file?.mimeType ?? 'application/octet-stream',
      size: item.size,
      modifiedAt: new Date(item.lastModifiedDateTime),
      source: 'sharepoint',
    };
  }
}
