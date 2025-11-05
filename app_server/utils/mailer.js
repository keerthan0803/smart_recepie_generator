const nodemailer = require('nodemailer');

let transporter;

function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST || process.env.MAIL_HOST;
  const port = parseInt(process.env.SMTP_PORT || process.env.MAIL_PORT || '587', 10);
  // Support multiple env var names: SMTP_USER, MAIL_USER, EMAIL_USER
  const user = process.env.SMTP_USER || process.env.MAIL_USER || process.env.EMAIL_USER;
  let pass = process.env.SMTP_PASS || process.env.MAIL_PASS || process.env.EMAIL_PASS;

  const guessedHost = host || 'smtp.gmail.com';
  const isGmail = /gmail\.com$/i.test(guessedHost) || (!!user && /@gmail\.com$/i.test(user));
  if (isGmail && pass) {
    // Gmail app passwords are 16 chars without spaces; strip spaces if provided
    pass = pass.replace(/\s+/g, '');
  }

  if (!host || !user || !pass) {
    console.warn('SMTP not fully configured. Please set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS');
  }

  const transportOptions = {
    host: guessedHost,
    port: port || 587,
    secure: (port === 465),
    requireTLS: (port !== 465),
    auth: user && pass ? { user, pass } : undefined,
  };
  if (isGmail) {
    // Let nodemailer optimize for Gmail
    transportOptions.service = 'gmail';
  }

  if (!transportOptions.auth) {
    console.warn('[mailer] No SMTP auth configured. Set EMAIL_USER/EMAIL_PASS or SMTP_USER/SMTP_PASS');
  }

  transporter = nodemailer.createTransport(transportOptions);

  return transporter;
}

async function sendMail({ to, subject, html, text }) {
  const from = process.env.MAIL_FROM || process.env.SMTP_USER || process.env.MAIL_USER || process.env.EMAIL_USER || 'no-reply@example.com';
  const t = getTransporter();

  const info = await t.sendMail({
    from,
    to,
    subject,
    html,
    text,
  });
  return info;
}

module.exports = { sendMail };
