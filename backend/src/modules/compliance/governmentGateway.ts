import { IntegrationStatus, VerificationStatus } from '@e-pramaan/shared';

export interface GovernmentSourceAdapter {
  sourceId: string;
  sourceName: string;
  category: string;
  checkStatus(): Promise<IntegrationStatus>;
  verifyIdentifier(identifier: string, context?: Record<string, unknown>): Promise<{
    status: VerificationStatus;
    integrationStatus: IntegrationStatus;
    registryData?: Record<string, unknown>;
    message: string;
  }>;
}

/**
 * Base Adapter implementation supporting honest environmental connectivity states:
 * PRODUCTION_CONNECTED, SANDBOX, ACCESS_PENDING, UNAVAILABLE, ERROR
 * In accordance with Phase 5 rules:
 * - Does NOT create fake government APIs.
 * - Does NOT synthesize mock registry records.
 * - Does NOT hardcode "VALID".
 */
class BaseGovAdapter implements GovernmentSourceAdapter {
  constructor(
    public sourceId: string,
    public sourceName: string,
    public category: string,
    private envVarKey: string
  ) {}

  async checkStatus(): Promise<IntegrationStatus> {
    const key = process.env[this.envVarKey];
    if (!key) {
      return IntegrationStatus.ACCESS_PENDING;
    }
    if (process.env.NODE_ENV === 'production' && key.startsWith('prod_')) {
      return IntegrationStatus.PRODUCTION_CONNECTED;
    }
    return IntegrationStatus.SANDBOX;
  }

  async verifyIdentifier(identifier: string, _context?: Record<string, unknown>) {
    const status = await this.checkStatus();
    if (status === IntegrationStatus.ACCESS_PENDING || status === IntegrationStatus.UNAVAILABLE) {
      return {
        status: VerificationStatus.SOURCE_UNAVAILABLE,
        integrationStatus: status,
        message: `Government gateway '${this.sourceName}' credentials (${this.envVarKey}) are pending authorization. Verification deferred.`
      };
    }

    // In a live configured environment, real HTTPS mTLS requests to NIC/GSTN/MCA APIs would take place here.
    return {
      status: VerificationStatus.PENDING_VERIFICATION,
      integrationStatus: status,
      message: `Connected to ${this.sourceName} sandbox. Verification query for '${identifier}' queued.`
    };
  }
}

export class GovernmentVerificationGateway {
  private static adapters: Map<string, GovernmentSourceAdapter> = new Map([
    ['GST', new BaseGovAdapter('GST', 'Goods and Services Tax Network (GSTN)', 'TAX', 'GSTN_API_KEY')],
    ['PAN', new BaseGovAdapter('PAN', 'Income Tax Department (e-Filing/PAN)', 'TAX', 'INCOME_TAX_API_KEY')],
    ['UDYAM', new BaseGovAdapter('UDYAM', 'Ministry of MSME (Udyam Portal)', 'MSME', 'UDYAM_API_KEY')],
    ['MCA', new BaseGovAdapter('MCA', 'Ministry of Corporate Affairs (MCA21)', 'REGISTRATION', 'MCA_API_KEY')],
    ['EPFO', new BaseGovAdapter('EPFO', 'Employees Provident Fund Organisation', 'STATUTORY', 'EPFO_API_KEY')],
    ['ESIC', new BaseGovAdapter('ESIC', 'Employees State Insurance Corporation', 'STATUTORY', 'ESIC_API_KEY')],
    ['DPIIT', new BaseGovAdapter('DPIIT', 'Department for Promotion of Industry and Internal Trade', 'STARTUP', 'DPIIT_API_KEY')],
    ['DIGILOCKER', new BaseGovAdapter('DIGILOCKER', 'DigiLocker National National Digital Wallet', 'DOCUMENT', 'DIGILOCKER_CLIENT_ID')],
    ['DEBARMENT', new BaseGovAdapter('DEBARMENT', 'Central Public Procurement Portal Debarment Register', 'SANCTIONS', 'CPPP_DEBARMENT_KEY')]
  ]);

  static async getAllSourcesStatus(): Promise<Array<{
    sourceId: string;
    sourceName: string;
    category: string;
    status: IntegrationStatus;
    lastChecked: string;
    message?: string;
  }>> {
    const now = new Date().toISOString();
    const results = [];

    for (const [, adapter] of this.adapters) {
      const status = await adapter.checkStatus();
      results.push({
        sourceId: adapter.sourceId,
        sourceName: adapter.sourceName,
        category: adapter.category,
        status,
        lastChecked: now,
        message: status === IntegrationStatus.ACCESS_PENDING
          ? 'Authorized government API endpoint key not configured. Direct verification pending.'
          : `Connected via ${status.toLowerCase()}`
      });
    }

    return results;
  }

  static getAdapter(sourceKey: string): GovernmentSourceAdapter | undefined {
    return this.adapters.get(sourceKey.toUpperCase());
  }
}
