import { config as loadDotenv } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { getSupabaseAdminClient } from '../dist/config/supabase.js';
import { DEMO_BIDDERS } from './seed_demo_bidders.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

loadDotenv({ path: path.resolve(__dirname, '../.env') });

const admin = getSupabaseAdminClient();

async function cleanup() {
  console.log('=== Cleaning up Demo Bidder Data ===\n');

  const demoEmails = DEMO_BIDDERS.map(d => d.email.toLowerCase());
  const demoIdentifiers = DEMO_BIDDERS.map(d => d.identifier);

  // 1. Fetch Demo Organizations
  const { data: orgs } = await admin.from('organizations')
    .select('id, legal_name')
    .in('identifier', demoIdentifiers);

  const orgIds = (orgs || []).map(o => o.id);
  console.log(`Found ${orgIds.length} demo organizations to remove.`);

  if (orgIds.length > 0) {
    // 2. Fetch Bids for these organizations
    const { data: bids } = await admin.from('bids')
      .select('id')
      .in('bidder_organization_id', orgIds);

    const bidIds = (bids || []).map(b => b.id);
    console.log(`Found ${bidIds.length} demo bids to clean.`);

    if (bidIds.length > 0) {
      // Delete discrepancies
      const { error: discErr } = await admin.from('discrepancies').delete().in('bid_id', bidIds);
      if (discErr) console.warn('Note deleting discrepancies:', discErr.message);

      // Delete requirement evaluations
      const { data: runs } = await admin.from('verification_runs').select('id').in('bid_id', bidIds);
      const runIds = (runs || []).map(r => r.id);
      if (runIds.length > 0) {
        await admin.from('requirement_evaluations').delete().in('verification_run_id', runIds);
      }

      // Delete verification runs
      await admin.from('verification_runs').delete().in('bid_id', bidIds);

      // Delete bid documents
      await admin.from('bid_documents').delete().in('bid_id', bidIds);

      // Delete bids
      await admin.from('bids').delete().in('id', bidIds);
      console.log(`✓ Deleted ${bidIds.length} bids and related evaluation data.`);
    }

    // Delete organization members
    await admin.from('organization_members').delete().in('organization_id', orgIds);

    // Delete organizations
    await admin.from('organizations').delete().in('id', orgIds);
    console.log(`✓ Deleted ${orgIds.length} demo organizations.`);
  }

  // 3. Delete users
  const { data: authUsersData } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const demoAuthUsers = (authUsersData?.users || []).filter(u => demoEmails.includes(u.email?.toLowerCase()));

  console.log(`Found ${demoAuthUsers.length} demo auth users to remove.`);
  for (const u of demoAuthUsers) {
    await admin.from('users').delete().eq('id', u.id);
    await admin.auth.admin.deleteUser(u.id);
    console.log(`✓ Removed demo user: ${u.email}`);
  }

  console.log('\n✓ Demo data cleanup complete.');
}

cleanup().catch(err => {
  console.error('Error during cleanup:', err);
  process.exit(1);
});
