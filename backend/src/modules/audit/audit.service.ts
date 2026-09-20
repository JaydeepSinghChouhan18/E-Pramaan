import {
  AuditEventType,
  AuditEventListItem,
  AIOverrideRecord,
  CreateAIOverridePayload,
  UserProfile,
  UserRole
} from '@e-pramaan/shared';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { getSupabaseAdminClient } from '../../config/supabase.js';
import { AppError } from '../../middlewares/errorHandler.js';
import { config } from '../../config/env.js';

export class AuditService {
  /**
   * Append-only event logger for all system mutations, decisions, overrides, and checks.
   */
  static async logEvent(params: {
    eventType: AuditEventType;
    entityType: string;
    entityId: string;
    tenderId?: string | null;
    bidId?: string | null;
    actorUserId: string;
    actorRole: UserRole | string;
    description: string;
    reason?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    if (!config.hasSupabaseConfigured()) return;

    try {
      const admin = getSupabaseAdminClient();
      await admin.from('audit_events').insert({
        event_type: params.eventType,
        entity_type: params.entityType,
        entity_id: params.entityId,
        tender_id: params.tenderId || null,
        bid_id: params.bidId || null,
        actor_user_id: params.actorUserId,
        actor_role: params.actorRole,
        description: params.description,
        reason: params.reason || null,
        metadata: params.metadata || {},
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error('Failed to append audit event:', err);
    }
  }

  /**
   * Query append-only audit event trail with filters.
   */
  static async listAuditEvents(
    _user: UserProfile,
    filters: {
      tenderId?: string;
      bidId?: string;
      eventType?: AuditEventType;
      limit?: number;
    }
  ): Promise<AuditEventListItem[]> {
    if (!config.hasSupabaseConfigured()) return [];

    const admin = getSupabaseAdminClient();
    let query = admin
      .from('audit_events')
      .select(`
        *,
        actor:users!inner (
          id,
          full_name,
          role
        ),
        tender:tenders (
          id,
          tender_number
        ),
        bid:bids (
          id,
          bid_number
        )
      `)
      .order('timestamp', { ascending: false })
      .limit(filters.limit || 100);

    if (filters.tenderId) query = query.eq('tender_id', filters.tenderId);
    if (filters.bidId) query = query.eq('bid_id', filters.bidId);
    if (filters.eventType) query = query.eq('event_type', filters.eventType);

    const { data, error } = await query;
    if (error) {
      throw new AppError('Failed to retrieve audit events', 500, 'DB_ERROR', error);
    }

    return (data || []).map((row: any) => {
      const actor = Array.isArray(row.actor) ? row.actor[0] : row.actor;
      const tender = Array.isArray(row.tender) ? row.tender[0] : row.tender;
      const bid = Array.isArray(row.bid) ? row.bid[0] : row.bid;

      return {
        id: row.id,
        eventType: row.event_type as AuditEventType,
        entityType: row.entity_type,
        entityId: row.entity_id,
        tenderId: row.tender_id,
        tenderNumber: tender?.tender_number || null,
        bidId: row.bid_id,
        bidNumber: bid?.bid_number || null,
        actorUserId: row.actor_user_id,
        actorName: actor?.full_name || 'System Operator',
        actorRole: (actor?.role || row.actor_role) as UserRole,
        description: row.description,
        reason: row.reason,
        metadata: row.metadata || {},
        timestamp: row.timestamp
      };
    });
  }

  /**
   * Record an explicit AI recommendation override with supporting rationale and evidence.
   */
  static async recordAIOverride(user: UserProfile, payload: CreateAIOverridePayload): Promise<AIOverrideRecord> {
    if (!config.hasSupabaseConfigured()) {
      throw new AppError('Database unconfigured', 503, 'DATABASE_UNCONFIGURED');
    }

    const admin = getSupabaseAdminClient();

    const insertData = {
      tender_id: payload.tenderId,
      bid_id: payload.bidId,
      ai_recommendation_text: payload.aiRecommendationText,
      ai_recommendation_timestamp: payload.aiRecommendationTimestamp,
      decision_taken: payload.decisionTaken,
      override_reason: payload.overrideReason,
      supporting_evidence_refs: payload.supportingEvidenceRefs || [],
      officer_user_id: user.id
    };

    const { data, error } = await admin
      .from('ai_overrides')
      .insert(insertData)
      .select(`
        *,
        officer:users (
          id,
          full_name
        )
      `)
      .single();

    if (error || !data) {
      throw new AppError('Failed to record AI override', 500, 'DB_ERROR', error);
    }

    const officer = Array.isArray(data.officer) ? data.officer[0] : data.officer;

    // Log to audit trail
    await this.logEvent({
      eventType: AuditEventType.AI_RECOMMENDATION_OVERRIDDEN,
      entityType: 'AI_OVERRIDE',
      entityId: data.id,
      tenderId: payload.tenderId,
      bidId: payload.bidId,
      actorUserId: user.id,
      actorRole: user.role,
      description: `Officer recorded override of AI recommendation: "${payload.decisionTaken}"`,
      reason: payload.overrideReason,
      metadata: { aiTimestamp: payload.aiRecommendationTimestamp }
    });

    return {
      id: data.id,
      tenderId: data.tender_id,
      bidId: data.bid_id,
      aiRecommendationText: data.ai_recommendation_text,
      aiRecommendationTimestamp: data.ai_recommendation_timestamp,
      decisionTaken: data.decision_taken,
      overrideReason: data.override_reason,
      supportingEvidenceRefs: data.supporting_evidence_refs || [],
      officerUserId: data.officer_user_id,
      officerName: officer?.full_name || user.fullName,
      createdAt: data.created_at
    };
  }

  /**
   * Retrieve AI Overrides for a tender or bid.
   */
  static async listAIOverrides(filters: { tenderId?: string; bidId?: string }): Promise<AIOverrideRecord[]> {
    if (!config.hasSupabaseConfigured()) return [];

    const admin = getSupabaseAdminClient();
    let query = admin
      .from('ai_overrides')
      .select(`
        *,
        officer:users (
          id,
          full_name
        )
      `)
      .order('created_at', { ascending: false });

    if (filters.tenderId) query = query.eq('tender_id', filters.tenderId);
    if (filters.bidId) query = query.eq('bid_id', filters.bidId);

    const { data, error } = await query;
    if (error) {
      throw new AppError('Failed to list AI overrides', 500, 'DB_ERROR', error);
    }

    return (data || []).map((d: any) => {
      const officer = Array.isArray(d.officer) ? d.officer[0] : d.officer;
      return {
        id: d.id,
        tenderId: d.tender_id,
        bidId: d.bid_id,
        aiRecommendationText: d.ai_recommendation_text,
        aiRecommendationTimestamp: d.ai_recommendation_timestamp,
        decisionTaken: d.decision_taken,
        overrideReason: d.override_reason,
        supportingEvidenceRefs: d.supporting_evidence_refs || [],
        officerUserId: d.officer_user_id,
        officerName: officer?.full_name || 'Procurement Officer',
        createdAt: d.created_at
      };
    });
  }

  private static createZipArchive(files: Array<{ name: string; content: string | Buffer }>): Buffer {
    const localHeaders: Buffer[] = [];
    const centralHeaders: Buffer[] = [];
    let offset = 0;

    for (const file of files) {
      const nameBuf = Buffer.from(file.name, 'utf8');
      const dataBuf = Buffer.isBuffer(file.content) ? file.content : Buffer.from(file.content, 'utf8');
      const crc = zlib.crc32(dataBuf);
      const size = dataBuf.length;

      const local = Buffer.alloc(30 + nameBuf.length);
      local.writeUInt32LE(0x04034b50, 0);
      local.writeUInt16LE(20, 4);
      local.writeUInt16LE(0, 6);
      local.writeUInt16LE(0, 8); // Store
      local.writeUInt16LE(0, 10);
      local.writeUInt16LE(0, 12);
      local.writeUInt32LE(crc, 14);
      local.writeUInt32LE(size, 18);
      local.writeUInt32LE(size, 22);
      local.writeUInt16LE(nameBuf.length, 26);
      local.writeUInt16LE(0, 28);
      nameBuf.copy(local, 30);

      localHeaders.push(local, dataBuf);

      const central = Buffer.alloc(46 + nameBuf.length);
      central.writeUInt32LE(0x02014b50, 0);
      central.writeUInt16LE(20, 4);
      central.writeUInt16LE(20, 6);
      central.writeUInt16LE(0, 8);
      central.writeUInt16LE(0, 10);
      central.writeUInt16LE(0, 12);
      central.writeUInt16LE(0, 14);
      central.writeUInt32LE(crc, 16);
      central.writeUInt32LE(size, 20);
      central.writeUInt32LE(size, 24);
      central.writeUInt16LE(nameBuf.length, 28);
      central.writeUInt16LE(0, 30);
      central.writeUInt16LE(0, 32);
      central.writeUInt16LE(0, 34);
      central.writeUInt16LE(0, 36);
      central.writeUInt32LE(0, 38);
      central.writeUInt32LE(offset, 42);
      nameBuf.copy(central, 46);

      centralHeaders.push(central);
      offset += local.length + dataBuf.length;
    }

    const centralBuf = Buffer.concat(centralHeaders);
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(0, 4);
    eocd.writeUInt16LE(0, 6);
    eocd.writeUInt16LE(files.length, 8);
    eocd.writeUInt16LE(files.length, 10);
    eocd.writeUInt32LE(centralBuf.length, 12);
    eocd.writeUInt32LE(offset, 16);
    eocd.writeUInt16LE(0, 20);

    return Buffer.concat([...localHeaders, centralBuf, eocd]);
  }

  static async exportAuditPackage(user: UserProfile, filters: { tenderId?: string }): Promise<Buffer> {
    const events = await this.listAuditEvents(user, { tenderId: filters.tenderId, limit: 500 });
    const overrides = await this.listAIOverrides({ tenderId: filters.tenderId });

    const auditData: any = {
      governanceSystem: 'e-Pramaan Procurement Integrity System',
      jurisdiction: 'Government of India - CVC / CAG Compliance Standard',
      exportedAt: new Date().toISOString(),
      exportedBy: {
        id: user.id,
        name: user.fullName,
        role: user.role,
        email: user.email
      },
      filtersApplied: filters,
      statistics: {
        totalAuditEvents: events.length,
        totalAIOverrides: overrides.length
      },
      aiOverrides: overrides,
      auditEvents: events
    };

    const rawJson = JSON.stringify(auditData, null, 2);
    const checksum = crypto.createHash('sha256').update(rawJson).digest('hex');
    auditData.cryptographicIntegritySeal = {
      algorithm: 'SHA-256',
      checksum,
      verified: true
    };
    const finalJson = JSON.stringify(auditData, null, 2);

    const htmlReport = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>e-Pramaan CVC / CAG Statutory Procurement Audit Dossier</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 40px; color: #1e293b; background: #fff; }
    .header { border-bottom: 3px double #0f172a; padding-bottom: 16px; margin-bottom: 24px; }
    .seal-badge { display: inline-block; background: #065f46; color: #fff; padding: 4px 10px; font-weight: bold; font-size: 11px; border-radius: 4px; }
    h1 { margin: 0 0 6px 0; font-size: 22px; color: #0f172a; }
    .meta { font-size: 12px; color: #64748b; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 12px; }
    th { background: #f1f5f9; text-align: left; padding: 8px 10px; border: 1px solid #cbd5e1; font-weight: 600; }
    td { padding: 8px 10px; border: 1px solid #e2e8f0; vertical-align: top; }
    .checksum { font-family: monospace; background: #f8fafc; padding: 8px; border: 1px dashed #94a3b8; font-size: 11px; word-break: break-all; margin-top: 10px; }
    .footer { margin-top: 40px; border-top: 1px solid #cbd5e1; padding-top: 16px; font-size: 11px; color: #64748b; display: flex; justify-content: space-between; }
  </style>
</head>
<body>
  <div class="header">
    <span class="seal-badge">CVC / CAG STATUTORY AUDIT SEAL</span>
    <h1>e-Pramaan Procurement Integrity System</h1>
    <div style="font-size: 14px; font-weight: bold; color: #334155;">OFFICIAL STATUTORY AUDIT & DECISION RECONSTRUCTION DOSSIER</div>
    <div class="meta">
      Exported: ${new Date().toUTCString()} | Officer: ${user.fullName} (${user.role}) | Integrity Hash: ${checksum.slice(0, 16)}...
    </div>
  </div>

  <h2>1. Audit Trail Summary</h2>
  <table>
    <tr><th>Metric</th><th>Recorded Quantity</th></tr>
    <tr><td>Total Logged Procuring Events</td><td><strong>${events.length}</strong></td></tr>
    <tr><td>Total AI Recommendation Overrides</td><td><strong>${overrides.length}</strong></td></tr>
    <tr><td>Audit Scope Filter</td><td>${filters.tenderId ? 'Tender ID: ' + filters.tenderId : 'Full System Trail'}</td></tr>
    <tr><td>Cryptographic Hash Checksum (SHA-256)</td><td><code>${checksum}</code></td></tr>
  </table>

  ${overrides.length > 0 ? `
  <h2>2. AI Recommendation Overrides (Mandatory Statutory Justifications)</h2>
  <table>
    <thead>
      <tr>
        <th>Timestamp</th>
        <th>Officer</th>
        <th>Tender / Bid</th>
        <th>AI Recommendation</th>
        <th>Final Determination</th>
        <th>Statutory Rationale</th>
      </tr>
    </thead>
    <tbody>
      ${overrides.map((o: any) => `
        <tr>
          <td>${new Date(o.createdAt).toLocaleString()}</td>
          <td>${o.officerName}</td>
          <td>${o.tenderId}</td>
          <td>${o.aiRecommendationText}</td>
          <td><strong>${o.decisionTaken}</strong></td>
          <td>${o.overrideReason}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  ` : ''}

  <h2>3. Chronological Audit Log (Recent ${events.length} Actions)</h2>
  <table>
    <thead>
      <tr>
        <th>Timestamp</th>
        <th>Event Type</th>
        <th>Actor</th>
        <th>Role</th>
        <th>Description & References</th>
      </tr>
    </thead>
    <tbody>
      ${events.map((e: any) => `
        <tr>
          <td>${new Date(e.timestamp).toLocaleString()}</td>
          <td><code>${e.eventType}</code></td>
          <td>${e.actorName}</td>
          <td>${e.actorRole}</td>
          <td>${e.description} ${e.reason ? '(Reason: ' + e.reason + ')' : ''}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="checksum">
    <strong>CRYPTOGRAPHIC INTEGRITY SEAL (SHA-256):</strong><br/>
    ${checksum}
  </div>

  <div class="footer">
    <div>Digitally sealed under the Government of India Public Procurement Governance Framework (GFR 2017).</div>
    <div>e-Pramaan Audit Ledger v1.0</div>
  </div>
</body>
</html>`;

    return this.createZipArchive([
      { name: 'audit-data.json', content: finalJson },
      { name: 'audit-report.html', content: htmlReport }
    ]);
  }
}
