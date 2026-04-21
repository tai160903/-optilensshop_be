const mongoose = require("mongoose");
const { Schema } = mongoose;

const productReviewSchema = new Schema({
  user_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
  product_id: { type: Schema.Types.ObjectId, ref: "Product", required: true },
  rating: { type: Number, min: 1, max: 5, required: true },
  comment: { type: String },
  images: [{ type: String }],
  created_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model("ProductReview", productReviewSchema);
