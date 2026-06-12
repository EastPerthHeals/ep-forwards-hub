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

  // seed if empty (first-ever run)
  const roundsCount = await db.collection('rounds').countDocuments();
  if (roundsCount === 0) {
    await db.collection('rounds').insertMany(SEED.rounds);
  }
  return db;
}

const SEED = {
  rounds: [
    {round_num:1,label:'Rd 1 · Subiaco',short:'Rd 1',opponent:'Subiaco',wl:'L',force_q1:242,force_q2:224,force_q3:229,force_q4:200,force_avg:224,i50:12,pct_scores_i50:52.5,pct_accuracy:71.75,pct_tackles_i50:21,pct_marks_i50:19.25,pct_oppo_r50:47.25,score_sources:[['Free Kick',2],['Front & Centre',2],['CBD (BM)',2],['Surge HBR',2],['Fwd Half Intercept',7],['F50 Stop',1],['Def Half Intercept',1]],intercept_fwds:5,intercept_backs:2,intercept_mids:1,learned:'Subi are proactive and defend front shoulder. Need to get them and play through!',work_on:'F50 stops when 2 opposition wingers are there'},
    {round_num:2,label:'Rd 2 · Swan Districts',short:'Rd 2',opponent:'Swan Districts',wl:'W',force_q1:154,force_q2:181,force_q3:225,force_q4:234,force_avg:199,i50:11,pct_scores_i50:60,pct_accuracy:46,pct_tackles_i50:23,pct_marks_i50:32,pct_oppo_r50:27,score_sources:[['Free Kick',1],['Front & Centre',1],['Ball Movement',5],['Fwd Half Intercept',4],['F50 Stop',2]],intercept_fwds:1,intercept_backs:2,intercept_mids:1,learned:'Swans flips hurt us defensively. Value defence!',work_on:'Wing and half-forward flips. Jonesy forward.'},
    {round_num:3,label:'Rd 3 · East Fremantle',short:'Rd 3',opponent:'East Fremantle',wl:'L',force_q1:171,force_q2:219,force_q3:160,force_q4:156,force_avg:177,i50:11,pct_scores_i50:44,pct_accuracy:52,pct_tackles_i50:32,pct_marks_i50:16,pct_oppo_r50:22,score_sources:[['Free Kick',1],['Front & Centre',1],['CBD (BM)',1],['Fwd Half Intercept',5],['Surge (Mark)',1]],intercept_fwds:3,intercept_backs:1,intercept_mids:1,learned:'Knight flips very effective. Last 10 of Q3 we got brained.',work_on:'Last kick inside 50.'},
    {round_num:4,label:'Rd 4 · Perth',short:'Rd 4',opponent:'Perth',wl:'W',force_q1:204,force_q2:129,force_q3:242,force_q4:254,force_avg:207,i50:8,pct_scores_i50:65,pct_accuracy:35,pct_tackles_i50:27,pct_marks_i50:49,pct_oppo_r50:24,score_sources:[],intercept_fwds:null,intercept_backs:null,intercept_mids:null,learned:'',work_on:''},
    {round_num:5,label:'Rd 5',short:'Rd 5',opponent:'',wl:'W',force_q1:null,force_q2:null,force_q3:null,force_q4:null,force_avg:214,i50:11,pct_scores_i50:61,pct_accuracy:59,pct_tackles_i50:13,pct_marks_i50:37,pct_oppo_r50:34,score_sources:[],intercept_fwds:null,intercept_backs:null,intercept_mids:null,learned:'',work_on:''},
    {round_num:6,label:'Rd 6',short:'Rd 6',opponent:'',wl:'L',force_q1:null,force_q2:null,force_q3:null,force_q4:null,force_avg:187,i50:12,pct_scores_i50:34,pct_accuracy:59,pct_tackles_i50:33,pct_marks_i50:15,pct_oppo_r50:34,score_sources:[],intercept_fwds:null,intercept_backs:null,intercept_mids:null,learned:'',work_on:''},
    {round_num:7,label:'Rd 7',short:'Rd 7',opponent:'',wl:'W',force_q1:null,force_q2:null,force_q3:null,force_q4:null,force_avg:174,i50:13,pct_scores_i50:44,pct_accuracy:45,pct_tackles_i50:24,pct_marks_i50:22,pct_oppo_r50:25,score_sources:[],intercept_fwds:null,intercept_backs:null,intercept_mids:null,learned:'',work_on:''},
    {round_num:8,label:'Rd 8',short:'Rd 8',opponent:'',wl:'L',force_q1:null,force_q2:null,force_q3:null,force_q4:null,force_avg:167,i50:11,pct_scores_i50:37,pct_accuracy:50,pct_tackles_i50:17,pct_marks_i50:30,pct_oppo_r50:22,score_sources:[],intercept_fwds:null,intercept_backs:null,intercept_mids:null,learned:'',work_on:''},
  ]
};

async function load() {
  const database = await connect();
  const rounds = await database.collection('rounds').find({}, { projection: { _id: 0 } }).toArray();
  return { rounds };
}

async function save(data) {
  const database = await connect();
  await database.collection('rounds').deleteMany({});
  if (data.rounds && data.rounds.length) {
    await database.collection('rounds').insertMany(data.rounds.map(r => ({ ...r })));
  }
}

const DEFAULT_SITE_PASSWORD = process.env.SITE_PASSWORD || 'forwards2026';

async function getSitePassword() {
  const database = await connect();
  const doc = await database.collection('settings').findOne({ _id: 'site' });
  if (doc && doc.password) return doc.password;
  // first run — store the default so it's consistent across restarts
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

// All analysis metric keys — used as the default "fully visible" state
const ALL_ANALYSIS_KEYS = [
  'pct_scores_i50','pct_marks_i50','pct_accuracy','pct_tackles_i50',
  'pct_oppo_r50','i50','force_avg','intercept_fwds','intercept_backs','intercept_mids'
];

async function getAnalysisVisible() {
  const database = await connect();
  const doc = await database.collection('settings').findOne({ _id: 'analysisVisibility' });
  if (doc && Array.isArray(doc.visible)) return doc.visible;
  // first run — publish everything by default
  await database.collection('settings').updateOne(
    { _id: 'analysisVisibility' },
    { $set: { visible: ALL_ANALYSIS_KEYS } },
    { upsert: true }
  );
  return ALL_ANALYSIS_KEYS;
}

async function setAnalysisVisible(keys) {
  const database = await connect();
  await database.collection('settings').updateOne(
    { _id: 'analysisVisibility' },
    { $set: { visible: Array.isArray(keys) ? keys : [] } },
    { upsert: true }
  );
}

// ── OPPOSITION SCOUTING ──────────────────────────────────────────────────────

async function getOppositionTeam(team) {
  const database = await connect();
  return database.collection('opposition')
    .find({ team }, { projection: { _id: 0 } })
    .toArray();
}

async function getAllOpposition() {
  const database = await connect();
  return database.collection('opposition')
    .find({}, { projection: { _id: 0 } })
    .toArray();
}

// Replaces the full defender list for one team — matches the weekly "upload latest PDF" workflow
async function setOppositionTeam(team, players) {
  const database = await connect();
  await database.collection('opposition').deleteMany({ team });
  if (Array.isArray(players) && players.length) {
    await database.collection('opposition').insertMany(players.map(p => ({ ...p, team })));
  }
}

// ── OPPOSITION PLAYER NOTES ──────────────────────────────────────────────────

async function getOppositionNotes(team) {
  const database = await connect();
  const notes = await database.collection('opposition_notes')
    .find({ team })
    .sort({ created_at: 1 })
    .toArray();
  return notes.map(n => ({ _id: n._id.toString(), player: n.player, author: n.author, note: n.note, created_at: n.created_at }));
}

async function addOppositionNote(team, player, author, note) {
  const database = await connect();
  const doc = { team, player, author, note, created_at: new Date() };
  const result = await database.collection('opposition_notes').insertOne(doc);
  return { _id: result.insertedId.toString(), team, player, author, note, created_at: doc.created_at };
}

async function deleteOppositionNote(id) {
  const database = await connect();
  await database.collection('opposition_notes').deleteOne({ _id: new ObjectId(id) });
}

// ── ROUND OPPOSITION NOTES ────────────────────────────────────────────────────

async function getRoundNotes(roundNum) {
  const database = await connect();
  const notes = await database.collection('round_notes')
    .find({ round_num: roundNum })
    .sort({ created_at: 1 })
    .toArray();
  return notes.map(n => ({ _id: n._id.toString(), round_num: n.round_num, author: n.author, note: n.note, created_at: n.created_at }));
}

async function addRoundNote(roundNum, author, note) {
  const database = await connect();
  const doc = { round_num: roundNum, author, note, created_at: new Date() };
  const result = await database.collection('round_notes').insertOne(doc);
  return { _id: result.insertedId.toString(), round_num: roundNum, author, note, created_at: doc.created_at };
}

async function deleteRoundNote(id) {
  const database = await connect();
  await database.collection('round_notes').deleteOne({ _id: new ObjectId(id) });
}

module.exports = { load, save, getSitePassword, setSitePassword, getAnalysisVisible, setAnalysisVisible, ALL_ANALYSIS_KEYS, getOppositionTeam, getAllOpposition, setOppositionTeam, getOppositionNotes, addOppositionNote, deleteOppositionNote, getRoundNotes, addRoundNote, deleteRoundNote };
