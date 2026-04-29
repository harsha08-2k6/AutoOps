const nodemailer = require("nodemailer");

let transporter;
const lastSentByKey = new Map();
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function ensureTransporter() {
  if (transporter) {
    return transporter;
  }

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return transporter;
}

function shouldRateLimit(key, cooldownMs = 120000) {
  const now = Date.now();
  const lastSentAt = lastSentByKey.get(key) || 0;
  if (now - lastSentAt < cooldownMs) {
    return true;
  }
  lastSentByKey.set(key, now);
  return false;
}

function normalizeRecipients(value) {
  const rawList = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,;]/)
      : [];

  const unique = new Set();
  rawList.forEach((item) => {
    const trimmed = String(item).trim();
    if (trimmed && EMAIL_REGEX.test(trimmed)) {
      unique.add(trimmed);
    }
  });

  return Array.from(unique);
}

async function sendContainerAlert({ containerName, state, reason, to }) {
  const mailer = ensureTransporter();
  const directRecipients = normalizeRecipients(to);
  const recipients = directRecipients.length
    ? directRecipients
    : normalizeRecipients(process.env.ALERT_EMAIL_TO || process.env.SMTP_USER);

  if (!mailer || recipients.length === 0) {
    return { sent: false, skipped: true, reason: "Email not configured" };
  }

  const key = `${containerName}:${state}:${reason || "unknown"}`;
  if (shouldRateLimit(key)) {
    return { sent: false, skipped: true, reason: "Rate limited" };
  }

  await mailer.sendMail({
    from: process.env.ALERT_EMAIL_FROM || process.env.SMTP_USER,
    to: recipients.join(", "),
    subject: "AutoOps Alert",
    text: `Container alert for ${containerName}: state=${state}, reason=${reason || "n/a"}`,
  });

  return { sent: true };
}

module.exports = {
  sendContainerAlert,
};
