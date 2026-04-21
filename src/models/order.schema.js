const mongoose = require("mongoose");
const { Schema } = mongoose;

const orderSchema = new Schema({
  user_id: { type: Schema.Types.ObjectId, ref: "User", required: true },

  order_type: {
    type: String,
    enum: ["stock", "pre_order", "prescription"],
    required: true,
  },

  status: {
    type: String,
    enum: [
      "pending",
      "confirmed",
      "processing",
      "manufacturing",
      "packed",
      "shipped",
      "delivered",
      "completed",
      "cancelled",
      "return_requested",
      "returned",
      "refunded",
    ],
    default: "pending",
  },

  total_amount:   { type: Number, required: true },
  shipping_fee:    { type: Number, default: 0 },
  discount_amount: { type: Number, default: 0 },
  final_amount:    { type: Number, default: 0 },
  shipping_address: { type: String, required: true },

  /** Đơn có cần gia công tròng không (true khi order_type = prescription) */
  requires_fabrication: { type: Boolean, default: false },

  /** Lý do hủy / từ chối (do sales/ops ghi) */
  cancel_reason: { type: String },
  reject_reason: { type: String },

  created_at: { type: Date, default: Date.now },
}, {
  timestamps: { createdAt: false, updatedAt: true },
});

// Đảm bảo requires_fabrication luôn sync với order_type
orderSchema.pre("save", function (next) {
  this.requires_fabrication = this.order_type === "prescription";
  this.final_amount =
    (this.total_amount || 0) -
    (this.discount_amount || 0) +
    (this.shipping_fee || 0);
  next();
});

module.exports = mongoose.model("Order", orderSchema);
