import { config as loadDotenv } from 'dotenv';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { getSupabaseAdminClient } from '../dist/config/supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure backend .env is loaded
loadDotenv({ path: path.resolve(__dirname, '../.env') });

const admin = getSupabaseAdminClient();

// 20 Distinct Bidder Definitions
export const DEMO_BIDDERS = [
  {
    fullName: 'Rajeshwer Singhania',
    email: 'demo.bidder01@epramaan.in',
    companyName: 'Tata Projects Infrastructure Ltd',
    identifier: 'U45200MH2010PLC123401',
    pan: 'AABCT1234A',
    gstin: '27AABCT1234A1Z5',
    tier: 'CLEAN',
    status: 'QUALIFIED',
    priceFactor: 0.96 // 4% below estimate (Aggressive competitive pricing)
  },
  {
    fullName: 'Sunil Gavaskar',
    email: 'demo.bidder02@epramaan.in',
    companyName: 'Larsen Heavy Civil Engineering Ltd',
    identifier: 'U45200MH2011PLC123402',
    pan: 'AABCL2345B',
    gstin: '27AABCL2345B1Z4',
    tier: 'CLEAN',
    status: 'QUALIFIED',
    priceFactor: 0.98
  },
  {
    fullName: 'Cyrus Mistry Jr',
    email: 'demo.bidder03@epramaan.in',
    companyName: 'Shapoorji Pallonji EPC Solutions Ltd',
    identifier: 'U45200MH2012PLC123403',
    pan: 'AABCS3456C',
    gstin: '27AABCS3456C1Z3',
    tier: 'CLEAN',
    status: 'UNDER_REVIEW',
    priceFactor: 1.02
  },
  {
    fullName: 'Keval Vora',
    email: 'demo.bidder04@epramaan.in',
    companyName: 'Afcons Infrastructure Ltd',
    identifier: 'U45200MH2013PLC123404',
    pan: 'AABCA4567D',
    gstin: '27AABCA4567D1Z2',
    tier: 'CLEAN',
    status: 'UNDER_REVIEW',
    priceFactor: 0.99
  },
  {
    fullName: 'Dilip Suryavanshi',
    email: 'demo.bidder05@epramaan.in',
    companyName: 'Dilip Buildcon Engineering Ltd',
    identifier: 'U45200MP2014PLC123405',
    pan: 'AABCD5678E',
    gstin: '23AABCD5678E1Z1',
    tier: 'CLEAN',
    status: 'QUALIFIED',
    priceFactor: 0.95
  },
  {
    fullName: 'A. A. V. Ranga Raju',
    email: 'demo.bidder06@epramaan.in',
    companyName: 'NCC Infrastructure Projects Ltd',
    identifier: 'U45200TG2015PLC123406',
    pan: 'AABCN6789F',
    gstin: '36AABCN6789F1Z0',
    tier: 'CLEAN',
    status: 'UNDER_REVIEW',
    priceFactor: 1.04
  },
  {
    fullName: 'G. M. Rao',
    email: 'demo.bidder07@epramaan.in',
    companyName: 'GMR Highways & Smart Mobility Ltd',
    identifier: 'U45200DL2016PLC123407',
    pan: 'AABCG7890G',
    gstin: '07AABCG7890G1Z9',
    tier: 'CLEAN',
    status: 'UNDER_REVIEW',
    priceFactor: 1.01
  },
  {
    fullName: 'Satish Parakh',
    email: 'demo.bidder08@epramaan.in',
    companyName: 'Ashoka Buildcon Civil EPC Ltd',
    identifier: 'U45200MH2017PLC123408',
    pan: 'AABCA8901H',
    gstin: '27AABCA8901H1Z8',
    tier: 'CLEAN',
    status: 'UNDER_REVIEW',
    priceFactor: 0.97
  },
  {
    fullName: 'Virendra Mhaiskar',
    email: 'demo.bidder09@epramaan.in',
    companyName: 'IRB Infrastructure Developers Ltd',
    identifier: 'U45200MH2018PLC123409',
    pan: 'AABCI9012I',
    gstin: '27AABCI9012I1Z7',
    tier: 'CLEAN',
    status: 'UNDER_REVIEW',
    priceFactor: 1.03
  },
  {
    fullName: 'K. Narsimha Reddy',
    email: 'demo.bidder10@epramaan.in',
    companyName: 'KNR Constructions & Smart Highways Ltd',
    identifier: 'U45200TG2019PLC123410',
    pan: 'AABCK0123J',
    gstin: '36AABCK0123J1Z6',
    tier: 'CLEAN',
    status: 'QUALIFIED',
    priceFactor: 0.94
  },
  {
    fullName: 'Ajit Gulabchand',
    email: 'demo.bidder11@epramaan.in',
    companyName: 'Hindustan Construction Company Ltd',
    identifier: 'U45200MH2010PLC234511',
    pan: 'AABCH1234K',
    gstin: '27AABCH1234K1Z5',
    tier: 'MINOR_DISCREPANCY',
    status: 'UNDER_REVIEW',
    priceFactor: 1.05
  },
  {
    fullName: 'Jagdish Gupta',
    email: 'demo.bidder12@epramaan.in',
    companyName: 'J Kumar Infraprojects Ltd',
    identifier: 'U45200MH2011PLC234512',
    pan: 'AABCJ2345L',
    gstin: '27AABCJ2345L1Z4',
    tier: 'MINOR_DISCREPANCY',
    status: 'UNDER_REVIEW',
    priceFactor: 0.98
  },
  {
    fullName: 'B. K. Goenka',
    email: 'demo.bidder13@epramaan.in',
    companyName: 'Welspun Enterprises Infrastructure Ltd',
    identifier: 'U45200GJ2012PLC234513',
    pan: 'AABCW3456M',
    gstin: '24AABCW3456M1Z3',
    tier: 'MINOR_DISCREPANCY',
    status: 'UNDER_REVIEW',
    priceFactor: 1.06
  },
  {
    fullName: 'Pradeep Kumar Jain',
    email: 'demo.bidder14@epramaan.in',
    companyName: 'PNC Infratech Ltd',
    identifier: 'U45200UP2013PLC234514',
    pan: 'AABCP4567N',
    gstin: '09AABCP4567N1Z2',
    tier: 'MINOR_DISCREPANCY',
    status: 'UNDER_REVIEW',
    priceFactor: 1.00
  },
  {
    fullName: 'Harendra Singh',
    email: 'demo.bidder15@epramaan.in',
    companyName: 'HG Infra Engineering Ltd',
    identifier: 'U45200RJ2014PLC234515',
    pan: 'AABCH5678O',
    gstin: '08AABCH5678O1Z1',
    tier: 'MINOR_DISCREPANCY',
    status: 'SUBMITTED',
    priceFactor: 0.99
  },
  {
    fullName: 'Atul Agarwal',
    email: 'demo.bidder16@epramaan.in',
    companyName: 'Bharat Road Network & Telematics Ltd',
    identifier: 'U45200WB2015PLC234516',
    pan: 'AABCB6789P',
    gstin: '19AABCB6789P1Z0',
    tier: 'MINOR_DISCREPANCY',
    status: 'SUBMITTED',
    priceFactor: 1.08
  },
  {
    fullName: 'Pravin Patel',
    email: 'demo.bidder17@epramaan.in',
    companyName: 'Patel Engineering & Tech Solutions Ltd',
    identifier: 'U45200MH2016PLC234517',
    pan: 'AABCP7890Q',
    gstin: '27AABCP7890Q1Z9',
    tier: 'CRITICAL_DISCREPANCY',
    status: 'DISQUALIFIED',
    priceFactor: 0.91 // Very cheap but non-compliant
  },
  {
    fullName: 'Amitabh Mundra',
    email: 'demo.bidder18@epramaan.in',
    companyName: 'Simplex Infrastructures EPC Ltd',
    identifier: 'U45200WB2017PLC234518',
    pan: 'AABCS8901R',
    gstin: '19AABCS8901R1Z8',
    tier: 'CRITICAL_DISCREPANCY',
    status: 'DISQUALIFIED',
    priceFactor: 0.93
  },
  {
    fullName: 'Santi Sen',
    email: 'demo.bidder19@epramaan.in',
    companyName: 'ITD Cementation Highway Div Ltd',
    identifier: 'U45200MH2018PLC234519',
    pan: 'AABCI9012S',
    gstin: '27AABCI9012S1Z7',
    tier: 'CRITICAL_DISCREPANCY',
    status: 'UNDER_REVIEW',
    priceFactor: 1.12
  },
  {
    fullName: 'J. Brij Mohan Rao',
    email: 'demo.bidder20@epramaan.in',
    companyName: 'Gayatri Projects Ltd',
    identifier: 'U45200TG2019PLC234520',
    pan: 'AABCG0123T',
    gstin: '36AABCG0123T1Z6',
    tier: 'CRITICAL_DISCREPANCY',
    status: 'UNDER_REVIEW',
    priceFactor: 1.15
  }
];

export const DEMO_PASSWORD = 'DemoBidder@2026';

function generateDocHash(bidId, reqCode, docName) {
  return crypto.createHash('sha256').update(`epramaan-doc-${bidId}-${reqCode}-${docName}`).digest('hex');
}

async function seed() {
  console.log('=== Starting e-Pramaan Demo / Seed Data Setup ===\n');

  // 1. Ensure Privileged Test Accounts exist and have confirmed passwords
  console.log('--- Step 1: Ensuring Privileged System Accounts ---');
  const privilegedAccounts = [
    {
      id: '53dc7183-4f94-4aed-9ceb-d6bf1231fa18',
      email: 'officer@epramaan.gov.in',
      fullName: 'Rajesh Sharma (Officer)',
      role: 'OFFICER',
      password: 'Officer@2026',
      orgId: 'a74f3772-47b9-4a67-bcc2-c3a2bbb0b6f8', // NHAI
      membershipRole: 'PRIMARY_OFFICER'
    },
    {
      id: 'ef77b97d-bfc3-4a42-a658-f53a9a882008',
      email: 'admin@epramaan.gov.in',
      fullName: 'System Administrator',
      role: 'ADMIN',
      password: 'Admin@2026',
      orgId: 'be23a1c4-f668-44d9-892d-2164c68a60d2', // NIC
      membershipRole: 'PRIMARY_OFFICER'
    },
    {
      id: 'a77e7e26-dc8f-487b-8b7a-eb45e6b57757',
      email: 'auditor@epramaan.gov.in',
      fullName: 'Sunita Patel (Auditor)',
      role: 'AUDITOR',
      password: 'Auditor@2026',
      orgId: '66c8d0c7-5d26-481b-98ea-c75823279f82', // CAG
      membershipRole: 'COMPLIANCE_OFFICER'
    }
  ];

  for (const priv of privilegedAccounts) {
    // Update password in auth.users
    await admin.auth.admin.updateUserById(priv.id, {
      password: priv.password,
      email_confirm: true,
      user_metadata: { full_name: priv.fullName, role: priv.role }
    }).catch(err => console.warn(`Note updating auth user ${priv.email}:`, err.message));

    // Ensure public.users profile
    await admin.from('users').upsert({
      id: priv.id,
      email: priv.email,
      full_name: priv.fullName,
      role: priv.role,
      is_active: true
    });

    // Ensure organization membership
    const { data: member } = await admin.from('organization_members')
      .select('id')
      .eq('user_id', priv.id)
      .eq('organization_id', priv.orgId)
      .maybeSingle();

    if (!member) {
      await admin.from('organization_members').insert({
        user_id: priv.id,
        organization_id: priv.orgId,
        membership_role: priv.membershipRole
      });
    }
    console.log(`✓ Verified account: ${priv.email} (${priv.role})`);
  }

  // 2. Provision the 20 Demo Bidder Users, Organizations & Memberships
  console.log('\n--- Step 2: Provisioning 20 Distinct Bidder Identities ---');
  const bidderEntities = [];

  // Get all existing auth users once
  const { data: authUsersData } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const authUsersMap = new Map((authUsersData?.users || []).map(u => [u.email.toLowerCase(), u]));

  for (let i = 0; i < DEMO_BIDDERS.length; i++) {
    const def = DEMO_BIDDERS[i];
    let authUser = authUsersMap.get(def.email.toLowerCase());

    if (!authUser) {
      const { data: createdUser, error: createAuthErr } = await admin.auth.admin.createUser({
        email: def.email,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: {
          full_name: def.fullName,
          role: 'BIDDER'
        }
      });
      if (createAuthErr || !createdUser.user) {
        throw new Error(`Failed to create auth user ${def.email}: ${createAuthErr?.message}`);
      }
      authUser = createdUser.user;
    } else {
      // Update password and confirm email
      await admin.auth.admin.updateUserById(authUser.id, {
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: def.fullName, role: 'BIDDER' }
      });
    }

    const userId = authUser.id;

    // Upsert public.users
    await admin.from('users').upsert({
      id: userId,
      email: def.email,
      full_name: def.fullName,
      role: 'BIDDER',
      is_active: true
    });

    // Check or Insert Organization
    let { data: org } = await admin.from('organizations')
      .select('*')
      .eq('identifier', def.identifier)
      .maybeSingle();

    if (!org) {
      const { data: newOrg, error: orgErr } = await admin.from('organizations').insert({
        legal_name: def.companyName,
        organization_type: 'BIDDER_ENTITY',
        identifier: def.identifier,
        is_verified: true
      }).select().single();
      if (orgErr || !newOrg) {
        throw new Error(`Failed to create org for ${def.companyName}: ${orgErr?.message}`);
      }
      org = newOrg;
    } else {
      await admin.from('organizations').update({
        legal_name: def.companyName,
        is_verified: true
      }).eq('id', org.id);
    }

    // Ensure Membership
    const { data: member } = await admin.from('organization_members')
      .select('id')
      .eq('user_id', userId)
      .eq('organization_id', org.id)
      .maybeSingle();

    if (!member) {
      await admin.from('organization_members').insert({
        user_id: userId,
        organization_id: org.id,
        membership_role: 'AUTHORIZED_REPRESENTATIVE'
      });
    }

    bidderEntities.push({
      def,
      userId,
      orgId: org.id,
      orgLegalName: org.legal_name,
      orgIdentifier: org.identifier
    });
    console.log(`✓ Bidder ${i + 1}/20: ${def.fullName} | ${def.companyName} (${def.email})`);
  }

  // 3. Fetch Suitable Tenders & Requirements
  console.log('\n--- Step 3: Fetching Suitable Tenders and Requirements ---');
  const { data: tenders, error: tenderErr } = await admin
    .from('tenders')
    .select(`
      id,
      tender_number,
      title,
      status,
      estimated_value,
      procuring_organization_id,
      created_by,
      tender_requirements (*)
    `)
    .in('status', ['PUBLISHED', 'AWARDED'])
    .order('created_at', { ascending: true });

  if (tenderErr || !tenders || tenders.length === 0) {
    throw new Error(`No suitable tenders found: ${tenderErr?.message}`);
  }

  console.log(`Found ${tenders.length} suitable tenders:`);
  for (const t of tenders) {
    console.log(`  - [${t.status}] ${t.tender_number}: "${t.title}" (Value: INR ${Number(t.estimated_value || 0).toLocaleString('en-IN')}, Reqs: ${t.tender_requirements?.length || 0})`);
  }

  // 4. Generate Bids, Bid Documents, Verification Runs & Discrepancies
  console.log('\n--- Step 4: Seeding Bids, Documents, Evaluations & Discrepancies ---');
  let totalBidsSeeded = 0;
  let totalDocsSeeded = 0;
  let totalRunsSeeded = 0;
  let totalDiscrepanciesSeeded = 0;

  const officerUser = privilegedAccounts[0]; // Rajesh Sharma

  for (const tender of tenders) {
    const estVal = Number(tender.estimated_value || 10000000);
    const requirements = tender.tender_requirements || [];
    console.log(`\nProcessing Tender: ${tender.tender_number} (${tender.title})...`);

    for (let bIdx = 0; bIdx < bidderEntities.length; bIdx++) {
      const bEntity = bidderEntities[bIdx];
      const { def, userId, orgId, orgLegalName, orgIdentifier } = bEntity;

      // Check if this org already has an active bid for this tender
      const { data: existingBid } = await admin
        .from('bids')
        .select('id, bid_number, status, bid_amount')
        .eq('tender_id', tender.id)
        .eq('bidder_organization_id', orgId)
        .neq('status', 'WITHDRAWN')
        .maybeSingle();

      let bidId;
      let bidNumber;
      // Calculate realistic bid amount with variance
      // Base variance: priceFactor +/- small variation based on tender
      const jitter = ((bIdx * 7) % 5 - 2) * 0.005; // -1% to +1%
      const effectiveFactor = def.priceFactor + jitter;
      const rawBidAmount = Math.round(estVal * effectiveFactor);
      // Round to nearest 1000
      const bidAmount = Math.round(rawBidAmount / 1000) * 1000;

      const submissionNotes = `Official Commercial and Technical Bid Submission by ${orgLegalName} for ${tender.tender_number}.\n` +
        `Total Quoted Value: INR ${bidAmount.toLocaleString('en-IN')}. ` +
        `All statutory filings (GST, PAN, MCA, EPFO) and compliance certificates verified and attached.`;

      if (existingBid) {
        bidId = existingBid.id;
        bidNumber = existingBid.bid_number;
        await admin.from('bids').update({
          status: def.status,
          bid_amount: bidAmount,
          submission_notes: submissionNotes,
          submitted_at: existingBid.submitted_at || new Date(Date.now() - 3 * 86400000).toISOString()
        }).eq('id', bidId);
      } else {
        const hex = crypto.randomBytes(3).toString('hex').toUpperCase();
        bidNumber = `BID-${new Date().getFullYear()}-${tender.tender_number.replace(/[^A-Z0-9]/gi, '').slice(-4)}-${def.identifier.slice(-4)}-${hex}`;
        const submittedAt = new Date(Date.now() - (4 + (bIdx % 5)) * 86400000).toISOString();

        const { data: newBid, error: bidInsertErr } = await admin.from('bids').insert({
          tender_id: tender.id,
          bidder_organization_id: orgId,
          submitted_by_user_id: userId,
          bid_number: bidNumber,
          status: def.status,
          bid_amount: bidAmount,
          submission_notes: submissionNotes,
          submitted_at: submittedAt
        }).select().single();

        if (bidInsertErr || !newBid) {
          console.error(`Error inserting bid for ${def.email} on ${tender.tender_number}:`, bidInsertErr);
          continue;
        }
        bidId = newBid.id;
      }
      totalBidsSeeded++;

      // Seed Documents for all requirements on this tender
      const createdDocRecords = [];
      for (const req of requirements) {
        const docName = `${orgLegalName.split(' ')[0]}_${req.code}_Certified.pdf`;
        const storagePath = `bids/${bidId}/${req.id}_${docName}`;
        const hash = generateDocHash(bidId, req.code, docName);
        const fileSize = 450000 + ((bIdx * 314159 + req.code.length * 1000) % 950000);

        let docStatus = 'VERIFIED';
        if (def.tier === 'MINOR_DISCREPANCY') {
          if (req.code.includes('GST') || req.category === 'TAX') {
            docStatus = 'PARTIALLY_VERIFIED';
          }
        } else if (def.tier === 'CRITICAL_DISCREPANCY') {
          if (req.is_mandatory && (req.code.includes('PAN') || req.code.includes('COMPANY') || req.category === 'STATUTORY')) {
            docStatus = 'DISCREPANCY';
          }
        }

        const docPayload = {
          bid_id: bidId,
          tender_requirement_id: req.id,
          document_name: docName,
          storage_path: storagePath,
          file_size: fileSize,
          mime_type: 'application/pdf',
          sha256_hash: hash,
          verification_status: docStatus,
          metadata: {
            pan: def.pan,
            gstin: def.gstin,
            legalName: orgLegalName,
            verifiedAt: new Date().toISOString(),
            signatory: def.fullName
          },
          uploaded_by: userId
        };

        const { data: existingDoc } = await admin.from('bid_documents')
          .select('id')
          .eq('bid_id', bidId)
          .eq('tender_requirement_id', req.id)
          .maybeSingle();

        let docId;
        if (existingDoc) {
          docId = existingDoc.id;
          await admin.from('bid_documents').update(docPayload).eq('id', docId);
        } else {
          const { data: newDoc } = await admin.from('bid_documents').insert(docPayload).select().single();
          docId = newDoc?.id;
        }
        totalDocsSeeded++;
        createdDocRecords.push({ id: docId, reqId: req.id, reqCode: req.code, docStatus, isMandatory: req.is_mandatory });
      }

      // Mark previous verification runs as is_latest = false
      await admin.from('verification_runs').update({ is_latest: false }).eq('bid_id', bidId);

      // Determine Compliance Scoring & Risk Assessment based on Tier
      let overallScore = 95;
      let mandatoryComplied = true;
      let riskLevel = 'LOW';
      let riskScore = 12;
      let runVerificationStatus = 'VERIFIED';
      let discrepanciesList = [];

      const mandTotal = requirements.filter(r => r.is_mandatory).length;
      const optTotal = requirements.filter(r => !r.is_mandatory).length;

      if (def.tier === 'CLEAN') {
        overallScore = 90 + ((bIdx * 3) % 9); // 90 to 98
        mandatoryComplied = true;
        riskLevel = 'LOW';
        riskScore = 10 + (bIdx % 8);
        runVerificationStatus = 'VERIFIED';
      } else if (def.tier === 'MINOR_DISCREPANCY') {
        overallScore = 74 + ((bIdx * 2) % 9); // 74 to 82
        mandatoryComplied = true;
        riskLevel = 'MEDIUM';
        riskScore = 38 + ((bIdx * 3) % 10);
        runVerificationStatus = 'PARTIALLY_VERIFIED';
        discrepanciesList.push({
          code: 'DISC_GST_FILING_LAG',
          title: 'GST Monthly Return Filing Delay Notice',
          description: `GSTR-3B for preceding quarter filed 4 business days post statutory deadline. Late filing interest reconciled and cleared with challan.`,
          severity: 'WARNING',
          expectedValue: 'On-time monthly filing',
          actualValue: '4-day delay with penalty challan cleared'
        });
      } else if (def.tier === 'CRITICAL_DISCREPANCY') {
        overallScore = 42 + ((bIdx * 4) % 12); // 42 to 54
        mandatoryComplied = false;
        riskLevel = def.status === 'DISQUALIFIED' ? 'CRITICAL' : 'HIGH';
        riskScore = 78 + ((bIdx * 3) % 14);
        runVerificationStatus = 'DISCREPANCY';
        discrepanciesList.push({
          code: 'DISC_FIN_TURNOVER_DEFICIT',
          title: 'Mandatory Turnover Threshold Deficit',
          description: `Certified annual turnover submitted for FY 2024-25 is INR 14.50 Cr, which fails to meet the tender mandatory threshold of INR 25.00 Cr.`,
          severity: 'CRITICAL',
          expectedValue: 'Annual Turnover >= INR 25.00 Cr',
          actualValue: 'Audited Turnover INR 14.50 Cr'
        });
        if (bIdx % 2 === 0) {
          discrepanciesList.push({
            code: 'DISC_PAN_NAME_MISMATCH',
            title: 'PAN Card Name Deviation',
            description: `Entity legal name on CBDT PAN record differs from Incorporation Certificate registered with MCA.`,
            severity: 'CRITICAL',
            expectedValue: orgLegalName,
            actualValue: `${orgLegalName.slice(0, 15)} (Shortened)`
          });
        }
      }

      const mandMet = mandatoryComplied ? mandTotal : Math.max(0, mandTotal - 1);
      const optMet = optTotal;

      const runPayload = {
        bid_id: bidId,
        tender_id: tender.id,
        run_status: 'COMPLETED',
        verification_status: runVerificationStatus,
        compliance_score: {
          overallScore,
          mandatoryComplied,
          mandatoryMetCount: mandMet,
          mandatoryTotalCount: mandTotal,
          optionalMetCount: optMet,
          optionalTotalCount: optTotal,
          categoryScores: {
            STATUTORY: def.tier === 'CRITICAL_DISCREPANCY' ? 45 : 95,
            TAX: def.tier === 'MINOR_DISCREPANCY' ? 75 : 98,
            LOCAL_CONTENT: 100,
            MSME: 100
          }
        },
        risk_assessment: {
          riskLevel,
          score: riskScore,
          factors: def.tier === 'CLEAN'
            ? ['Clean statutory filing history', 'Verified PAN/GSTN credentials', 'No adverse litigation or debarment']
            : def.tier === 'MINOR_DISCREPANCY'
            ? ['Single quarter GST return delayed past due date', 'UDIN certificate nearing validity threshold']
            : ['Mandatory financial turnover qualification deficit', 'Cross-registry entity name deviation flagged']
        },
        ai_recommendation: {
          executiveSummary: def.tier === 'CLEAN'
            ? `Bidder ${orgLegalName} demonstrates complete regulatory compliance across all statutory benchmarks. Recommended for technical and commercial qualification.`
            : def.tier === 'MINOR_DISCREPANCY'
            ? `Bidder ${orgLegalName} meets core technical thresholds with minor non-blocking tax filing timing variances. Suitable for provisional advancement subject to officer scrutiny.`
            : `Bidder ${orgLegalName} failed critical mandatory criteria (turnover / identity validation). Rejection recommended under Clause 4.2 of General Procurement Guidelines.`,
          recommendation: def.tier === 'CLEAN' ? 'QUALIFIED' : (def.tier === 'MINOR_DISCREPANCY' ? 'REVIEW_REQUIRED' : 'DISQUALIFIED')
        },
        sources_status: [
          { source: 'MCA21_CORPORATE_REGISTRY', status: 'VERIFIED', latencyMs: 142 },
          { source: 'GSTN_PORTAL', status: def.tier === 'MINOR_DISCREPANCY' ? 'PARTIALLY_VERIFIED' : 'VERIFIED', latencyMs: 210 },
          { source: 'CBDT_PAN_REGISTRY', status: def.tier === 'CRITICAL_DISCREPANCY' ? 'FLAGGED' : 'VERIFIED', latencyMs: 98 },
          { source: 'EPFO_SHRAM_SUVIDHA', status: 'VERIFIED', latencyMs: 165 }
        ],
        executed_by: officerUser.id,
        executed_role: 'OFFICER',
        started_at: new Date(Date.now() - 2 * 86400000).toISOString(),
        completed_at: new Date(Date.now() - 2 * 86400000 + 45000).toISOString(),
        is_latest: true
      };

      const { data: run, error: runErr } = await admin
        .from('verification_runs')
        .insert(runPayload)
        .select()
        .single();

      if (runErr || !run) {
        console.error(`Error inserting verification run for bid ${bidNumber}:`, runErr);
        continue;
      }
      totalRunsSeeded++;

      // Insert requirement evaluations
      for (const cd of createdDocRecords) {
        const isComp = def.tier === 'CLEAN' || (def.tier === 'MINOR_DISCREPANCY' && !cd.reqCode.includes('GST')) || (def.tier === 'CRITICAL_DISCREPANCY' && !cd.isMandatory);
        await admin.from('requirement_evaluations').insert({
          verification_run_id: run.id,
          tender_requirement_id: cd.reqId,
          verification_status: cd.docStatus,
          compliance_status: isComp ? 'COMPLIANT' : (def.tier === 'MINOR_DISCREPANCY' ? 'UNDER_REVIEW' : 'NON_COMPLIANT'),
          score_awarded: isComp ? 100 : (def.tier === 'MINOR_DISCREPANCY' ? 75 : 40),
          max_score: 100,
          evidence_found: true,
          document_references: [{ documentId: cd.id, requirementCode: cd.reqCode }],
          extracted_fields: { pan: def.pan, gstin: def.gstin, legalName: orgLegalName },
          reasons: isComp ? ['Requirement fully validated against official registry'] : ['Discrepancy or timing variance flagged in statutory record']
        });
      }

      // Insert discrepancies
      for (const disc of discrepanciesList) {
        await admin.from('discrepancies').insert({
          verification_run_id: run.id,
          bid_id: bidId,
          code: disc.code,
          title: disc.title,
          description: disc.description,
          severity: disc.severity,
          affected_requirement_ids: createdDocRecords.map(r => r.reqId),
          affected_document_ids: createdDocRecords.map(r => r.id),
          expected_value: disc.expectedValue,
          actual_value: disc.actualValue
        });
        totalDiscrepanciesSeeded++;
      }
    }
  }

  console.log('\n======================================================');
  console.log('✓ SEEDING COMPLETED SUCCESSFULLY');
  console.log('======================================================');
  console.log(`Total Bidder Organizations Provisioned: ${bidderEntities.length}`);
  console.log(`Total Suitable Tenders Seeded:          ${tenders.length}`);
  console.log(`Total Bids Created / Updated:           ${totalBidsSeeded}`);
  console.log(`Total Bid Documents Registered:         ${totalDocsSeeded}`);
  console.log(`Total Verification Runs Created:        ${totalRunsSeeded}`);
  console.log(`Total Discrepancies Recorded:           ${totalDiscrepanciesSeeded}`);
  console.log('======================================================\n');
}

seed().catch(err => {
  console.error('FATAL Error seeding demo data:', err);
  process.exit(1);
});
