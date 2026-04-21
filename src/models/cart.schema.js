const mongoose = require("mongoose");
const { Schema } = mongoose;

const cartItemSchema = new Schema(
  {
    variant_id: {
      type: Schema.Types.ObjectId,
      ref: "ProductVariant",
      default: null,
    },
    combo_id: {
      type: Schema.Types.ObjectId,
      ref: "Combo",
      default: null,
    },
    quantity: { type: Number, required: true, min: 1 },
    lens_params: { type: Object },

    /** Giá tại thời điểm thêm vào giỏ — chống thay đổi giá giữa chừng */
    price_snapshot: { type: Number },
    combo_price_snapshot: { type: Number },
  },
  {
    _id: false,

    // Validator: phải có đúng 1 trong 2 (variant_id XOR combo_id)
    validate: {
      validator: function () {
        const hasVariant = !!this.variant_id;
        const hasCombo   = !!this.combo_id;
        // XOR: đúng khi chỉ một trong hai là true
        return hasVariant !== hasCombo;
      },
      message:
        "Cart item phải có đúng một trong hai: variant_id hoặc combo_id",
    },
  },
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
