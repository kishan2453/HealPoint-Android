const fs = require('fs');
const path = require('path');
const mongoose = require(path.resolve('./HealPointBackend/node_modules/mongoose'));

const PROFESSIONAL_HOSPITAL_MAP = {
  "HealPoint Demo Hospital 01 (Central)": {
    name: "Anand City Hospital (Central Campus)",
    address: "101 Healthcare Boulevard, Navrangpura, Ahmedabad",
    phone: "+91 00000 11001",
    email: "contact@anandcityhospital.example.com",
    emergencyPhone: "+91 00000 99999",
  },
  "HealPoint Demo Hospital 02 (North Campus)": {
    name: "Silverline Multi-Specialty Hospital",
    address: "202 Medical Enclave, Ring Road, Ahmedabad",
    phone: "+91 00000 11002",
    email: "contact@silverlinehospital.example.com",
    emergencyPhone: "+91 00000 99999",
  },
  "HealPoint Demo Hospital 03 (East Care)": {
    name: "Apex Memorial Healthcare Institute",
    address: "303 Wellness Avenue, Maninagar, Ahmedabad",
    phone: "+91 00000 11003",
    email: "contact@apexmemorial.example.com",
    emergencyPhone: "+91 00000 99999",
  },
  "HealPoint Demo Hospital 04 (South Pavilion)": {
    name: "Sunshine Care Hospital",
    address: "404 Vitality Park, Satellite Road, Ahmedabad",
    phone: "+91 00000 11004",
    email: "contact@sunshinecare.example.com",
    emergencyPhone: "+91 00000 99999",
  },
  "HealPoint Demo Hospital 05 (West Wing)": {
    name: "Sterling Heights Medical Center",
    address: "505 Discovery Drive, Bodakdev, Ahmedabad",
    phone: "+91 00000 11005",
    email: "contact@sterlingheights.example.com",
    emergencyPhone: "+91 00000 99999",
  },
  "HealPoint Demo Hospital 06 (Metro Clinical)": {
    name: "Metro Life Health Institute",
    address: "606 City Center Expressway, Ashram Road, Ahmedabad",
    phone: "+91 00000 11006",
    email: "contact@metrolifehealth.example.com",
    emergencyPhone: "+91 00000 99999",
  },
  "HealPoint Demo Hospital 07 (Care Institute)": {
    name: "Unity Care Specialty Hospital",
    address: "707 Care Horizon Avenue, SG Highway, Ahmedabad",
    phone: "+91 00000 11007",
    email: "contact@unitycarespecialty.example.com",
    emergencyPhone: "+91 00000 99999",
  },
};

async function run() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/doctorapp';
  console.log('Connecting to:', mongoUri);
  await mongoose.connect(mongoUri);
  const db = mongoose.connection.db;

  // 1. Backup
  const backupDir = path.join(__dirname, '..', 'backups', 'backup-part16');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const collectionsToBackup = ['hospitals', 'doctors', 'appointments', 'users'];
  for (const collName of collectionsToBackup) {
    const docs = await db.collection(collName).find({}).toArray();
    fs.writeFileSync(path.join(backupDir, `${collName}.json`), JSON.stringify(docs, null, 2), 'utf8');
    console.log(`Backed up ${docs.length} docs from ${collName}`);
  }

  // 2. Update Hospitals
  let updatedHospitals = 0;
  for (const [oldName, info] of Object.entries(PROFESSIONAL_HOSPITAL_MAP)) {
    const res = await db.collection('hospitals').updateOne(
      { name: oldName },
      {
        $set: {
          name: info.name,
          address: info.address,
          phone: info.phone,
          email: info.email,
          emergencyPhone: info.emergencyPhone,
          updatedAt: new Date(),
        }
      }
    );
    if (res.matchedCount > 0) {
      updatedHospitals++;
      console.log(`Updated hospital "${oldName}" -> "${info.name}"`);

      // Update matching doctors
      const docRes = await db.collection('doctors').updateMany(
        { hospitalName: oldName },
        { $set: { hospitalName: info.name, updatedAt: new Date() } }
      );
      console.log(`  Updated ${docRes.modifiedCount} doctors for ${info.name}`);

      // Update matching appointments
      const apptRes = await db.collection('appointments').updateMany(
        { hospitalName: oldName },
        { $set: { hospitalName: info.name, updatedAt: new Date() } }
      );
      console.log(`  Updated ${apptRes.modifiedCount} appointments for ${info.name}`);

      // Update matching users (Hospital Admins)
      const userRes = await db.collection('users').updateMany(
        { hospitalName: oldName },
        { $set: { hospitalName: info.name, updatedAt: new Date() } }
      );
      console.log(`  Updated ${userRes.modifiedCount} users for ${info.name}`);
    }
  }

  console.log(`\nMigration completed! Updated ${updatedHospitals} hospitals.`);
  await mongoose.disconnect();
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
