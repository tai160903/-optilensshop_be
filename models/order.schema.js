const mongoose = require("mongoose");
const { Schema } = mongoose;

const orderSchema = new Schema({
  user_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
  order_type: {
    type: String,
    enum: ["stock", "preorder", "prescription"],
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
  total_amount: { type: Number, required: true },
  shipping_fee: { type: Number, default: 0 },
  shipping_address: { type: String, required: true },
  created_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Order", orderSchema);
