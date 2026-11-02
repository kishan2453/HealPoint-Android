const path = require('path');
const mongoose = require(path.resolve('./HealPointBackend/node_modules/mongoose'));

const HOSPITAL_MAP = {
  "City Care Hospital": {
    name: "HealPoint Demo Hospital 01 (Central)",
    address: "101 Innovation Blvd, Demo Tech City, Ahmedabad",
    phone: "+91 00000 11001",
    email: "hospital01@demo.healpoint.example.com",
    emergencyPhone: "+91 00000 99999",
  },
  "Apollo Hospital": {
    name: "HealPoint Demo Hospital 02 (North Campus)",
    address: "202 Academic Ring Road, Demo Health Park, Ahmedabad",
    phone: "+91 00000 11002",
    email: "hospital02@demo.healpoint.example.com",
    emergencyPhone: "+91 00000 99999",
  },
  "Anand Hospital": {
    name: "HealPoint Demo Hospital 03 (East Care)",
    address: "303 Healthcare Avenue, Simulation Zone, Ahmedabad",
    phone: "+91 00000 11003",
    email: "hospital03@demo.healpoint.example.com",
    emergencyPhone: "+91 00000 99999",
  },
  "Sunshine Hospital": {
    name: "HealPoint Demo Hospital 04 (South Pavilion)",
    address: "404 Vitality Way, Medical Demo Center, Ahmedabad",
    phone: "+91 00000 11004",
    email: "hospital04@demo.healpoint.example.com",
    emergencyPhone: "+91 00000 99999",
  },
  "Sterling Hospital": {
    name: "HealPoint Demo Hospital 05 (West Wing)",
    address: "505 Discovery Drive, Demo Wellness Park, Ahmedabad",
    phone: "+91 00000 11005",
    email: "hospital05@demo.healpoint.example.com",
    emergencyPhone: "+91 00000 99999",
  },
  "Metro Hospital": {
    name: "HealPoint Demo Hospital 06 (Metro Clinical)",
    address: "606 Metropolitan Blvd, Educational Complex, Ahmedabad",
    phone: "+91 00000 11006",
    email: "hospital06@demo.healpoint.example.com",
    emergencyPhone: "+91 00000 99999",
  },
  "CarePlus Hospital": {
    name: "HealPoint Demo Hospital 07 (Care Institute)",
    address: "707 University Enclave, Simulation Medical City, Ahmedabad",
    phone: "+91 00000 11007",
    email: "hospital07@demo.healpoint.example.com",
    emergencyPhone: "+91 00000 99999",
  },
};

async function executeMigration() {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/doctorapp';
  console.log('[Migration] Connecting to MongoDB...');
  await mongoose.connect(uri);

  console.log('[Migration] Step 1: Anonymizing hospitals...');
  const hospitals = await mongoose.connection.collection('hospitals').find({}).toArray();
  for (const h of hospitals) {
    const mapping = HOSPITAL_MAP[h.name] || {
      name: `HealPoint Demo Hospital (${h.name})`,
      address: "100 Educational Simulation Avenue, Ahmedabad",
      phone: "+91 00000 11000",
      email: "hospital@demo.healpoint.example.com",
      emergencyPhone: "+91 00000 99999",
    };
    await mongoose.connection.collection('hospitals').updateOne(
      { _id: h._id },
      {
        $set: {
          name: mapping.name,
          address: mapping.address,
          phone: mapping.phone,
          email: mapping.email,
          emergencyPhone: mapping.emergencyPhone,
          website: "https://demo.healpoint.example.com",
          isDemo: true,
          isSimulation: true,
        },
      }
    );
    console.log(`Updated hospital: ${h.name} -> ${mapping.name}`);
  }

  console.log('[Migration] Step 2: Anonymizing doctors...');
  const doctors = await mongoose.connection.collection('doctors').find({}).toArray();
  let docIdx = 1;
  for (const d of doctors) {
    const demoEmail = `doctor${String(docIdx).padStart(3, '0')}@doctor.healpoint.example.com`;
    const demoPhone = `+91 00000 ${String(12000 + docIdx).padStart(5, '0')}`;
    const newHospitalName = HOSPITAL_MAP[d.hospitalName]?.name || d.hospitalName;

    await mongoose.connection.collection('doctors').updateOne(
      { _id: d._id },
      {
        $set: {
          email: demoEmail,
          phone: demoPhone,
          hospitalName: newHospitalName,
          isDemo: true,
          isSimulation: true,
        },
      }
    );
    docIdx++;
  }
  console.log(`Updated ${doctors.length} doctor records to synthetic demo identities.`);

  console.log('[Migration] Step 3: Anonymizing users and appointments...');
  await mongoose.connection.collection('users').updateMany(
    {},
    {
      $set: {
        isDemo: true,
        isSimulation: true,
      },
    }
  );
  await mongoose.connection.collection('appointments').updateMany(
    {},
    {
      $set: {
        isDemo: true,
        isSimulation: true,
      },
    }
  );

  console.log('[Migration] Migration complete! All records marked with isDemo: true');
  await mongoose.disconnect();
}

if (process.argv.includes('--execute')) {
  executeMigration().catch(console.error);
} else {
  console.log('DRY RUN: To execute migration, run: node scripts/migrate-demo-data.cjs --execute');
}
