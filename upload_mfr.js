// Calculates EP's per-round MFR from Excel files and PATCHes each round via admin API
const XLSX = require('xlsx');
const fs = require('fs');
// uses built-in fetch (Node 18+)

const dir = process.argv[2];
const ADMIN_TOKEN = process.argv[3] || 'eastperth2026';
const BASE_URL = process.argv[4] || 'http://localhost:3000';

const files = fs.readdirSync(dir).filter(f => f.endsWith('.xlsx')).sort();
const ALL = ['Claremont','East Fremantle','East Perth','Peel Thunder','Perth','South Fremantle','Subiaco','Swan Districts','West Coast Eagles','West Perth'];
const STATS = ['Centre Bounce First Possession','Clearance','Inside 50','Score Involvement','Contested Possession','Ground Ball Get','Points'];

const hdrs = { 'Content-Type': 'application/json', 'x-admin-token': ADMIN_TOKEN };

async function patch(roundNum, body) {
  const res = await fetch(`${BASE_URL}/api/admin/rounds/${roundNum}?season=2026`, { method: 'PATCH', headers: hdrs, body: JSON.stringify(body) });
  return { status: res.status, body: await res.text() };
}

async function post(roundNum, body) {
  const res = await fetch(`${BASE_URL}/api/admin/rounds?season=2026`, { method: 'POST', headers: hdrs, body: JSON.stringify(body) });
  return { status: res.status, body: await res.text() };
}

async function main() {
  const rounds = [];

  for (const file of files) {
    const roundMatch = file.match(/R(\d+)/i);
    const isFW = /FW(\d+)/i.test(file);
    const isPF = /PF/i.test(file);
    const isGF = /GF/i.test(file);

    let roundNum;
    if (isGF) roundNum = 24;
    else if (isPF) roundNum = 23;
    else if (isFW) { const m = file.match(/FW(\d+)/i); roundNum = 20 + parseInt(m[1]); }
    else if (roundMatch) roundNum = parseInt(roundMatch[1]);
    else continue;

    const wb = XLSX.readFile(`${dir}/${file}`);
    const ws = wb.Sheets['RAW DATA'];
    if (!ws) continue;
    const rows = XLSX.utils.sheet_to_json(ws, { defval: null });

    let section = 'FOR';
    const dF = new Set(), dA = new Set();
    const gFor = {}, gAgainst = {};
    for (const t of ALL) { gFor[t] = {}; gAgainst[t] = {}; }

    for (const r of rows) {
      if (typeof r['#'] === 'string') { section = r['#'].includes('AGAINST') ? 'AGAINST' : 'FOR'; continue; }
      const club = r['Club'];
      if (!ALL.includes(club)) continue;
      const key = club + file;
      if (section === 'FOR' && !dF.has(key)) { for (const s of STATS) gFor[club][s] = r[s] || 0; dF.add(key); }
      if (section === 'AGAINST' && !dA.has(key)) { for (const s of STATS) gAgainst[club][s] = r[s] || 0; dA.add(key); }
    }

    const ep = 'East Perth';
    if (!gFor[ep]['Points'] && !gAgainst[ep]['Points']) continue;

    const cbfp_diff = gFor[ep]['Centre Bounce First Possession'] - gAgainst[ep]['Centre Bounce First Possession'];
    const clr_diff  = gFor[ep]['Clearance'] - gAgainst[ep]['Clearance'];
    const i50_diff  = gFor[ep]['Inside 50'] - gAgainst[ep]['Inside 50'];
    const si_diff   = gFor[ep]['Score Involvement'] - gAgainst[ep]['Score Involvement'];
    const cp_diff   = gFor[ep]['Contested Possession'] - gAgainst[ep]['Contested Possession'];
    const gbg_diff  = gFor[ep]['Ground Ball Get'] - gAgainst[ep]['Ground Ball Get'];
    const mfr       = Math.round((cbfp_diff + clr_diff * 2 + i50_diff + si_diff / 3) * 10) / 10;
    const won       = gFor[ep]['Points'] > gAgainst[ep]['Points'];

    rounds.push({
      roundNum, cbfp_diff, clr_diff, i50_diff, si_diff, cp_diff, gbg_diff, mfr, won, file,
      // raw values for radar chart
      mid_cbfp_ep: gFor[ep]['Centre Bounce First Possession'],
      mid_cbfp_opp: gAgainst[ep]['Centre Bounce First Possession'],
      mid_clr_ep: gFor[ep]['Clearance'],
      mid_clr_opp: gAgainst[ep]['Clearance'],
      mid_i50_ep: gFor[ep]['Inside 50'],
      mid_i50_opp: gAgainst[ep]['Inside 50'],
      mid_si_ep: gFor[ep]['Score Involvement'],
      mid_si_opp: gAgainst[ep]['Score Involvement'],
      mid_cp_ep: gFor[ep]['Contested Possession'],
      mid_cp_opp: gAgainst[ep]['Contested Possession'],
      mid_gbg_ep: gFor[ep]['Ground Ball Get'],
      mid_gbg_opp: gAgainst[ep]['Ground Ball Get'],
    });
  }

  console.log(`Found ${rounds.length} EP rounds. Uploading...`);

  for (const r of rounds) {
    const payload = {
      mfr_cbfp_diff: r.cbfp_diff,
      mfr_clr_diff: r.clr_diff,
      mfr_i50_diff: r.i50_diff,
      mfr_si_diff: r.si_diff,
      mfr_cp_diff: r.cp_diff,
      mfr_gbg_diff: r.gbg_diff,
      mfr: r.mfr,
      mid_cbfp_ep: r.mid_cbfp_ep, mid_cbfp_opp: r.mid_cbfp_opp,
      mid_clr_ep: r.mid_clr_ep, mid_clr_opp: r.mid_clr_opp,
      mid_i50_ep: r.mid_i50_ep, mid_i50_opp: r.mid_i50_opp,
      mid_si_ep: r.mid_si_ep, mid_si_opp: r.mid_si_opp,
      mid_cp_ep: r.mid_cp_ep, mid_cp_opp: r.mid_cp_opp,
      mid_gbg_ep: r.mid_gbg_ep, mid_gbg_opp: r.mid_gbg_opp,
    };
    // Try PATCH first (round exists), then POST if 404
    let res = await patch(r.roundNum, payload);
    if (res.status === 404) {
      const label = r.roundNum >= 24 ? 'GF' : r.roundNum === 23 ? 'PF' : r.roundNum === 22 ? 'FW2' : r.roundNum === 21 ? 'FW1' : `Rd ${r.roundNum}`;
      res = await post(r.roundNum, { round_num: r.roundNum, label, short: label, wl: r.won ? 'W' : 'L', ...payload });
    }
    console.log(`Rd ${r.roundNum}: MFR=${r.mfr} (${r.won?'W':'L'}) → ${res.status}`);
  }
  console.log('Done.');
}

main().catch(console.error);
