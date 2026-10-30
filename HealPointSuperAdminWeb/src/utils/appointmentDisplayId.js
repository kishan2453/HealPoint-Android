export const getAppointmentDisplayId = (appointment) => {
  if (appointment?.displayAppointmentId) return appointment.displayAppointmentId;
  if (appointment?.appointmentId && !/^[a-f0-9]{24}$/i.test(String(appointment.appointmentId))) {
    return appointment.appointmentId;
  }

  const rawId = String(appointment?._id || appointment?.mongoAppointmentId || appointment?.appointmentId || "");
  const timestamp = Number.parseInt(rawId.slice(0, 8), 16);
  const year = Number.isFinite(timestamp)
    ? new Date(timestamp * 1000).getFullYear()
    : new Date().getFullYear();
  const suffix = (rawId.replace(/[^a-f0-9]/gi, "").slice(-8) || "00000000")
    .toUpperCase()
    .padStart(8, "0");

  return `APT-${year}-${suffix}`;
};
