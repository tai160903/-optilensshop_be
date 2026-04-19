const bcrypt = require("bcrypt");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const User = require("../models/user.schema");
const mailService = require("./mail.service");
const mongoose = require("mongoose");

const SALT_ROUNDS = 10;
const PASSWORD_MIN_LENGTH = 5;
const PASSWORD_MAX_LENGTH = 64;
const ALLOWED_ROLES = ["customer", "sales", "operations", "manager", "admin"];

function createHttpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function createVerificationToken() {
  return crypto.randomBytes(32).toString("hex");
}

function createVerificationExpiry() {
  const minutes = Number(process.env.EMAIL_VERIFY_TOKEN_EXPIRES_MINUTES || 30);
  return new Date(Date.now() + minutes * 60 * 1000);
}

function buildVerificationLink(token) {
  const baseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
  return `${baseUrl}/auth/verify-email?token=${token}`;
}

function buildResetPasswordLink(token) {
  const baseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
  return `${baseUrl}/auth/reset-password?token=${token}`;
}

function createResetPasswordToken() {
  return crypto.randomBytes(32).toString("hex");
}

function createResetPasswordExpiry() {
  const minutes = Number(
    process.env.RESET_PASSWORD_TOKEN_EXPIRES_MINUTES || 30,
  );
  return new Date(Date.now() + minutes * 60 * 1000);
}

function signAccessToken(user) {
  const secret = process.env.JWT_ACCESS_TOKEN_SECRET || "dev-secret";
  const expiresIn = process.env.JWT_ACCESS_TOKEN_EXPIRATION || "7d";

  return jwt.sign(
    {
      sub: String(user._id),
      email: user.email,
    },
    secret,
    { expiresIn },
  );
}

function validateConfirmPassword(password, confirmPassword) {
  if (confirmPassword === undefined || confirmPassword === null) {
    throw createHttpError("Confirm password là bắt buộc", 400);
  }

  if (String(password) !== String(confirmPassword)) {
    throw createHttpError("Password và confirm password không khớp", 400);
  }
}

async function sendVerificationForUser(user) {
  const verificationToken = createVerificationToken();
  const verificationExpires = createVerificationExpiry();

  user.email_verification_token = verificationToken;
  user.email_verification_expires = verificationExpires;
  await user.save();

  const verificationLink = buildVerificationLink(verificationToken);
  await mailService.sendVerificationEmail({
    to: user.email,
    verificationLink,
  });

  return {
    verification_token: verificationToken,
    verification_expires: verificationExpires,
  };
}

async function register({ email, password, confirm_password }) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!password || typeof password !== "string") {
    throw createHttpError("Password là bắt buộc", 400);
  }
  if (
    password.length < PASSWORD_MIN_LENGTH ||
    password.length > PASSWORD_MAX_LENGTH
  ) {
    throw createHttpError(
      `Password phải từ ${PASSWORD_MIN_LENGTH} đến ${PASSWORD_MAX_LENGTH} ký tự`,
      400,
    );
  }
  validateConfirmPassword(password, confirm_password);

  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    throw createHttpError("Email đã tồn tại", 409);
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await User.create({
    email: normalizedEmail,
    password: hashedPassword,
    status: "active",
    is_email_verified: false,
  });

  try {
    await sendVerificationForUser(user);
  } catch (mailErr) {
    console.log(mailErr);
    throw createHttpError(
      "Lỗi gửi email xác thực, đăng ký không thành công",
      500,
    );
  }

  return {
    email: user.email,
  };
}

async function login({ email, password }) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!password || typeof password !== "string") {
    throw createHttpError("Password là bắt buộc", 400);
  }
  if (
    password.length < PASSWORD_MIN_LENGTH ||
    password.length > PASSWORD_MAX_LENGTH
  ) {
    throw createHttpError(
      `Password phải từ ${PASSWORD_MIN_LENGTH} đến ${PASSWORD_MAX_LENGTH} ký tự`,
      400,
    );
  }
  const loginPassword = password;

  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    throw createHttpError("Thông tin đăng nhập không hợp lệ", 401);
  }

  if (!user.is_email_verified) {
    throw createHttpError("Vui lòng xác thực email trước khi đăng nhập", 401);
  }

  const isMatched = await bcrypt.compare(loginPassword, user.password);
  if (!isMatched) {
    throw createHttpError("Thông tin đăng nhập không hợp lệ", 401);
  }

  const accessToken = signAccessToken(user);

  return {
    access_token: accessToken,
    user: {
      id: user._id,
      email: user.email,
      role: user.role,
      status: user.status,
      is_email_verified: user.is_email_verified,
    },
  };
}

async function verifyEmail({ token }) {
  if (!token) {
    throw createHttpError("Thiếu token xác thực email", 400);
  }

  const user = await User.findOne({ email_verification_token: token });
  if (!user) {
    throw createHttpError("Token xác thực không hợp lệ", 400);
  }

  if (
    !user.email_verification_expires ||
    user.email_verification_expires < new Date()
  ) {
    throw createHttpError("Token xác thực đã hết hạn", 400);
  }

  user.is_email_verified = true;
  user.email_verification_token = null;
  user.email_verification_expires = null;
  await user.save();

  return { message: "Xác thực email thành công" };
}

async function resendVerificationEmail({ email }) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    throw createHttpError("Không tìm thấy người dùng", 404);
  }

  if (user.is_email_verified) {
    throw createHttpError("Email đã được xác thực trước đó", 400);
  }

  await sendVerificationForUser(user);
  return { message: "Đã gửi lại email xác thực" };
}

async function forgotPassword({ email }) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    return {
      message:
        "Nếu email tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu đã được gửi",
    };
  }

  const resetToken = createResetPasswordToken();
  const resetExpires = createResetPasswordExpiry();

  user.reset_password_token = resetToken;
  user.reset_password_expires = resetExpires;
  await user.save();

  const resetLink = buildResetPasswordLink(resetToken);
  await mailService.sendResetPasswordEmail({
    to: user.email,
    resetLink,
  });

  return {
    message:
      "Nếu email tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu đã được gửi",
  };
}

async function resetPassword({ token, password, confirm_password }) {
  if (!token) {
    throw createHttpError("Thiếu token đặt lại mật khẩu", 400);
  }

  // Validate password inline
  if (!password || typeof password !== "string") {
    throw createHttpError("Password là bắt buộc", 400);
  }
  if (
    password.length < PASSWORD_MIN_LENGTH ||
    password.length > PASSWORD_MAX_LENGTH
  ) {
    throw createHttpError(
      `Password phải từ ${PASSWORD_MIN_LENGTH} đến ${PASSWORD_MAX_LENGTH} ký tự`,
      400,
    );
  }
  validateConfirmPassword(password, confirm_password);

  const user = await User.findOne({ reset_password_token: token });
  if (!user) {
    throw createHttpError("Token đặt lại mật khẩu không hợp lệ", 400);
  }

  if (
    !user.reset_password_expires ||
    user.reset_password_expires < new Date()
  ) {
    throw createHttpError("Token đặt lại mật khẩu đã hết hạn", 400);
  }

  user.password = await bcrypt.hash(password, SALT_ROUNDS);
  user.reset_password_token = null;
  user.reset_password_expires = null;
  await user.save();

  return { message: "Đặt lại mật khẩu thành công" };
}

async function changePassword({
  userId,
  current_password,
  new_password,
  confirm_new_password,
}) {
  if (!userId) {
    throw createHttpError("Thiếu thông tin người dùng", 401);
  }

  if (!current_password) {
    throw createHttpError("Mật khẩu hiện tại là bắt buộc", 400);
  }

  // Validate password inline
  if (!new_password || typeof new_password !== "string") {
    throw createHttpError("Password là bắt buộc", 400);
  }
  if (
    new_password.length < PASSWORD_MIN_LENGTH ||
    new_password.length > PASSWORD_MAX_LENGTH
  ) {
    throw createHttpError(
      `Password phải từ ${PASSWORD_MIN_LENGTH} đến ${PASSWORD_MAX_LENGTH} ký tự`,
      400,
    );
  }
  validateConfirmPassword(new_password, confirm_new_password);
  const validNewPassword = new_password;

  const user = await User.findById(userId);
  if (!user) {
    throw createHttpError("Không tìm thấy người dùng", 404);
  }

  const isMatched = await bcrypt.compare(
    String(current_password),
    user.password,
  );
  if (!isMatched) {
    throw createHttpError("Mật khẩu hiện tại không đúng", 400);
  }

  const isSameAsOld = await bcrypt.compare(validNewPassword, user.password);
  if (isSameAsOld) {
    throw createHttpError("Mật khẩu mới không được trùng mật khẩu cũ", 400);
  }

  user.password = await bcrypt.hash(validNewPassword, SALT_ROUNDS);
  await user.save();

  return { message: "Đổi mật khẩu thành công" };
}

module.exports = {
  register,
  login,
  verifyEmail,
  resendVerificationEmail,
  forgotPassword,
  resetPassword,
  changePassword,
};
