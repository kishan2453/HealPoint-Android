'use strict';

/**
 * HealPoint - Slot DB verification probe.
 *
 *   npm run db:verify
 *
 * Connects to the configured MongoDB, builds indexes (including the unique
 * (hospital,doctor,date,startTime) index), inserts + reads + deletes a probe
 * slot document, and verifies the unique index actually rejects a duplicate
 * insert. Prints a clear PASS/FAIL summary; exits non-zero on any failure.
 */

const { connectDb, disconnectDb, dbName, resolveMongoUri } = require('../config/db');

let pass = 0;
let fail = 0;
function check(label, ok) {
  if (ok) {
    pass = pass + 1;
    console.log('  ok  ' + label);
  } else {
    fail = fail + 1;
    console.log('  FAIL ' + label);
  }
}

async function main() {
  console.log('[slots] verifying MongoDB connection');
  console.log('[slots] uri: ' + resolveMongoUri());
  console.log('[slots] db : ' + dbName());

  await connectDb();

  const mongoose = require('mongoose');
  const Slot = require('../models/slotModel');

  await Slot.syncIndexes();
  const indexInfo = await Slot.collection.indexes();
  const hasUnique = indexInfo.some((i) => {
    const keys = Object.keys(i.key || {});
    return (
      i.unique === true &&
      keys.includes('hospitalId') &&
      keys.includes('doctorId') &&
      keys.includes('date') &&
      keys.includes('startTime')
    );
  });
  check('unique (hospital,doctor,date,startTime) index present', hasUnique === true);

  const probeHospital = new mongoose.Types.ObjectId();
  const probeDoctor = new mongoose.Types.ObjectId();
  const probeDate = '01-01-2099';
  const probeStart = '09:00';

  await Slot.deleteMany({ hospitalId: probeHospital, doctorId: probeDoctor });

  const created = await Slot.create({
    hospitalId: probeHospital,
    doctorId: probeDoctor,
    date: probeDate,
    startTime: probeStart,
    endTime: '09:30',
  });
  check('insert probe slot', Boolean(created && created._id));

  const found = await Slot.findOne({
    hospitalId: probeHospital,
    doctorId: probeDoctor,
    date: probeDate,
    startTime: probeStart,
  }).lean();
  check('read back probe slot', found && found.startTime === probeStart && found.status === 'available');

  let duplicateRejected = false;
  try {
    await Slot.create({
      hospitalId: probeHospital,
      doctorId: probeDoctor,
      date: probeDate,
      startTime: probeStart,
      endTime: '09:30',
    });
  } catch (err) {
    duplicateRejected = err && err.code === 11000;
  }
  check('duplicate insert rejected (E11000)', duplicateRejected === true);

  const removed = await Slot.deleteMany({ hospitalId: probeHospital, doctorId: probeDoctor });
  check('cleanup probe slot', Boolean(removed && removed.deletedCount >= 1));

  await disconnectDb();

  console.log('');
  console.log('RESULT: ' + pass + ' passed, ' + fail + ' failed');
  if (fail > 0) process.exitCode = 1;
}

main().catch(async (err) => {
  console.error('ERROR: ' + (err && err.message ? err.message : String(err)));
  process.exitCode = 1;
  try {
    await disconnectDb();
  } catch (e) {
    // ignore disconnect errors during failure paths
  }
});