const fs = require('fs');
const path = require('path');
const mongoose = require(path.resolve('./HealPointBackend/node_modules/mongoose'));

async function restoreDatabase() {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/doctorapp';
  console.log('[Restore] Connecting to MongoDB...');
  await mongoose.connect(uri);

  const backupDir = path.resolve('./backups/pre-part-15-standalone-backup');
  if (!fs.existsSync(backupDir)) {
    throw new Error('Backup directory not found: ' + backupDir);
  }

  const collections = ['hospitals', 'doctors', 'users', 'appointments', 'reviews', 'subscriptions'];
  for (const colName of collections) {
    const filePath = path.join(backupDir, `${colName}.json`);
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (data.length > 0) {
        await mongoose.connection.collection(colName).deleteMany({});
        await mongoose.connection.collection(colName).insertMany(data);
        console.log(`[Restore] Restored ${data.length} documents into "${colName}"`);
      }
    }
  }

  console.log('[Restore] Database restored successfully!');
  await mongoose.disconnect();
}

if (process.argv.includes('--execute')) {
  restoreDatabase().catch(console.error);
} else {
  console.log('To execute restore, run: node scripts/restore-db.cjs --execute');
}
