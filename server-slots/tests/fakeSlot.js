'use strict';

/**
 * Minimal in-memory Slot model implementing the subset of the Mongoose API that
 * slotService uses. Supports set-based filters ($in, $nin) and the update
 * operators $set / $setOnInsert used by the service. Concurrency guarantee of
 * claimSlotAtomic is simulated with a single-threaded synchronous guard:
 * findOneAndUpdate checks the status filter atomically relative to the store.
 */

class FakeSlot {
  constructor() {
    this.store = new Map(); // id -> doc
    this.seq = 1;
  }

  _matches(doc, filter) {
    if (!filter) return true;
    for (const key of Object.keys(filter)) {
      const wanted = filter[key];
      if (wanted && typeof wanted === 'object' && (wanted.$in || wanted.$nin)) {
        const value = doc[key];
        if (wanted.$in && !wanted.$in.includes(value)) return false;
        if (wanted.$nin && wanted.$nin.includes(value)) return false;
        continue;
      }
      if (String(doc[key] || '') !== String(wanted || '')) return false;
    }
    return true;
  }

  find(filter) {
    const docs = [...this.store.values()].filter((d) => this._matches(d, filter));
    return { lean: () => docs };
  }

  findOne(filter) {
    const doc = [...this.store.values()].find((d) => this._matches(d, filter));
    return doc ? { ...doc } : null;
  }

  findById(id) {
    const doc = this.store.get(String(id));
    if (!doc) return null;
    return { lean: () => ({ ...doc }) };
  }

  countDocuments(filter) {
    return [...this.store.values()].filter((d) => this._matches(d, filter)).length;
  }

  deleteMany(filter) {
    const ids = [...this.store.values()].filter((d) => this._matches(d, filter)).map((d) => String(d._id));
    for (const id of ids) this.store.delete(id);
    return { deletedCount: ids.length };
  }

  updateMany(filter, update) {
    let modified = 0;
    for (const doc of this.store.values()) {
      if (!this._matches(doc, filter)) continue;
      this._apply(doc, update);
      modified += 1;
    }
    return { modifiedCount: modified };
  }

  updateOne(filter, update) {
    const doc = [...this.store.values()].find((d) => this._matches(d, filter));
    if (!doc) return { matchedCount: 0, modifiedCount: 0 };
    this._apply(doc, update);
    return { matchedCount: 1, modifiedCount: 1 };
  }

  findOneAndUpdate(filter, update, opts) {
    const doc = [...this.store.values()].find((d) => this._matches(d, filter));
    if (!doc) return null;
    this._apply(doc, update);
    const out = opts && opts.new ? { ...doc } : { ...doc };
    return { lean: () => out };
  }

  bulkWrite(ops, options) {
    let upsertedCount = 0;
    for (const op of ops) {
      const updateOne = op.updateOne;
      if (!updateOne) continue;
      const key = updateOne.filter;
      const exists = [...this.store.values()].find((d) => this._matches(d, key));
      if (exists) continue; // already existing -> idempotent skip
      const now = new Date();
      const id = String(this.seq++);
      const doc = {
        _id: id,
        hospitalId: String(key.hospitalId),
        doctorId: String(key.doctorId),
        date: key.date,
        startTime: key.startTime,
        endTime: '',
        status: 'available',
        appointmentId: null,
        createdAt: now,
        updatedAt: now,
      };
      if (updateOne.update.$setOnInsert) {
        for (const k of Object.keys(updateOne.update.$setOnInsert)) {
          doc[k] = updateOne.update.$setOnInsert[k];
        }
      }
      this.store.set(id, doc);
      upsertedCount += 1;
    }
    return { upsertedCount, matchedCount: 0, modifiedCount: 0 };
  }

  _apply(doc, update) {
    if (update.$set) {
      for (const k of Object.keys(update.$set)) doc[k] = update.$set[k];
    }
    if (update.$setOnInsert) {
      for (const k of Object.keys(update.$setOnInsert)) {
        if (doc[k] === undefined) doc[k] = update.$setOnInsert[k];
      }
    }
    doc.updatedAt = new Date();
  }

  dump() {
    return [...this.store.values()];
  }
}

module.exports = { FakeSlot };
