const mongoose = require("mongoose");
const { Schema } = mongoose;

const cartItemSchema = new Schema(
  {
    variant_id: {
      type: Schema.Types.ObjectId,
      ref: "ProductVariant",
    },
    combo_id: {
      type: Schema.Types.ObjectId,
      ref: "Combo",
    },
    quantity: { type: Number, required: true, min: 1 },
    lens_params: { type: Object }, // Dùng cho prescription nếu có
  },
  { _id: false },
);

const cartSchema = new Schema({
  user_id: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },
  items: [cartItemSchema],
  updated_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Cart", cartSchema);
