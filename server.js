const express = require('express');
const path = require('path');
const { load, save, getSitePassword, setSitePassword, getAnalysisVisible, setAnalysisVisible, getOppositionTeam, getAllOpposition, setOppositionTeam } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'eastperth2026';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function requireAdmin(req, res, next) {
  const token = req.headers['x-admin-token'] || req.query.token;
  if (token !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

async function requireSiteAccess(req, res, next) {
  try {
    // Admins are always allowed through (e.g. the admin panel loading round/review data)
    const adminToken = req.headers['x-admin-token'] || req.query.token;
    if (adminToken === ADMIN_PASSWORD) return next();

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

app.get('/api/players', requireSiteAccess, wrap(async (req, res) => {
  const data = await load();
  const grouped = {};
  const sorted = [...data.reviews].sort((a, b) => a.round_num - b.round_num);
  for (const r of sorted) {
    if (!grouped[r.player_name]) grouped[r.player_name] = { rounds: [] };
    grouped[r.player_name].rounds.push({
      rd: r.round_label,
      rating: r.rating,
      comment: r.comment
    });
  }
  // sort players alphabetically
  const out = {};
  Object.keys(grouped).sort().forEach(k => out[k] = grouped[k]);
  res.json(out);
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

app.delete('/api/admin/rounds/:num', requireAdmin, wrap(async (req, res) => {
  const data = await load();
  data.rounds = data.rounds.filter(r => r.round_num !== parseInt(req.params.num));
  await save(data);
  res.json({ ok: true });
}));

app.post('/api/admin/reviews', requireAdmin, wrap(async (req, res) => {
  const data = await load();
  const d = req.body;
  const idx = data.reviews.findIndex(r => r.player_name === d.player_name && r.round_num === d.round_num);
  const review = {
    player_name: d.player_name,
    round_num: d.round_num,
    round_label: d.round_label,
    rating: d.rating,
    comment: d.comment,
  };
  if (idx >= 0) data.reviews[idx] = review;
  else data.reviews.push(review);
  await save(data);
  res.json({ ok: true });
}));

app.delete('/api/admin/reviews/:player/:round', requireAdmin, wrap(async (req, res) => {
  const data = await load();
  const player = decodeURIComponent(req.params.player);
  const round = parseInt(req.params.round);
  data.reviews = data.reviews.filter(r => !(r.player_name === player && r.round_num === round));
  await save(data);
  res.json({ ok: true });
}));

app.get('/api/admin/players-list', requireAdmin, wrap(async (req, res) => {
  const data = await load();
  const names = [...new Set(data.reviews.map(r => r.player_name))].sort();
  res.json(names);
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

app.listen(PORT, () => console.log(`EP Forwards Hub running on http://localhost:${PORT}`));
