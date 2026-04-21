const mongoose = require("mongoose");
const { Schema } = mongoose;

const orderItemSchema = new Schema({
  order_id: { type: Schema.Types.ObjectId, ref: "Order", required: true },
  variant_id: {
    type: Schema.Types.ObjectId,
    ref: "ProductVariant",
    required: true,
  },
  quantity: { type: Number, required: true },
  unit_price: { type: Number, required: true },
  lens_params: { type: Object },

  /** Dòng sinh ra từ combo */
  combo_id:       { type: Schema.Types.ObjectId, ref: "Combo" },
  combo_group_id: { type: Schema.Types.ObjectId },

  /** Loại sản phẩm: frame / lens — dùng để xác định trừ stock timing */
  item_type: {
    type: String,
    enum: ["frame", "lens", null],
    default: null,
  },
});


module.exports = mongoose.model("OrderItem", orderItemSchema);
