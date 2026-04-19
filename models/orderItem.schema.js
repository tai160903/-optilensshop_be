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
  lens_params: { type: Object }, // Dùng cho prescription nếu có
  /** Nếu dòng đơn sinh ra từ combo: tham chiếu combo + nhóm 2 dòng cùng bundle */
  combo_id: { type: Schema.Types.ObjectId, ref: "Combo" },
  combo_group_id: { type: Schema.Types.ObjectId },
});

module.exports = mongoose.model("OrderItem", orderItemSchema);
