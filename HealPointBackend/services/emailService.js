import nodemailer from "nodemailer";

let transporter = null;

export const getTransporter = () => {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = process.env.SMTP_SECURE === "true" || port === 465;

  if (host && user && pass) {
    transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      tls: { rejectUnauthorized: process.env.NODE_ENV === "production" },
    });
  } else {
    // Development/Fallback Transporter
    transporter = null;
  }
  return transporter;
};

/**
 * Send an appointment reminder email to the verified patient email.
 */
export const sendAppointmentReminderEmail = async ({
  to,
  patientName,
  doctorName,
  hospitalName,
  date,
  time,
  consultationType,
  reminderType, // "24h" | "1h"
  appointmentId,
  meetingUrl,
}) => {
  if (!to || !to.includes("@")) {
    throw new Error(`Invalid recipient email address: ${to}`);
  }

  const isOneHour = reminderType === "1h";
  const timeframeLabel = isOneHour ? "in approximately 1 hour" : "tomorrow (in 24 hours)";
  const subject = isOneHour
    ? `🚨 Reminder: Your HealPoint consultation is in 1 hour (${time})`
    : `📅 Upcoming Consultation Reminder: Tomorrow at ${time} with ${doctorName}`;

  const isVideo = consultationType === "video";
  const consultationLabel = isVideo ? "Online Video Consultation" : "In-Person Clinic Visit";
  const viewUrl = `https://heal-point-mauve.vercel.app/appointment/${appointmentId || ""}`;
  const actionButtonText = isVideo ? "Join Video Room / View Pass" : "View Appointment & Pass";
  const actionUrl = isVideo && meetingUrl ? meetingUrl : viewUrl;

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
        .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
        .header { background: #0284c7; padding: 28px 24px; text-align: center; color: #ffffff; }
        .header h1 { margin: 0 0 6px 0; font-size: 24px; font-weight: 700; }
        .header p { margin: 0; font-size: 14px; opacity: 0.95; }
        .body { padding: 24px; }
        .badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 700; background: ${isOneHour ? '#fee2e2' : '#e0f2fe'}; color: ${isOneHour ? '#b91c1c' : '#0369a1'}; margin-bottom: 16px; }
        .detail-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 16px 0; }
        .detail-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; border-bottom: 1px solid #edf2f7; }
        .detail-row:last-child { border-bottom: none; }
        .label { color: #64748b; font-weight: 500; }
        .value { color: #0f172a; font-weight: 600; text-align: right; }
        .btn { display: block; text-align: center; background: #0284c7; color: #ffffff !important; text-decoration: none; padding: 14px 20px; border-radius: 10px; font-weight: 700; font-size: 15px; margin: 24px 0 16px 0; }
        .footer { padding: 20px 24px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; background: #f8fafc; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <h1>HealPoint Healthcare</h1>
          <p>Appointment Reminder Notification</p>
        </div>
        <div class="body">
          <span class="badge">${isOneHour ? '⏰ 1-HOUR ALERT' : '🗓️ 24-HOUR NOTICE'}</span>
          <p>Hello <strong>${patientName || 'Valued Patient'}</strong>,</p>
          <p>This is a reminder that you have an appointment scheduled <strong>${timeframeLabel}</strong> with HealPoint.</p>
          
          <div class="detail-box">
            <div class="detail-row">
              <span class="label">Doctor:</span>
              <span class="value">${doctorName || 'Assigned Specialist'}</span>
            </div>
            <div class="detail-row">
              <span class="label">Hospital / Clinic:</span>
              <span class="value">${hospitalName || 'HealPoint Center'}</span>
            </div>
            <div class="detail-row">
              <span class="label">Consultation Type:</span>
              <span class="value">${consultationLabel}</span>
            </div>
            <div class="detail-row">
              <span class="label">Date:</span>
              <span class="value">${date}</span>
            </div>
            <div class="detail-row">
              <span class="label">Time:</span>
              <span class="value">${time}</span>
            </div>
            ${appointmentId ? `
            <div class="detail-row">
              <span class="label">Appointment Ref:</span>
              <span class="value">${appointmentId}</span>
            </div>` : ''}
          </div>

          <p style="font-size: 13px; color: #475569; line-height: 1.5;">
            ${isVideo 
              ? '💡 <strong>Online Consultation Instructions:</strong> Please ensure your camera and microphone are ready, and join 5 minutes prior to your slot time.' 
              : '💡 <strong>Clinic Visit Instructions:</strong> Please arrive at the reception desk 10-15 minutes early with your digital pass for fast Smart QR check-in.'}
          </p>

          <a href="${actionUrl}" class="btn">${actionButtonText}</a>
        </div>
        <div class="footer">
          <p>HealPoint Healthcare Services · Secure Clinical Systems</p>
          <p>If you need to reschedule or cancel, please access your appointments in the HealPoint app at least 2 hours in advance.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const mailOptions = {
    from: process.env.SMTP_FROM || '"HealPoint Healthcare" <no-reply@healpoint.com>',
    to,
    subject,
    html,
  };

  const client = getTransporter();
  if (client) {
    const info = await client.sendMail(mailOptions);
    console.log(`[EmailService] Real reminder email (${reminderType}) sent to ${to}: ${info.messageId}`);
    return { success: true, messageId: info.messageId, simulated: false };
  } else {
    // Transporter not configured with live credentials; log simulated dispatch
    console.log(`[EmailService] Simulated reminder email (${reminderType}) to ${to} for appointment ${appointmentId}`);
    return { success: true, messageId: `sim_${Date.now()}`, simulated: true };
  }
};

