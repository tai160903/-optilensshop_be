const mongoose = require("mongoose");
const { Schema } = mongoose;

const productVariantSchema = new Schema(
  {
    product_id: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    sku: { type: String, required: true, unique: true },
    attributes: { type: Object, default: {} },

    /** Loại tồn kho:
     *  in_stock      — có sẵn, bán và giao ngay
     *  preorder      — hết hàng, cần đặt nhà cung cấp
     *  discontinued  — ngừng kinh doanh
     */
    stock_type: {
      type: String,
      enum: ["in_stock", "preorder", "discontinued"],
      default: "in_stock",
    },

    /** Số lượng đã được đặt (reserved) nhưng chưa nhận hàng.
     *  Dùng cho pre-order: khi đặt hàng → tăng reserved_quantity;
     *  khi hàng về kho → tăng stock_quantity, giảm reserved_quantity.
     */
    reserved_quantity: { type: Number, default: 0 },

    price: { type: Number, required: true },
    stock_quantity: { type: Number, default: 0 },
    images: [{ type: String }],
  },
  { timestamps: true },
);

// Virtual: số lượng thực sự có thể bán (available = stock - reserved)
productVariantSchema.virtual("available_quantity").get(function () {
  return Math.max(0, this.stock_quantity - this.reserved_quantity);
});


module.exports = mongoose.model("ProductVariant", productVariantSchema);
