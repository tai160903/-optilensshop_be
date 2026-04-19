const mongoose = require("mongoose");
const { Schema } = mongoose;

const productVariantSchema = new Schema(
  {
    product_id: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    sku: { type: String, required: true, unique: true },
    attributes: { type: Object, default: {} }, // e.g. { color, size }
    price: { type: Number, required: true },
    stock_quantity: { type: Number, default: 0 },
    images: [{ type: String }],
  },
  { timestamps: true },
);

module.exports = mongoose.model("ProductVariant", productVariantSchema);
