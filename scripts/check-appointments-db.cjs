const mongoose = require('mongoose');
require('dotenv').config({ path: 'HealPointBackend/.env' });

async function check() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/healpoint');
    const Doctor = mongoose.model('Doctor', new mongoose.Schema({}, { strict: false }));
    const Appointment = mongoose.model('Appointment', new mongoose.Schema({}, { strict: false }));
    
    const doc = await Doctor.findOne({ name: { $regex: 'Anvi', $options: 'i' } });
    console.log('Doctor:', doc?.name, doc?._id);
    
    if (doc) {
      const appts = await Appointment.find({ doctorId: doc._id });
      console.log('Total appointments in DB for this doctor:', appts.length);
      appts.forEach((a, i) => {
        console.log(`[${i+1}] ID:${a._id} date:${a.slotDate} time:${a.slotTime} status:${a.status} mode:${a.consultationType} amount:${a.amount}`);
      });
    }
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}
check();
