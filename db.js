const { MongoClient, ObjectId } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.MONGO_DB_NAME || 'ep_forwards_hub';

let client;
let db;

async function connect() {
  if (db) return db;
  if (!MONGO_URI) throw new Error('MONGO_URI environment variable is not set');
  client = new MongoClient(MONGO_URI);
  await client.connect();
  db = client.db(DB_NAME);
  return db;
}

// ── ROUNDS ───────────────────────────────────────────────────────────────────

async function load(season) {
  const database = await connect();
  const query = season ? { season } : {};
  const rounds = await database.collection('rounds').find(query, { projection: { _id: 0 } }).toArray();
  return { rounds };
}

async function save(data, season) {
  if (!season) throw new Error('season required for save');
  const database = await connect();
  await database.collection('rounds').deleteMany({ season });
  if (data.rounds && data.rounds.length) {
    await database.collection('rounds').insertMany(data.rounds.map(r => ({ ...r, season })));
  }
}

// ── PASSWORDS ────────────────────────────────────────────────────────────────

const DEFAULT_SITE_PASSWORD = process.env.SITE_PASSWORD || 'forwards2026';

async function getSitePassword() {
  const database = await connect();
  const doc = await database.collection('settings').findOne({ _id: 'site' });
  if (doc && doc.password) return doc.password;
  await database.collection('settings').updateOne(
    { _id: 'site' },
    { $set: { password: DEFAULT_SITE_PASSWORD } },
    { upsert: true }
  );
  return DEFAULT_SITE_PASSWORD;
}

async function setSitePassword(newPassword) {
  const database = await connect();
  await database.collection('settings').updateOne(
    { _id: 'site' },
    { $set: { password: newPassword } },
    { upsert: true }
  );
}

const DEFAULT_GAMEDAY_PASSWORD = process.env.GAMEDAY_PASSWORD || 'gameday';

async function getGamedayPassword() {
  const database = await connect();
  const doc = await database.collection('settings').findOne({ _id: 'gameday' });
  if (doc && doc.password) return doc.password;
  await database.collection('settings').updateOne(
    { _id: 'gameday' },
    { $set: { password: DEFAULT_GAMEDAY_PASSWORD } },
    { upsert: true }
  );
  return DEFAULT_GAMEDAY_PASSWORD;
}

async function setGamedayPassword(newPassword) {
  const database = await connect();
  await database.collection('settings').updateOne(
    { _id: 'gameday' },
    { $set: { password: newPassword } },
    { upsert: true }
  );
}

const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'eastperth2026';

async function getAdminPassword() {
  const database = await connect();
  const doc = await database.collection('settings').findOne({ _id: 'admin' });
  if (doc && doc.password) return doc.password;
  await database.collection('settings').updateOne(
    { _id: 'admin' },
    { $set: { password: DEFAULT_ADMIN_PASSWORD } },
    { upsert: true }
  );
  return DEFAULT_ADMIN_PASSWORD;
}

async function setAdminPassword(newPassword) {
  const database = await connect();
  await database.collection('settings').updateOne(
    { _id: 'admin' },
    { $set: { password: newPassword } },
    { upsert: true }
  );
}

// ── ANALYSIS VISIBILITY (season-scoped) ──────────────────────────────────────

const ALL_ANALYSIS_KEYS = [
  'pct_scores_i50','pct_marks_i50','pct_accuracy','pct_tackles_i50',
  'pct_oppo_r50','i50','force_avg','intercept_fwds','intercept_backs','intercept_mids'
];

async function getAnalysisVisible(season) {
  const database = await connect();
  const id = season ? `analysisVisibility_${season}` : 'analysisVisibility';
  const doc = await database.collection('settings').findOne({ _id: id });
  if (doc && Array.isArray(doc.visible)) return doc.visible;
  await database.collection('settings').updateOne(
    { _id: id },
    { $set: { visible: ALL_ANALYSIS_KEYS } },
    { upsert: true }
  );
  return ALL_ANALYSIS_KEYS;
}

async function setAnalysisVisible(keys, season) {
  const database = await connect();
  const id = season ? `analysisVisibility_${season}` : 'analysisVisibility';
  await database.collection('settings').updateOne(
    { _id: id },
    { $set: { visible: Array.isArray(keys) ? keys : [] } },
    { upsert: true }
  );
}

// ── OPPOSITION SCOUTING ──────────────────────────────────────────────────────

async function getOppositionTeam(team, season) {
  const database = await connect();
  const query = { team };
  if (season) query.season = season;
  return database.collection('opposition')
    .find(query, { projection: { _id: 0 } })
    .toArray();
}

async function getAllOpposition(season) {
  const database = await connect();
  const query = season ? { season } : {};
  return database.collection('opposition')
    .find(query, { projection: { _id: 0 } })
    .toArray();
}

async function setOppositionTeam(team, players, season) {
  if (!season) throw new Error('season required for setOppositionTeam');
  const database = await connect();
  await database.collection('opposition').deleteMany({ team, season });
  if (Array.isArray(players) && players.length) {
    await database.collection('opposition').insertMany(players.map(p => ({ ...p, team, season })));
  }
}

// ── OPPOSITION PLAYER NOTES ──────────────────────────────────────────────────

async function getOppositionNotes(team, season) {
  const database = await connect();
  const query = { team };
  if (season) query.season = season;
  const notes = await database.collection('opposition_notes')
    .find(query)
    .sort({ created_at: 1 })
    .toArray();
  return notes.map(n => ({ _id: n._id.toString(), player: n.player, author: n.author, note: n.note, created_at: n.created_at }));
}

async function addOppositionNote(team, player, author, note, season) {
  const database = await connect();
  const doc = { team, player, author, note, created_at: new Date() };
  if (season) doc.season = season;
  const result = await database.collection('opposition_notes').insertOne(doc);
  return { _id: result.insertedId.toString(), team, player, author, note, created_at: doc.created_at };
}

async function deleteOppositionNote(id) {
  const database = await connect();
  await database.collection('opposition_notes').deleteOne({ _id: new ObjectId(id) });
}

// ── ROUND NOTES ───────────────────────────────────────────────────────────────

async function getRoundNotes(roundNum, season) {
  const database = await connect();
  const query = { round_num: roundNum };
  if (season) query.season = season;
  const notes = await database.collection('round_notes')
    .find(query)
    .sort({ created_at: 1 })
    .toArray();
  return notes.map(n => ({ _id: n._id.toString(), round_num: n.round_num, author: n.author, note: n.note, created_at: n.created_at }));
}

async function addRoundNote(roundNum, author, note, season) {
  const database = await connect();
  const doc = { round_num: roundNum, author, note, created_at: new Date() };
  if (season) doc.season = season;
  const result = await database.collection('round_notes').insertOne(doc);
  return { _id: result.insertedId.toString(), round_num: roundNum, author, note, created_at: doc.created_at };
}

async function deleteRoundNote(id) {
  const database = await connect();
  await database.collection('round_notes').deleteOne({ _id: new ObjectId(id) });
}

// ── LEAGUE ANALYSIS DATA ─────────────────────────────────────────────────────

async function getLeagueData() {
  const database = await connect();
  const doc = await database.collection('league').findOne({ _id: 'data' });
  return doc ? doc.data : null;
}

async function setLeagueData(data) {
  const database = await connect();
  await database.collection('league').updateOne(
    { _id: 'data' },
    { $set: { data, updated_at: new Date() } },
    { upsert: true }
  );
}

async function getLeagueRoundsData() {
  const database = await connect();
  const doc = await database.collection('league').findOne({ _id: 'rounds' });
  return doc ? doc.data : null;
}

async function setLeagueRoundsData(data) {
  const database = await connect();
  await database.collection('league').updateOne(
    { _id: 'rounds' },
    { $set: { data, updated_at: new Date() } },
    { upsert: true }
  );
}

module.exports = {
  load, save,
  getSitePassword, setSitePassword,
  getGamedayPassword, setGamedayPassword,
  getAdminPassword, setAdminPassword,
  getAnalysisVisible, setAnalysisVisible, ALL_ANALYSIS_KEYS,
  getOppositionTeam, getAllOpposition, setOppositionTeam,
  getOppositionNotes, addOppositionNote, deleteOppositionNote,
  getRoundNotes, addRoundNote, deleteRoundNote,
  getLeagueData, setLeagueData,
  getLeagueRoundsData, setLeagueRoundsData,
};
