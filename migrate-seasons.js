// One-time migration: stamp all existing documents with season: 2026
// Run with: MONGO_URI=<uri> node migrate-seasons.js
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.MONGO_DB_NAME || 'ep_forwards_hub';

(async () => {
  if (!MONGO_URI) { console.error('MONGO_URI not set'); process.exit(1); }
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db(DB_NAME);

  const r1 = await db.collection('rounds').updateMany({ season: { $exists: false } }, { $set: { season: 2026 } });
  console.log(`rounds: ${r1.modifiedCount} tagged`);

  const r2 = await db.collection('opposition').updateMany({ season: { $exists: false } }, { $set: { season: 2026 } });
  console.log(`opposition: ${r2.modifiedCount} tagged`);

  const r3 = await db.collection('opposition_notes').updateMany({ season: { $exists: false } }, { $set: { season: 2026 } });
  console.log(`opposition_notes: ${r3.modifiedCount} tagged`);

  const r4 = await db.collection('round_notes').updateMany({ season: { $exists: false } }, { $set: { season: 2026 } });
  console.log(`round_notes: ${r4.modifiedCount} tagged`);

  // Tag analysisVisibility settings doc
  await db.collection('settings').updateOne(
    { _id: 'analysisVisibility' },
    { $set: { _id: 'analysisVisibility_2026' } }
  ).catch(() => null);
  // Safer: insert a copy keyed to 2026
  const vis = await db.collection('settings').findOne({ _id: 'analysisVisibility' });
  if (vis) {
    await db.collection('settings').updateOne(
      { _id: 'analysisVisibility_2026' },
      { $set: { visible: vis.visible } },
      { upsert: true }
    );
    console.log('analysisVisibility copied to analysisVisibility_2026');
  }

  await client.close();
  console.log('Migration complete.');
})();
