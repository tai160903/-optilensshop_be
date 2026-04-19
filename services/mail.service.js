const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");

let transporter;

function getTransporter() {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: process.env.MAILTRAP_HOST || "sandbox.smtp.mailtrap.io",
    port: process.env.MAILTRAP_PORT || 2525,
    auth: {
      user: process.env.MAILTRAP_USER || "",
      pass: process.env.MAILTRAP_PASS || "",
    },
  });

  return transporter;
}

function renderTemplate(templatePath, variables = {}) {
  const absolutePath = path.join(__dirname, "..", templatePath);
  let html = fs.readFileSync(absolutePath, "utf8");

  Object.entries(variables).forEach(([key, value]) => {
    const pattern = new RegExp(`{{\\s*${key}\\s*}}`, "g");
    html = html.replace(pattern, String(value ?? ""));
  });

  return html;
}

async function sendVerificationEmail({ to, verificationLink }) {
  const from = process.env.MAILTRAP_FROM_EMAIL || "no-reply@optilens.local";
  const subject = "Xác thực tài khoản OptiLens Shop";

  const html = renderTemplate("templates/email/verification.template.html", {
    VERIFICATION_LINK: verificationLink,
  });

  const mailer = getTransporter();
  return mailer.sendMail({ from, to, subject, html });
}

async function sendResetPasswordEmail({ to, resetLink }) {
  const from = process.env.MAILTRAP_FROM_EMAIL || "no-reply@optilens.local";
  const subject = "Đặt lại mật khẩu OptiLens Shop";

  const html = renderTemplate("templates/email/reset-password.template.html", {
    RESET_LINK: resetLink,
  });

  const mailer = getTransporter();
  return mailer.sendMail({ from, to, subject, html });
}

async function sendStaffCreatedEmail({ to, role, tempPassword }) {
  const from = process.env.MAILTRAP_FROM_EMAIL || "no-reply@optilens.local";
  const subject = "Tài khoản nhân sự OptiLens Shop đã được tạo";

  const html = renderTemplate("templates/email/staff-created.template.html", {
    EMAIL: to,
    ROLE: role,
    TEMP_PASSWORD: tempPassword,
  });

  const mailer = getTransporter();
  return mailer.sendMail({ from, to, subject, html });
}

async function sendStaffDeletedEmail({ to, role }) {
  const from = process.env.MAILTRAP_FROM_EMAIL || "no-reply@optilens.local";
  const subject = "Tài khoản nhân sự OptiLens Shop đã bị vô hiệu hóa";

  const html = renderTemplate("templates/email/staff-deleted.template.html", {
    EMAIL: to,
    ROLE: role,
  });

  const mailer = getTransporter();
  return mailer.sendMail({ from, to, subject, html });
}

module.exports = {
  sendVerificationEmail,
  sendResetPasswordEmail,
  sendStaffCreatedEmail,
  sendStaffDeletedEmail,
};
