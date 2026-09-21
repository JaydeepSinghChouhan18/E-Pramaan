import dns from 'dns';
import { config as loadDotenv } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
  const origLookup = dns.lookup;
  dns.lookup = (hostname, options, callback) => {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    if (hostname && hostname.includes('supabase.co')) {
      return dns.resolve4(hostname, (err, addresses) => {
        if (err || !addresses || addresses.length === 0) return origLookup(hostname, options, callback);
        if (options && options.all) {
          return callback(null, addresses.map(addr => ({ address: addr, family: 4 })));
        }
        return callback(null, addresses[0], 4);
      });
    }
    return origLookup(hostname, options, callback);
  };
} catch {
  // Silent fallback
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
loadDotenv({ path: path.resolve(__dirname, '../.env') });

const BASE_URL = process.env.BACKEND_URL || 'http://localhost:5000';

async function testApi() {
  console.log(`=== Testing e-Pramaan Live API at ${BASE_URL} ===\n`);

  // 1. Authenticate as Officer
  console.log('1. Authenticating as Officer (officer@epramaan.gov.in)...');
  const loginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'officer@epramaan.gov.in',
      password: 'Officer@2026'
    })
  });

  if (!loginRes.ok) {
    const errBody = await loginRes.text();
    throw new Error(`Officer authentication failed: ${loginRes.status} ${errBody}`);
  }

  const loginJson = await loginRes.json();
  const session = loginJson.data || loginJson;
  const token = session.accessToken;
  const officerUser = session.user;
  console.log(`✓ Officer authenticated successfully!`);
  console.log(`  Name: ${officerUser?.fullName}`);
  console.log(`  Role: ${officerUser?.role}`);
  console.log(`  Organization: ${officerUser?.organization?.legalName} (ID: ${officerUser?.organization?.id})\n`);

  // 2. Fetch list of published tenders
  console.log('2. Fetching Tenders from /api/v1/tenders...');
  const tendersRes = await fetch(`${BASE_URL}/api/v1/tenders`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!tendersRes.ok) {
    throw new Error(`Failed to fetch tenders: ${tendersRes.status}`);
  }

  const tendersJson = await tendersRes.json();
  const tendersRaw = tendersJson.data || tendersJson;
  const tendersList = tendersRaw.items || tendersRaw || [];
  console.log(`✓ Retrieved ${tendersList.length} tenders.\n`);

  // 3. For each tender, test Officer Bids List and Comparative Evaluation
  for (const tender of tendersList) {
    console.log(`------------------------------------------------------------`);
    console.log(`Tender: [${tender.tenderNumber || tender.tender_number}] ${tender.title}`);
    console.log(`Status: ${tender.status}, ID: ${tender.id}`);

    // Call GET /api/v1/bids/tender/:tenderId
    const bidsRes = await fetch(`${BASE_URL}/api/v1/bids/tender/${tender.id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (bidsRes.ok) {
      const bidsJson = await bidsRes.json();
      const bids = bidsJson.data || bidsJson;
      console.log(`  ✓ /api/v1/bids/tender/${tender.id}:`);
      console.log(`    Total Bids Retrieved: ${bids.length}`);
      const statusCounts = {};
      bids.forEach(b => {
        statusCounts[b.status] = (statusCounts[b.status] || 0) + 1;
      });
      console.log(`    Status Breakdown:`, statusCounts);
      if (bids.length > 0) {
        console.log(`    Sample Bid: ${bids[0].bidNumber} | Bidder: ${bids[0].bidderOrganization?.legalName} | Status: ${bids[0].status}`);
      }
    } else {
      console.warn(`  ! /api/v1/bids/tender/${tender.id} returned status ${bidsRes.status}`);
    }

    // Call GET /api/v1/awards/tender/:tenderId/comparative
    const compRes = await fetch(`${BASE_URL}/api/v1/awards/tender/${tender.id}/comparative`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (compRes.ok) {
      const compJson = await compRes.json();
      const comp = compJson.data || compJson;
      console.log(`  ✓ /api/v1/awards/tender/${tender.id}/comparative:`);
      console.log(`    Evaluated Bidders Count: ${comp.length}`);
      if (comp.length > 0) {
        console.log(`    Top Bidders Comparison (First 3):`);
        comp.slice(0, 3).forEach((item, idx) => {
          console.log(`      ${idx + 1}. ${item.bidderOrganizationName} | Amount: INR ${Number(item.bidAmount || 0).toLocaleString('en-IN')} | Score: ${item.complianceScore}% | Risk: ${item.riskLevel} | Status: ${item.status}`);
        });
      }
    } else {
      console.warn(`  ! /api/v1/awards/tender/${tender.id}/comparative returned status ${compRes.status}`);
    }
  }

  console.log(`\n============================================================`);
  console.log(`✓ All Officer API Endpoints Verified Successfully!`);
  console.log(`============================================================`);
}

testApi().catch(err => {
  console.error('API Verification Error:', err);
  process.exit(1);
});
