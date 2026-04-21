const User = require("../models/user.schema");
const { uploadAvatar } = require("./cloudinary.service");
const {
  sendStaffCreatedEmail,
  sendStaffDeletedEmail,
} = require("./mail.service");
const { createHttpError } = require("../utils/create-http-error");
const ALLOWED_STAFF_ROLES = ["sales", "operations", "manager"];
const ALLOWED_MANAGER_ROLE = "manager";

function sanitizeUser(user) {
  return {
    id: user._id,
    email: user.email,
    role: user.role,
    status: user.status,
    is_email_verified: user.is_email_verified,
    profile: user.profile || {},
    addresses: user.addresses || [],
    created_at: user.created_at,
  };
}

async function getMyProfile(userId) {
  if (!userId) {
    throw createHttpError("Thiếu thông tin người dùng", 401);
  }

  const user = await User.findById(userId).select("-password");
  if (!user || user.is_deleted) {
    throw createHttpError("Không tìm thấy người dùng", 404);
  }

  return sanitizeUser(user);
}

async function updateMyProfile(userId, payload = {}) {
  if (!userId) {
    throw createHttpError("Thiếu thông tin người dùng", 401);
  }

  const allowedProfileFields = [
    "first_name",
    "last_name",
    "dob",
    "gender",
    "avatar",
  ];
  const profileUpdates = {};

  allowedProfileFields.forEach((field) => {
    if (payload[field] !== undefined) {
      profileUpdates[`profile.${field}`] = payload[field];
    }
  });

  if (payload.avatar_file && payload.avatar_file.buffer) {
    const uploadedAvatar = await uploadAvatar(
      payload.avatar_file.buffer,
      userId,
    );
    profileUpdates["profile.avatar"] = uploadedAvatar.url;
  }

  if (!Object.keys(profileUpdates).length) {
    throw createHttpError("Không có dữ liệu profile hợp lệ để cập nhật", 400);
  }

  const user = await User.findOneAndUpdate(
    { _id: userId, is_deleted: false },
    { $set: profileUpdates },
    { new: true },
  ).select("-password");

  if (!user) {
    throw createHttpError("Không tìm thấy người dùng", 404);
  }

  return sanitizeUser(user);
}

async function listStaff() {
  const users = await User.find({
    role: { $in: ALLOWED_STAFF_ROLES },
    is_deleted: false,
  })
    .select("-password")
    .sort({ created_at: -1 });

  return users.map(sanitizeUser);
}

async function createStaff({ email, password, role, status = "active" }) {
  if (!email || !password) {
    throw createHttpError("Email và password là bắt buộc", 400);
  }

  if (!ALLOWED_STAFF_ROLES.includes(role)) {
    throw createHttpError("Role staff không hợp lệ", 400);
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const exists = await User.findOne({
    email: normalizedEmail,
    is_deleted: false,
  });
  if (exists) {
    throw createHttpError("Email đã tồn tại", 409);
  }

  const bcrypt = require("bcrypt");
  const hashedPassword = await bcrypt.hash(String(password), 10);

  const user = await User.create({
    email: normalizedEmail,
    password: hashedPassword,
    role,
    status,
    is_email_verified: false,
  });

  await sendStaffCreatedEmail({
    to: normalizedEmail,
    role,
    tempPassword: String(password),
  });

  return sanitizeUser(user);
}

async function updateStaff(staffId, payload = {}) {
  const staff = await User.findOne({ _id: staffId, is_deleted: false });
  if (!staff) {
    throw createHttpError("Không tìm thấy staff", 404);
  }

  if (!ALLOWED_STAFF_ROLES.includes(staff.role)) {
    throw createHttpError("Người dùng này không thuộc nhóm staff", 400);
  }

  const updates = {};
  if (payload.status !== undefined) {
    updates.status = payload.status;
  }
  if (payload.role !== undefined) {
    if (!ALLOWED_STAFF_ROLES.includes(payload.role)) {
      throw createHttpError("Role staff không hợp lệ", 400);
    }
    updates.role = payload.role;
  }

  if (!Object.keys(updates).length) {
    throw createHttpError("Không có dữ liệu hợp lệ để cập nhật", 400);
  }

  const updated = await User.findOneAndUpdate(
    { _id: staffId, is_deleted: false },
    { $set: updates },
    { new: true },
  ).select("-password");

  return sanitizeUser(updated);
}

async function deleteStaff(staffId) {
  const staff = await User.findOne({ _id: staffId, is_deleted: false });
  if (!staff) {
    throw createHttpError("Không tìm thấy staff", 404);
  }

  if (!ALLOWED_STAFF_ROLES.includes(staff.role)) {
    throw createHttpError("Người dùng này không thuộc nhóm staff", 400);
  }

  staff.is_deleted = true;
  staff.deleted_at = new Date();
  await staff.save();

  await sendStaffDeletedEmail({
    to: staff.email,
    role: staff.role,
  });

  return { message: "Xóa mềm staff thành công" };
}

async function listManagers() {
  const managers = await User.find({
    role: ALLOWED_MANAGER_ROLE,
    is_deleted: false,
  })
    .select("-password")
    .sort({ created_at: -1 });

  return managers.map(sanitizeUser);
}

async function createManager({ email, password, status = "active" }) {
  return createStaff({ email, password, role: ALLOWED_MANAGER_ROLE, status });
}

async function updateManager(managerId, payload = {}) {
  const manager = await User.findOne({ _id: managerId, is_deleted: false });
  if (!manager) {
    throw createHttpError("Không tìm thấy manager", 404);
  }

  if (manager.role !== ALLOWED_MANAGER_ROLE) {
    throw createHttpError("Người dùng này không phải manager", 400);
  }

  const updates = {};
  if (payload.status !== undefined) updates.status = payload.status;

  if (!Object.keys(updates).length) {
    throw createHttpError("Không có dữ liệu hợp lệ để cập nhật", 400);
  }

  const updated = await User.findOneAndUpdate(
    { _id: managerId, is_deleted: false },
    { $set: updates },
    { new: true },
  ).select("-password");

  return sanitizeUser(updated);
}

async function deleteManager(managerId) {
  const manager = await User.findOne({ _id: managerId, is_deleted: false });
  if (!manager) {
    throw createHttpError("Không tìm thấy manager", 404);
  }

  if (manager.role !== ALLOWED_MANAGER_ROLE) {
    throw createHttpError("Người dùng này không phải manager", 400);
  }

  manager.is_deleted = true;
  manager.deleted_at = new Date();
  await manager.save();

  await sendStaffDeletedEmail({
    to: manager.email,
    role: manager.role,
  });

  return { message: "Xóa mềm manager thành công" };
}

module.exports = {
  getMyProfile,
  updateMyProfile,
  listStaff,
  createStaff,
  updateStaff,
  deleteStaff,
  listManagers,
  createManager,
  updateManager,
  deleteManager,
};
