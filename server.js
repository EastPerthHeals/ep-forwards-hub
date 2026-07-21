const express = require('express');
const path = require('path');
const multer = require('multer');
const XLSX = require('xlsx');
const { load, save, getSitePassword, setSitePassword, getGamedayPassword, setGamedayPassword, getAdminPassword, setAdminPassword, getAnalysisVisible, setAnalysisVisible, getOppositionTeam, getAllOpposition, setOppositionTeam, getOppositionNotes, addOppositionNote, deleteOppositionNote, getRoundNotes, addRoundNote, deleteRoundNote, getLeagueData, setLeagueData, getLeagueRoundsData, setLeagueRoundsData } = require('./db');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const WAFL_TEAMS = ['Claremont','East Fremantle','East Perth','Peel Thunder','Perth','South Fremantle','Subiaco','Swan Districts','West Coast Eagles','West Perth'];

function parseLeagueExcel(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  function sheet(name) { return XLSX.utils.sheet_to_json(wb.Sheets[name] || {}, { defval: null }); }

  const overall = sheet('OVERALL_RATING').filter(r => WAFL_TEAMS.includes(r['Team']));
  const bm = sheet('BM_CALC');
  const td = sheet('TD_CALC');
  const con = sheet('CON_CALC');
  const scor = sheet('SCOR_CALC');
  const stop = sheet('STOP_CALC');
  const bmRaw = sheet('BM_RAW_DATA');
  const tdRaw = sheet('TD_RAW_DATA');
  const conRaw = sheet('CON_RAW_DATA');
  const scorRaw = sheet('SCOR_RAW_DATA');
  const stopRaw = sheet('STOP_DATA');

  const teams = {};
  for (const r of overall) {
    teams[r['Team']] = {
      overall_rating: r['Overall Rating (Rounded)'],
      overall_avg: r['Overall Avg (1–5)'],
      bm_rating: r['Ball Movement Rating'],
      td_rating: r['Team Defence Rating'],
      con_rating: r['Contest Rating'],
      scor_rating: r['Scoring Rating'],
      stop_rating: r['Stoppage Rating'],
    };
  }
  for (const r of bm) { if (teams[r['Team']]) { teams[r['Team']].bm_profile = r['BM_Profile']; } }
  for (const r of td) { if (teams[r['Team']]) { teams[r['Team']].td_profile = r['TD_Profile']; } }
  for (const r of con) {
    const name = r['TEAM'] || r['Team'];
    if (teams[name]) { teams[name].con_profile = r['PROFILE'] || r['CON_Profile']; }
  }
  for (const r of scor) { if (teams[r['Team']]) { teams[r['Team']].scor_profile = r['SCOR_Profile']; } }
  for (const r of stop) { if (teams[r['Team']]) { teams[r['Team']].stop_profile = r['STOP_Profile']; } }

  // Raw stats — explain why each team has its profile
  for (const r of bmRaw) {
    if (!teams[r['Team']]) continue;
    const k = r['Kick'] || 0, hb = r['Handball'] || 0;
    teams[r['Team']].bm_stats = {
      disposal_eff: r['Disposal Eff %'],
      kicking_eff: r['Kicking Eff %'],
      kick_pct: k + hb > 0 ? Math.round(k / (k + hb) * 100) : null,
      unc_marks: r['Uncontested Mark'],
      turnovers: r['Turnover'],
    };
  }
  for (const r of tdRaw) {
    if (!teams[r['Team']]) continue;
    teams[r['Team']].td_stats = {
      intercept_marks: r['intercept Mark'],
      intercept_poss: r['Intercept Possession'],
      rebound_rate: r['Rebound 50 Rate %'] != null ? Math.round(r['Rebound 50 Rate %'] * 10) / 10 : null,
      i50_against: r['Inside 50 Against'],
      pts_per_i50_against: r['Pts Agst p In50 Agst'] != null ? Math.round(r['Pts Agst p In50 Agst'] * 100) / 100 : null,
    };
  }
  for (const r of conRaw) {
    if (!teams[r['Team']]) continue;
    teams[r['Team']].con_stats = {
      hard_ball_gets: r['Hard Ball Get'],
      gbg_pre: r['Ground Ball Get Pre-Clearance'],
      contested_poss: r['Contested Possession'],
      tackles_pre: r['Tackles Pre Clearance'],
      fk_against: r['Free Kick Against'],
    };
  }
  for (const r of scorRaw) {
    if (!teams[r['Team']]) continue;
    teams[r['Team']].scor_stats = {
      accuracy: r['Scoring Accuracy %'],
      pts_per_i50: r['Points per Inside 50'] != null ? Math.round(r['Points per Inside 50'] * 100) / 100 : null,
      f50_marks_per_i50: r['F50 Marks per Inside 50'] != null ? Math.round(r['F50 Marks per Inside 50'] * 1000) / 1000 : null,
      stop_scoring: r['Stoppage Scoring Points '],
      to_scoring: r['Turnover Scoring Points '],
    };
  }
  for (const r of stopRaw) {
    if (!teams[r['Team']]) continue;
    teams[r['Team']].stop_stats = {
      hitout_adv: r['Hitout to Advantage'],
      fp_per_stop: r['First Possession per Stoppage'] != null ? Math.round(r['First Possession per Stoppage'] * 100) / 100 : null,
      clear_per_stop: r['Clearance per Stoppage'] != null ? Math.round(r['Clearance per Stoppage'] * 100) / 100 : null,
      stop_scoring: r['Stoppage Scoring Points '],
      stop_against: r['Stoppage Scoring Points Against'],
    };
  }

  // Store ALL numeric columns from all raw sheets so the Raw Stats explorer can query anything
  const SKIP_KEYS = new Set(['Team','TEAM','#','Club','Rank','Round']);
  for (const rows of [bmRaw, tdRaw, conRaw, scorRaw, stopRaw]) {
    for (const r of rows) {
      const name = r['Team'] || r['TEAM'];
      if (!teams[name]) continue;
      if (!teams[name].raw_all) teams[name].raw_all = {};
      for (const [k, v] of Object.entries(r)) {
        if (SKIP_KEYS.has(k) || v == null || typeof v !== 'number') continue;
        teams[name].raw_all[k.trim()] = v;
      }
    }
  }

  return { teams, updated_at: new Date().toISOString() };
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

async function requireAdmin(req, res, next) {
  try {
    const token = req.headers['x-admin-token'] || req.query.token;
    const current = await getAdminPassword();
    if (token !== current) return res.status(401).json({ error: 'Unauthorized' });
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function requireSiteAccess(req, res, next) {
  try {
    // Admins are always allowed through (e.g. the admin panel loading round/review data)
    const adminToken = req.headers['x-admin-token'] || req.query.token;
    const adminPassword = await getAdminPassword();
    if (adminToken === adminPassword) return next();

    const supplied = req.headers['x-site-password'] || req.query.sitePassword;
    const current = await getSitePassword();
    if (supplied !== current) return res.status(401).json({ error: 'Site locked' });
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

// Lets the lock screen check a password without needing any other data
app.post('/api/site-login', wrap(async (req, res) => {
  const supplied = (req.body && req.body.password) || '';
  const current = await getSitePassword();
  res.json({ ok: supplied === current });
}));

// Coaches tab password check (uses admin password)
app.post('/api/coaches-login', wrap(async (req, res) => {
  const supplied = (req.body && req.body.password) || '';
  const current = await getAdminPassword();
  res.json({ ok: supplied === current });
}));

// Lets the Game Day lock screen check a password without needing any other data
app.post('/api/gameday-login', wrap(async (req, res) => {
  const supplied = (req.body && req.body.password) || '';
  const current = await getGamedayPassword();
  res.json({ ok: supplied === current });
}));

// small helper so we don't repeat try/catch everywhere
function wrap(fn) {
  return (req, res) => {
    fn(req, res).catch(err => {
      console.error(err);
      res.status(500).json({ error: 'Server error', details: err.message });
    });
  };
}

// ── PUBLIC API ──────────────────────────────────────────────────────────────

app.get('/api/rounds', requireSiteAccess, wrap(async (req, res) => {
  const data = await load();
  res.json(data.rounds.sort((a, b) => a.round_num - b.round_num));
}));

app.get('/api/rounds/:num', requireSiteAccess, wrap(async (req, res) => {
  const data = await load();
  const round = data.rounds.find(r => r.round_num === parseInt(req.params.num));
  if (!round) return res.status(404).json({ error: 'Not found' });
  res.json(round);
}));

app.get('/api/analysis-settings', requireSiteAccess, wrap(async (req, res) => {
  const visible = await getAnalysisVisible();
  res.json({ visible });
}));

app.get('/api/opposition/:team', requireSiteAccess, wrap(async (req, res) => {
  const players = await getOppositionTeam(req.params.team);
  res.json(players);
}));

app.get('/api/opposition-notes/:team', requireSiteAccess, wrap(async (req, res) => {
  const notes = await getOppositionNotes(req.params.team);
  res.json(notes);
}));

app.post('/api/opposition-notes/:team/:player', requireSiteAccess, wrap(async (req, res) => {
  const author = ((req.body && req.body.author) || '').trim();
  const note = ((req.body && req.body.note) || '').trim();
  if (!note) return res.status(400).json({ error: 'Note text is required' });
  const doc = await addOppositionNote(req.params.team, req.params.player, author || 'Anonymous', note);
  res.json(doc);
}));

app.delete('/api/opposition-notes/:id', requireSiteAccess, wrap(async (req, res) => {
  await deleteOppositionNote(req.params.id);
  res.json({ ok: true });
}));

app.get('/api/round-notes/:num', requireSiteAccess, wrap(async (req, res) => {
  const notes = await getRoundNotes(parseInt(req.params.num));
  res.json(notes);
}));

app.post('/api/round-notes/:num', requireSiteAccess, wrap(async (req, res) => {
  const author = ((req.body && req.body.author) || '').trim();
  const note = ((req.body && req.body.note) || '').trim();
  if (!note) return res.status(400).json({ error: 'Note text is required' });
  const doc = await addRoundNote(parseInt(req.params.num), author || 'Anonymous', note);
  res.json(doc);
}));

app.delete('/api/round-notes/:id', requireSiteAccess, wrap(async (req, res) => {
  await deleteRoundNote(req.params.id);
  res.json({ ok: true });
}));

// ── LIVE GAME DAY API ────────────────────────────────────────────────────────

let liveGameDay = [
  {i50:'',score:'',tackles:'',marks:'',oppoR50:''},
  {i50:'',score:'',tackles:'',marks:'',oppoR50:''},
  {i50:'',score:'',tackles:'',marks:'',oppoR50:''},
  {i50:'',score:'',tackles:'',marks:'',oppoR50:''},
];

app.get('/api/gameday', requireSiteAccess, (req, res) => {
  res.json(liveGameDay);
});

app.post('/api/gameday', requireSiteAccess, (req, res) => {
  liveGameDay = req.body;
  res.json({ ok: true });
});

app.post('/api/gameday/reset', requireSiteAccess, (req, res) => {
  liveGameDay = [
    {i50:'',score:'',tackles:'',marks:'',oppoR50:''},
    {i50:'',score:'',tackles:'',marks:'',oppoR50:''},
    {i50:'',score:'',tackles:'',marks:'',oppoR50:''},
    {i50:'',score:'',tackles:'',marks:'',oppoR50:''},
  ];
  res.json({ ok: true });
});

// ── ADMIN API ───────────────────────────────────────────────────────────────

app.post('/api/admin/rounds', requireAdmin, wrap(async (req, res) => {
  const data = await load();
  const d = req.body;
  const idx = data.rounds.findIndex(r => r.round_num === d.round_num);
  const round = {
    round_num: d.round_num,
    short: d.short || 'Rd ' + d.round_num,
    label: d.label || 'Rd ' + d.round_num,
    opponent: d.opponent || '',
    wl: d.wl,
    force_q1: d.force_q1 || null,
    force_q2: d.force_q2 || null,
    force_q3: d.force_q3 || null,
    force_q4: d.force_q4 || null,
    force_avg: d.force_avg,
    i50: d.i50 || null,
    pct_scores_i50: d.pct_scores_i50 || null,
    pct_accuracy: d.pct_accuracy || null,
    pct_tackles_i50: d.pct_tackles_i50 || null,
    pct_marks_i50: d.pct_marks_i50 || null,
    pct_oppo_r50: d.pct_oppo_r50 || null,
    i50_q1: d.i50_q1 ?? null, i50_q2: d.i50_q2 ?? null, i50_q3: d.i50_q3 ?? null, i50_q4: d.i50_q4 ?? null,
    pct_scores_i50_q1: d.pct_scores_i50_q1 ?? null, pct_scores_i50_q2: d.pct_scores_i50_q2 ?? null, pct_scores_i50_q3: d.pct_scores_i50_q3 ?? null, pct_scores_i50_q4: d.pct_scores_i50_q4 ?? null,
    pct_accuracy_q1: d.pct_accuracy_q1 ?? null, pct_accuracy_q2: d.pct_accuracy_q2 ?? null, pct_accuracy_q3: d.pct_accuracy_q3 ?? null, pct_accuracy_q4: d.pct_accuracy_q4 ?? null,
    pct_tackles_i50_q1: d.pct_tackles_i50_q1 ?? null, pct_tackles_i50_q2: d.pct_tackles_i50_q2 ?? null, pct_tackles_i50_q3: d.pct_tackles_i50_q3 ?? null, pct_tackles_i50_q4: d.pct_tackles_i50_q4 ?? null,
    pct_marks_i50_q1: d.pct_marks_i50_q1 ?? null, pct_marks_i50_q2: d.pct_marks_i50_q2 ?? null, pct_marks_i50_q3: d.pct_marks_i50_q3 ?? null, pct_marks_i50_q4: d.pct_marks_i50_q4 ?? null,
    pct_oppo_r50_q1: d.pct_oppo_r50_q1 ?? null, pct_oppo_r50_q2: d.pct_oppo_r50_q2 ?? null, pct_oppo_r50_q3: d.pct_oppo_r50_q3 ?? null, pct_oppo_r50_q4: d.pct_oppo_r50_q4 ?? null,
    score_sources: d.score_sources || [],
    intercept_fwds: d.intercept_fwds || null,
    intercept_backs: d.intercept_backs || null,
    intercept_mids: d.intercept_mids || null,
    learned: d.learned || '',
    work_on: d.work_on || '',
  };
  if (idx >= 0) data.rounds[idx] = round;
  else data.rounds.push(round);
  await save(data);
  res.json({ ok: true });
}));

app.patch('/api/admin/rounds/:num', requireAdmin, wrap(async (req, res) => {
  const data = await load();
  const round = data.rounds.find(r => r.round_num === parseInt(req.params.num));
  if (!round) return res.status(404).json({ error: 'Round not found' });
  Object.assign(round, req.body);
  await save(data);
  res.json({ ok: true });
}));

app.delete('/api/admin/rounds/:num', requireAdmin, wrap(async (req, res) => {
  const data = await load();
  data.rounds = data.rounds.filter(r => r.round_num !== parseInt(req.params.num));
  await save(data);
  res.json({ ok: true });
}));

app.get('/api/admin/site-password', requireAdmin, wrap(async (req, res) => {
  const password = await getSitePassword();
  res.json({ password });
}));

app.post('/api/admin/site-password', requireAdmin, wrap(async (req, res) => {
  const newPassword = (req.body && req.body.password || '').trim();
  if (!newPassword) return res.status(400).json({ error: 'Password cannot be empty' });
  await setSitePassword(newPassword);
  res.json({ ok: true });
}));

app.get('/api/admin/gameday-password', requireAdmin, wrap(async (req, res) => {
  const password = await getGamedayPassword();
  res.json({ password });
}));

app.post('/api/admin/gameday-password', requireAdmin, wrap(async (req, res) => {
  const newPassword = (req.body && req.body.password || '').trim();
  if (!newPassword) return res.status(400).json({ error: 'Password cannot be empty' });
  await setGamedayPassword(newPassword);
  res.json({ ok: true });
}));

app.get('/api/admin/admin-password', requireAdmin, wrap(async (req, res) => {
  const password = await getAdminPassword();
  res.json({ password });
}));

app.post('/api/admin/admin-password', requireAdmin, wrap(async (req, res) => {
  const newPassword = (req.body && req.body.password || '').trim();
  if (!newPassword) return res.status(400).json({ error: 'Password cannot be empty' });
  await setAdminPassword(newPassword);
  res.json({ ok: true });
}));

app.get('/api/admin/analysis-settings', requireAdmin, wrap(async (req, res) => {
  const visible = await getAnalysisVisible();
  res.json({ visible });
}));

app.post('/api/admin/analysis-settings', requireAdmin, wrap(async (req, res) => {
  const visible = (req.body && req.body.visible) || [];
  await setAnalysisVisible(visible);
  res.json({ ok: true });
}));

app.get('/api/admin/opposition', requireAdmin, wrap(async (req, res) => {
  const all = await getAllOpposition();
  res.json(all);
}));

app.get('/api/admin/opposition/:team', requireAdmin, wrap(async (req, res) => {
  const players = await getOppositionTeam(req.params.team);
  res.json(players);
}));

app.post('/api/admin/opposition/:team', requireAdmin, wrap(async (req, res) => {
  const players = (req.body && req.body.players) || [];
  await setOppositionTeam(req.params.team, players);
  res.json({ ok: true });
}));

// ── LEAGUE ANALYSIS API ──────────────────────────────────────────────────────

app.get('/api/league/data', requireSiteAccess, wrap(async (req, res) => {
  const data = await getLeagueData();
  res.json(data || {});
}));

app.post('/api/admin/league-upload', requireAdmin, upload.single('file'), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const data = parseLeagueExcel(req.file.buffer);
  await setLeagueData(data);
  res.json({ ok: true, teams: Object.keys(data.teams) });
}));

function parseLeagueRoundFile(buffer, roundNum) {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  function sheet(name) { return XLSX.utils.sheet_to_json(wb.Sheets[name] || {}, { defval: null }); }
  const overall = sheet('OVERALL_RATING').filter(r => WAFL_TEAMS.includes(r['Team']));
  const bm = sheet('BM_CALC'); const td = sheet('TD_CALC'); const con = sheet('CON_CALC');
  const scor = sheet('SCOR_CALC'); const stop = sheet('STOP_CALC');
  const bmRaw = sheet('BM_RAW_DATA'); const tdRaw = sheet('TD_RAW_DATA');
  const conRaw = sheet('CON_RAW_DATA'); const scorRaw = sheet('SCOR_RAW_DATA');
  const stopRaw = sheet('STOP_DATA');
  const teams = {};
  for (const r of overall) {
    teams[r['Team']] = {
      overall_rating: r['Overall Rating (Rounded)'], overall_avg: r['Overall Avg (1–5)'],
      bm_rating: r['Ball Movement Rating'], td_rating: r['Team Defence Rating'],
      con_rating: r['Contest Rating'], scor_rating: r['Scoring Rating'], stop_rating: r['Stoppage Rating'],
    };
  }
  for (const r of bm) { if (teams[r['Team']]) teams[r['Team']].bm_profile = r['BM_Profile']; }
  for (const r of td) { if (teams[r['Team']]) teams[r['Team']].td_profile = r['TD_Profile']; }
  for (const r of con) { const n=r['TEAM']||r['Team']; if (teams[n]) teams[n].con_profile=r['PROFILE']||r['CON_Profile']; }
  for (const r of scor) { if (teams[r['Team']]) teams[r['Team']].scor_profile = r['SCOR_Profile']; }
  for (const r of stop) { if (teams[r['Team']]) teams[r['Team']].stop_profile = r['STOP_Profile']; }
  for (const r of bmRaw) {
    if (!teams[r['Team']]) continue;
    const k=r['Kick']||0, hb=r['Handball']||0;
    teams[r['Team']].bm_stats = { disposal_eff:r['Disposal Eff %'], kicking_eff:r['Kicking Eff %'], kick_pct:k+hb>0?Math.round(k/(k+hb)*100):null, unc_marks:r['Uncontested Mark'], turnovers:r['Turnover'] };
  }
  for (const r of tdRaw) {
    if (!teams[r['Team']]) continue;
    teams[r['Team']].td_stats = { intercept_marks:r['intercept Mark'], intercept_poss:r['Intercept Possession'], rebound_rate:r['Rebound 50 Rate %']!=null?Math.round(r['Rebound 50 Rate %']*10)/10:null, i50_against:r['Inside 50 Against'], pts_per_i50_against:r['Pts Agst p In50 Agst']!=null?Math.round(r['Pts Agst p In50 Agst']*100)/100:null };
  }
  for (const r of conRaw) {
    if (!teams[r['Team']]) continue;
    teams[r['Team']].con_stats = { hard_ball_gets:r['Hard Ball Get'], gbg_pre:r['Ground Ball Get Pre-Clearance'], contested_poss:r['Contested Possession'], tackles_pre:r['Tackles Pre Clearance'], fk_against:r['Free Kick Against'] };
  }
  for (const r of scorRaw) {
    if (!teams[r['Team']]) continue;
    teams[r['Team']].scor_stats = { accuracy:r['Scoring Accuracy %'], pts_per_i50:r['Points per Inside 50']!=null?Math.round(r['Points per Inside 50']*100)/100:null, f50_marks_per_i50:r['F50 Marks per Inside 50']!=null?Math.round(r['F50 Marks per Inside 50']*1000)/1000:null, stop_scoring:r['Stoppage Scoring Points '], to_scoring:r['Turnover Scoring Points '] };
  }
  for (const r of stopRaw) {
    if (!teams[r['Team']]) continue;
    teams[r['Team']].stop_stats = { hitout_adv:r['Hitout to Advantage'], fp_per_stop:r['First Possession per Stoppage']!=null?Math.round(r['First Possession per Stoppage']*100)/100:null, clear_per_stop:r['Clearance per Stoppage']!=null?Math.round(r['Clearance per Stoppage']*100)/100:null, stop_scoring:r['Stoppage Scoring Points '], stop_against:r['Stoppage Scoring Points Against'] };
  }

  // raw_all and raw_all_against come exclusively from RAW DATA sheet (correct counts)
  // W/L + AGAINST stats from RAW DATA ALL ZONES section
  const SKIP_RAW = new Set(['#','Club','Mt']);
  const rawRows = sheet('RAW DATA');
  let forPts={}, againstPts={}, section='FOR', doneFor=new Set(), doneAgainst=new Set();
  for (const r of rawRows) {
    const header = r['#'];
    if (typeof header === 'string') {
      if (header.includes('AGAINST')) section = 'AGAINST';
      else if (header.includes('FOR')) section = 'FOR';
      continue;
    }
    const club = r['Club'] || r['Team'] || r['TEAM'];
    if (!club || !WAFL_TEAMS.includes(club)) continue;
    const pts = r['Points'] ?? r['Score'] ?? r['SCORE'];
    if (section === 'FOR' && !doneFor.has(club)) {
      if (pts != null) forPts[club] = pts;
      // Store FOR raw stats (same as raw_all but sourced from RAW DATA)
      if (teams[club]) {
        teams[club].raw_all = {};
        for (const [k, v] of Object.entries(r)) {
          if (SKIP_RAW.has(k) || v == null || typeof v !== 'number') continue;
          teams[club].raw_all[k.trim()] = v;
        }
      }
      doneFor.add(club);
    } else if (section === 'AGAINST' && !doneAgainst.has(club)) {
      if (pts != null) againstPts[club] = pts;
      // Store AGAINST raw stats, normalising keys to match raw_all
      if (teams[club]) {
        const forKeys = teams[club].raw_all ? Object.keys(teams[club].raw_all) : [];
        teams[club].raw_all_against = {};
        for (const [k, v] of Object.entries(r)) {
          if (SKIP_RAW.has(k) || v == null || typeof v !== 'number') continue;
          const trimmed = k.trim();
          // Match to existing raw_all key if it differs only by trailing 's'
          const matched = forKeys.find(fk => fk === trimmed) ||
                          forKeys.find(fk => fk === trimmed + 's') ||
                          forKeys.find(fk => trimmed === fk + 's') ||
                          trimmed;
          teams[club].raw_all_against[matched] = v;
        }
      }
      doneAgainst.add(club);
    }
  }
  for (const name of WAFL_TEAMS) {
    if (teams[name]) teams[name].won = (forPts[name]!=null&&againstPts[name]!=null) ? forPts[name]>againstPts[name] : null;
  }
  return { roundNum, teams };
}

app.post('/api/admin/debug-wl', requireAdmin, upload.single('file'), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
  const sheetNames = wb.SheetNames;
  const rawSheet = wb.Sheets['RAW DATA'];
  const rawRows = rawSheet ? XLSX.utils.sheet_to_json(rawSheet, { defval: null, header: 1 }) : [];
  // Return first 30 rows raw so we can see the structure
  res.json({ sheetNames, rawRows: rawRows.slice(0, 30) });
}));

app.get('/api/league/rounds-data', requireSiteAccess, wrap(async (req, res) => {
  const data = await getLeagueRoundsData();
  res.json(data || {});
}));

app.post('/api/admin/league-rounds-upload', requireAdmin, upload.array('roundFiles', 20), wrap(async (req, res) => {
  if (!req.files || !req.files.length) return res.status(400).json({ error: 'No files uploaded' });
  const existing = await getLeagueRoundsData() || { rounds: {} };
  const results = [];
  for (const file of req.files) {
    const match = file.originalname.match(/R(\d+)/i);
    if (!match) { results.push({ file: file.originalname, error: 'Could not detect round number from filename' }); continue; }
    const roundNum = parseInt(match[1]);
    try {
      const roundData = parseLeagueRoundFile(file.buffer, roundNum);
      existing.rounds[roundNum] = roundData;
      results.push({ file: file.originalname, round: roundNum, ok: true });
    } catch(e) {
      results.push({ file: file.originalname, error: e.message });
    }
  }
  await setLeagueRoundsData(existing);
  res.json({ ok: true, results, rounds: Object.keys(existing.rounds).sort((a,b)=>a-b) });
}));

app.listen(PORT, () => console.log(`EP Forwards Hub running on http://localhost:${PORT}`));
