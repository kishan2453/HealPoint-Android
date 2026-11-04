const path = require('path');
const mongoose = require(path.resolve('HealPointBackend/node_modules/mongoose'));
const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/doctorapp';

async function run() {
  await mongoose.connect(uri);
  const a = await mongoose.connection.collection('appointments').findOne({
    _id: new mongoose.Types.ObjectId('6ae428feaf7a64ada721b884')
  });
  console.log('Appointment 6ae428feaf7a64ada721b884:');
  console.log(JSON.stringify(a, null, 2));

  const docIdVal = a.docId || a.doctorId;
  console.log('Doc ID value:', docIdVal, 'Type:', typeof docIdVal);
  const allForDoc = await mongoose.connection.collection('appointments').find({
    $or: [
      { docId: docIdVal },
      { doctorId: docIdVal },
      { docId: String(docIdVal) },
      { doctorId: String(docIdVal) }
    ]
  }).toArray();
  console.log('Matching appointments for this doctor:', allForDoc.length);
  allForDoc.forEach((item, i) => {
    console.log(`[${i+1}] ID: ${item._id} | slotDate: ${item.slotDate} | slotTime: ${item.slotTime} | status: ${item.status}`);
  });
  await mongoose.disconnect();
}
run();
