const fs = require('fs');
const path = require('path');
const mongoose = require(path.resolve('./HealPointBackend/node_modules/mongoose'));

async function backupDatabase() {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/doctorapp';
  console.log('[Backup] Connecting to MongoDB...');
  await mongoose.connect(uri);

  const backupDir = path.resolve('./backups/pre-part-15-standalone-backup');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const collections = ['hospitals', 'doctors', 'users', 'appointments', 'emergencyrequests', 'supporttickets', 'reviews', 'subscriptions'];
  const manifest = {
    timestamp: new Date().toISOString(),
    sourceDatabase: mongoose.connection.name,
    collections: {},
  };

  for (const colName of collections) {
    try {
      const docs = await mongoose.connection.collection(colName).find({}).toArray();
      const filePath = path.join(backupDir, `${colName}.json`);
      fs.writeFileSync(filePath, JSON.stringify(docs, null, 2), 'utf8');
      manifest.collections[colName] = {
        count: docs.length,
        file: `${colName}.json`,
        sizeBytes: fs.statSync(filePath).size,
      };
      console.log(`[Backup] Backed up ${docs.length} documents from "${colName}" to ${filePath}`);
    } catch (e) {
      console.warn(`[Backup] Warning for collection ${colName}:`, e.message);
    }
  }

  const manifestPath = path.join(backupDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`[Backup] Backup complete! Manifest written to ${manifestPath}`);

  await mongoose.disconnect();
}

backupDatabase().catch(console.error);
