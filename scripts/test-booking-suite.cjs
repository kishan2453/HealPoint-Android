const assert = require('assert');
const {
  normalizeToDate,
  toDDMMYYYY,
  formatDDMMYYYY,
  parseSlotToMinutes,
  getNowMinutesIST,
  isDateTodayIST,
  isDatePastIST,
  isSlotPassedIST,
} = require('./lib/format-cjs.cjs');

// Mock time: 6 November 2026, 2:10 PM IST (14:10 IST -> 850 minutes)
const mockNow = new Date('2026-11-06T08:40:00.000Z'); // 08:40 UTC = 14:10 IST

console.log('--- TEST 1: Date & Time parsing at 2:10 PM IST ---');
const nowMinIST = getNowMinutesIST(mockNow);
assert.strictEqual(nowMinIST, 850, '14:10 IST must equal 850 minutes from midnight');
console.log('✓ Now minutes in IST at 2:10 PM:', nowMinIST);

console.log('--- TEST 2: Past slots filtering for Today (06-11-2026) at 2:10 PM IST ---');
const todayStr = '06-11-2026';
assert.strictEqual(isDateTodayIST(todayStr, mockNow), true, '06-11-2026 must be recognized as today');
assert.strictEqual(isDatePastIST(todayStr, mockNow), false, '06-11-2026 must not be past');

const testSlots = [
  { slot: '09:00 AM', expectPassed: true },
  { slot: '10:00 AM', expectPassed: true },
  { slot: '11:30 AM', expectPassed: true },
  { slot: '02:00 PM', expectPassed: true },
  { slot: '02:30 PM', expectPassed: false },
  { slot: '04:00 PM', expectPassed: false },
  { slot: '06:00 PM', expectPassed: false },
];

testSlots.forEach(({ slot, expectPassed }) => {
  const isPassed = isSlotPassedIST(todayStr, slot, mockNow);
  assert.strictEqual(isPassed, expectPassed, `${slot} expected passed=${expectPassed}, got ${isPassed}`);
  console.log(`✓ Slot ${slot}: isPassed=${isPassed} (${expectPassed ? 'HIDDEN' : 'VISIBLE'})`);
});

console.log('--- TEST 3: Future Date (07-11-2026) ---');
const tmrStr = '07-11-2026';
assert.strictEqual(isDateTodayIST(tmrStr, mockNow), false);
assert.strictEqual(isDatePastIST(tmrStr, mockNow), false);
assert.strictEqual(isSlotPassedIST(tmrStr, '09:00 AM', mockNow), false);
console.log('✓ Future date slots are all VISIBLE (09:00 AM is visible)');

console.log('--- TEST 4: Past Date (05-11-2026) ---');
const yesterdayStr = '05-11-2026';
assert.strictEqual(isDatePastIST(yesterdayStr, mockNow), true);
assert.strictEqual(isSlotPassedIST(yesterdayStr, '04:00 PM', mockNow), true);
console.log('✓ Past date slots are all HIDDEN/REJECTED');

console.log('--- TEST 5: formatDDMMYYYY with various inputs ---');
assert.strictEqual(formatDDMMYYYY('06-11-2026'), '6 Nov 2026');
assert.strictEqual(formatDDMMYYYY(new Date(2026, 10, 6)), '6 Nov 2026');
assert.strictEqual(formatDDMMYYYY({ slotDate: '06-11-2026' }), '6 Nov 2026');
assert.strictEqual(formatDDMMYYYY(null), '-');
assert.strictEqual(formatDDMMYYYY(undefined), '-');
assert.strictEqual(formatDDMMYYYY(''), '-');
console.log('✓ formatDDMMYYYY safely handles Date, string, object, and null/undefined without throwing dateObj.getDate error');

console.log('ALL TESTS PASSED SUCCESSFULLY! ✓');
