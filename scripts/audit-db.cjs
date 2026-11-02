const path = require('path');
const mongoose = require(path.resolve('./HealPointBackend/node_modules/mongoose'));

async function auditDB() {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/doctorapp';
  await mongoose.connect(uri);
  console.log('Connected to DB:', mongoose.connection.name);

  const collections = ['hospitals', 'doctors', 'users', 'appointments', 'emergencyrequests', 'supporttickets'];
  for (const col of collections) {
    try {
      const count = await mongoose.connection.collection(col).countDocuments();
      console.log(`Collection ${col}: ${count} records`);
    } catch (e) {
      console.log(`Collection ${col}: error (${e.message})`);
    }
  }

  const hospitals = await mongoose.connection.collection('hospitals').find({}, { projection: { name: 1, phone: 1, email: 1, isDemo: 1 } }).toArray();
  console.log('\n--- Hospitals in DB ---');
  hospitals.forEach(h => console.log(`- ${h.name} | Phone: ${h.phone} | Email: ${h.email} | isDemo: ${h.isDemo}`));

  const doctors = await mongoose.connection.collection('doctors').find({}, { projection: { name: 1, email: 1, phone: 1, hospitalName: 1, isDemo: 1 } }).limit(10).toArray();
  console.log(`\n--- Sample Doctors (${doctors.length}) ---`);
  doctors.forEach(d => console.log(`- ${d.name} | Hospital: ${d.hospitalName} | Phone: ${d.phone} | Email: ${d.email} | isDemo: ${d.isDemo}`));

  const emergencies = await mongoose.connection.collection('emergencyrequests').find({}).limit(5).toArray();
  console.log(`\n--- Emergencies (${emergencies.length} sample) ---`);
  emergencies.forEach(e => console.log(`- Code: ${e.emergencyCode} | Status: ${e.status} | isDemo: ${e.isDemo}`));

  await mongoose.disconnect();
}

auditDB().catch(console.error);
