function parseSlotDate(slotDate) {
  if (!slotDate) return null;
  if (slotDate instanceof Date) return isNaN(slotDate.getTime()) ? null : slotDate;
  const s = String(slotDate).trim();
  const parts = s.split(/[-/]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      d.setHours(0, 0, 0, 0);
      return isNaN(d.getTime()) ? null : d;
    } else {
      const d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
      d.setHours(0, 0, 0, 0);
      return isNaN(d.getTime()) ? null : d;
    }
  }
  const d = new Date(s);
  d.setHours(0, 0, 0, 0);
  return isNaN(d.getTime()) ? null : d;
}

function classifyAppointment(apt, now = new Date()) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const aptDate = parseSlotDate(apt.slotDate);
  
  const status = (apt.status || '').toLowerCase();
  const isCancelled = ['cancel', 'cancelled', 'missed'].includes(status);
  const isCompleted = status === 'completed';
  const isPending = status === 'pending';
  const isConfirmed = status === 'confirmed';

  let dateCategory = 'unknown';
  if (aptDate) {
    const diff = aptDate.getTime() - today.getTime();
    if (diff === 0) dateCategory = 'today';
    else if (diff > 0) dateCategory = 'upcoming';
    else dateCategory = 'past';
  } else if (apt.isToday) {
    dateCategory = 'today';
  }

  // Today matches strictly dateCategory === 'today'
  const isTodayMatch = dateCategory === 'today';
  
  // Upcoming matches future date AND active booking, or pending/confirmed in future
  const isUpcomingMatch = dateCategory === 'upcoming' && (isPending || isConfirmed || !isCancelled);

  return {
    dateCategory,
    isTodayMatch,
    isUpcomingMatch,
    isCompleted,
    isCancelled,
    isPending
  };
}

const testAppointments = [
  { _id: '1', slotDate: '18-08-2026', status: 'cancel' },
  { _id: '2', slotDate: '19-06-2026', status: 'cancel' },
  { _id: '3', slotDate: '30-10-2026', status: 'completed' },
];

testAppointments.forEach(a => {
  console.log(a._id, a.slotDate, a.status, classifyAppointment(a));
});

// Test with today's date
const now = new Date();
const todayStr = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
console.log('Today appointment:', classifyAppointment({ _id: '4', slotDate: todayStr, status: 'confirmed' }));

// Test with tomorrow's date
const tmr = new Date();
tmr.setDate(tmr.getDate() + 1);
const tmrStr = `${String(tmr.getDate()).padStart(2, '0')}-${String(tmr.getMonth() + 1).padStart(2, '0')}-${tmr.getFullYear()}`;
console.log('Tomorrow appointment:', classifyAppointment({ _id: '5', slotDate: tmrStr, status: 'confirmed' }));
