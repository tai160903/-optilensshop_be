const mongoose = require("mongoose");
const { Schema } = mongoose;

const addressSchema = new Schema(
  {
    full_name: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    is_default: { type: Boolean, default: false },
  },
  { _id: false },
);

const profileSchema = new Schema(
  {
    full_name: { type: String },
    dob: { type: Date },
    gender: { type: String, enum: ["male", "female", "other"] },
    avatar: { type: String },
  },
  { _id: false },
);

const userSchema = new Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ["customer", "sales", "operations", "manager", "admin"],
    default: "customer",
    required: true,
  },
  status: {
    type: String,
    enum: ["active", "inactive", "banned", "pending"],
    default: "active",
  },
  is_deleted: { type: Boolean, default: false },
  deleted_at: { type: Date, default: null },
  profile: profileSchema,
  addresses: [addressSchema],
  is_email_verified: { type: Boolean, default: false },
  email_verification_token: { type: String, default: null },
  email_verification_expires: { type: Date, default: null },
  reset_password_token: { type: String, default: null },
  reset_password_expires: { type: Date, default: null },
  created_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model("User", userSchema);
