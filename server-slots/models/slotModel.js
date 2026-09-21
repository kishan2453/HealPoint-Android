'use strict';

/**
 * HealPoint - Doctor Slot model.
 *
 * Persisted bookable inventory materialized by the slot engine from the doctor's
 * schedule. The Doctor document stays the source of truth; this collection
 * is the bookable slots patients can claim, and the Doctor Portal reads back.
 *
 * Logical identity: hospitalId + doctorId + date + startTime.
 * A sparse partial UNIQUE index makes generation idempotent AT THE DATABASE
 * LEVEL: two concurrent generation requests can never insert a duplicate slot.
 * The index is scoped per doctor/hospital so different doctors/hospitals never
 * collide (hospital isolation is additionally enforced at the controller).
 *
 * Status vocabulary reuses the existing booking vocabulary:
 *   available - open for booking (default when no appointment exists)
 *   booked    - claimed by an appointment (see appointmentId link)
 *   blocked   - manually blocked by Hospital Admin (reason + actor stored)
 *   cancelled - slot-level cancellation (only when business rules permit)
 *   expired   - past / never-bookable inventory (not shown to patients)
 */

const mongoose = require('mongoose');

const slotSchema = new mongoose.Schema(
  {
    hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true, index: true },
    date: { type: String, required: true }, // DD-MM-YYYY (backend slot format)
    startTime: { type: String, required: true }, // HH:mm (24h machine form)
    endTime: { type: String, required: true },
    status: {
      type: String,
      enum: ['available', 'booked', 'blocked', 'cancelled', 'expired'],
      default: 'available',
      index: true,
    },
    appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', default: null },
    blockReason: { type: String, default: null },
    blockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    blockedAt: { type: Date, default: null },
    generatedBy: { type: String, default: 'schedule' },
    source: { type: String, enum: ['schedule', 'bulk'], default: 'schedule' },
  },
  { timestamps: true }
);

// Idempotent generation contract: (hospital, doctor, date, startTime) is unique.
// Two concurrent bulk-generation requests cannot create a duplicate (TEST 10).
slotSchema.index(
  { hospitalId: 1, doctorId: 1, date: 1, startTime: 1 },
  { unique: true, sparse: true, name: 'uniq_hospital_doctor_date_start' }
);

// Common lookup patterns.
slotSchema.index({ doctorId: 1, date: 1, status: 1 });
slotSchema.index({ hospitalId: 1, date: 1 });

module.exports = mongoose.model('Slot', slotSchema);
