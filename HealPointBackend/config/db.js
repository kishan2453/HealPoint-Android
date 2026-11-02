import mongoose from "mongoose";
import "colors";

let cachedPromise = null;

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

const sanitizeDemoData = async (conn) => {
  try {
    if (process.env.DEMO_MODE === "false") return;
    const hospitalsCol = conn.collection("hospitals");
    const nonDemoCount = await hospitalsCol.countDocuments({ isDemo: { $ne: true } }).catch(() => 0);
    if (nonDemoCount > 0) {
      console.log(`[Demo Sanitization] Anonymizing ${nonDemoCount} hospital records...`);
      const hospitals = await hospitalsCol.find({}).toArray();
      for (const h of hospitals) {
        const mapping = HOSPITAL_MAP[h.name] || {
          name: `HealPoint Demo Hospital (${h.name})`,
          address: "100 Educational Simulation Avenue, Ahmedabad",
          phone: "+91 00000 11000",
          email: "hospital@demo.healpoint.example.com",
          emergencyPhone: "+91 00000 99999",
        };
        await hospitalsCol.updateOne(
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
      }

      // Update doctors
      const doctorsCol = conn.collection("doctors");
      const doctors = await doctorsCol.find({}).toArray();
      let docIdx = 1;
      for (const d of doctors) {
        const demoPhone = `+91 00000 ${String(12000 + docIdx).padStart(5, "0")}`;
        const newHospitalName = HOSPITAL_MAP[d.hospitalName]?.name || d.hospitalName;
        await doctorsCol.updateOne(
          { _id: d._id },
          {
            $set: {
              phone: demoPhone,
              hospitalName: newHospitalName,
              isDemo: true,
              isSimulation: true,
            },
          }
        );
        docIdx++;
      }

      // Update appointments
      const apptCol = conn.collection("appointments");
      for (const [oldName, map] of Object.entries(HOSPITAL_MAP)) {
        await apptCol.updateMany(
          { hospitalName: oldName },
          { $set: { hospitalName: map.name, isDemo: true, isSimulation: true } }
        );
      }
      await apptCol.updateMany({}, { $set: { isDemo: true, isSimulation: true } });

      // Update users
      await conn.collection("users").updateMany({}, { $set: { isDemo: true, isSimulation: true } });
      await conn.collection("reviews").updateMany({}, { $set: { isDemo: true, isSimulation: true } }).catch(() => {});
      await conn.collection("subscriptions").updateMany({}, { $set: { isDemo: true, isSimulation: true } }).catch(() => {});
      console.log("[Demo Sanitization] Done! All records in database marked as demo/simulation.");
    }
  } catch (err) {
    console.warn("[Demo Sanitization Notice]:", err.message);
  }
};

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (cachedPromise) {
    return cachedPromise;
  }

  const uri =
    process.env.MONGO_URI ||
    (process.env.MONGO_LOCAL_URI
      ? `${process.env.MONGO_LOCAL_URI}/doctorapp`
      : "mongodb://localhost:27017/doctorapp");

  const opts = {
    bufferCommands: false,
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 10000,
  };

  cachedPromise = mongoose
    .connect(uri, opts)
    .then(async (m) => {
      console.log("MongoDB Database Connected".bgMagenta.white);
      try {
        const usersCol = m.connection.collection("users");
        // Drop legacy non-sparse googleId_1 index if it exists
        const indexes = await usersCol.indexes().catch(() => []);
        const gIndex = indexes.find((idx) => idx.name === "googleId_1");
        if (gIndex && !gIndex.sparse) {
          console.log("Dropping non-sparse googleId_1 index to prevent duplicate empty string collision...");
          await usersCol.dropIndex("googleId_1").catch(() => {});
        }
        // Unset any empty string googleId values from legacy records
        await usersCol.updateMany({ googleId: "" }, { $unset: { googleId: "" } }).catch(() => {});

        // Run idempotent demo data sanitization
        await sanitizeDemoData(m.connection);
      } catch (err) {
        console.warn("Index sanitization notice:", err.message);
      }
      return m;
    })
    .catch((err) => {
      cachedPromise = null;
      console.error("MongoDB connection error:", err.message);
      throw err;
    });

  return cachedPromise;
};

export default connectDB;
