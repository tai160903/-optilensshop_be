const Cart = require("../models/cart.schema");
const ProductVariant = require("../models/productVariant.schema");
const Combo = require("../models/combo.schema");
const mongoose = require("mongoose");

function populateCartQuery(query) {
  return query
    .populate("items.variant_id")
    .populate({
      path: "items.combo_id",
      populate: [
        {
          path: "frame_variant_id",
          populate: { path: "product_id", select: "name slug type" },
        },
        {
          path: "lens_variant_id",
          populate: { path: "product_id", select: "name slug type" },
        },
      ],
    });
}

exports.getCartByUser = async (userId) => {
  let cart = await populateCartQuery(Cart.findOne({ user_id: userId }));
  if (!cart) {
    await Cart.create({ user_id: userId, items: [] });
    cart = await populateCartQuery(Cart.findOne({ user_id: userId }));
  }
  return cart;
};

exports.addItem = async (userId, variant_id, quantity, lens_params) => {
  if (!mongoose.Types.ObjectId.isValid(variant_id)) {
    throw new Error("variant_id không hợp lệ");
  }
  const variant = await ProductVariant.findById(variant_id);
  if (!variant) {
    throw new Error("Không tìm thấy biến thể sản phẩm");
  }
  let cart = await Cart.findOne({ user_id: userId });
  if (!cart) {
    cart = await Cart.create({ user_id: userId, items: [] });
  }
  let currentQty = 0;
  const idxExisting = cart.items.findIndex(
    (i) => i.variant_id && i.variant_id.toString() === variant_id,
  );
  if (idxExisting > -1) {
    currentQty = Number(cart.items[idxExisting].quantity || 0);
  }
  const totalQty = Number(currentQty) + Number(quantity);
  if (totalQty > variant.stock_quantity) {
    throw new Error(`Số lượng vượt quá tồn kho (${variant.stock_quantity})`);
  }

  if (idxExisting > -1) {
    cart.items[idxExisting].quantity =
      Number(cart.items[idxExisting].quantity || 0) + Number(quantity);
    if (lens_params) cart.items[idxExisting].lens_params = lens_params;
  } else {
    cart.items.push({
      variant_id,
      quantity: Number(quantity),
      lens_params,
    });
  }
  cart.updated_at = Date.now();
  await cart.save();
  return cart;
};

exports.addComboItem = async (userId, combo_id, quantity, lens_params) => {
  if (!mongoose.Types.ObjectId.isValid(combo_id)) {
    throw new Error("combo_id không hợp lệ");
  }
  const combo = await Combo.findOne({ _id: combo_id, is_active: true });
  if (!combo) {
    throw new Error("Không tìm thấy combo hoặc combo đã ngừng bán");
  }
  const [frame, lens] = await Promise.all([
    ProductVariant.findById(combo.frame_variant_id),
    ProductVariant.findById(combo.lens_variant_id),
  ]);
  if (!frame || !lens) {
    throw new Error("Combo thiếu biến thể gọng hoặc tròng");
  }

  let cart = await Cart.findOne({ user_id: userId });
  if (!cart) {
    cart = await Cart.create({ user_id: userId, items: [] });
  }

  const idxExisting = cart.items.findIndex(
    (i) => i.combo_id && i.combo_id.toString() === combo_id,
  );
  let currentQty = 0;
  if (idxExisting > -1) {
    currentQty = Number(cart.items[idxExisting].quantity || 0);
  }
  const totalQty = currentQty + Number(quantity);
  if (totalQty > frame.stock_quantity || totalQty > lens.stock_quantity) {
    throw new Error(
      `Số lượng combo vượt tồn kho (gọng: ${frame.stock_quantity}, tròng: ${lens.stock_quantity})`,
    );
  }

  if (idxExisting > -1) {
    cart.items[idxExisting].quantity =
      Number(cart.items[idxExisting].quantity || 0) + Number(quantity);
    if (lens_params) cart.items[idxExisting].lens_params = lens_params;
  } else {
    cart.items.push({
      combo_id,
      quantity: Number(quantity),
      lens_params,
    });
  }
  cart.updated_at = Date.now();
  await cart.save();
  return cart;
};

exports.updateItem = async (userId, variant_id, quantity, lens_params) => {
  if (!mongoose.Types.ObjectId.isValid(variant_id)) {
    throw new Error("variant_id không hợp lệ");
  }
  const variant = await ProductVariant.findById(variant_id);
  if (!variant) {
    throw new Error("Không tìm thấy biến thể sản phẩm");
  }
  const cart = await Cart.findOne({ user_id: userId });
  if (!cart) return null;
  const idx = cart.items.findIndex(
    (i) => i.variant_id && i.variant_id.toString() === variant_id,
  );
  if (idx > -1) {
    if (Number(quantity) > variant.stock_quantity) {
      throw new Error(`Số lượng vượt quá tồn kho (${variant.stock_quantity})`);
    }
    cart.items[idx].quantity = quantity;
    if (lens_params) cart.items[idx].lens_params = lens_params;
    cart.updated_at = Date.now();
    await cart.save();
    return cart;
  }
  return null;
};

exports.updateComboItem = async (userId, combo_id, quantity, lens_params) => {
  if (!mongoose.Types.ObjectId.isValid(combo_id)) {
    throw new Error("combo_id không hợp lệ");
  }
  const combo = await Combo.findOne({ _id: combo_id, is_active: true });
  if (!combo) {
    throw new Error("Không tìm thấy combo hoặc combo đã ngừng bán");
  }
  const [frame, lens] = await Promise.all([
    ProductVariant.findById(combo.frame_variant_id),
    ProductVariant.findById(combo.lens_variant_id),
  ]);
  if (!frame || !lens) {
    throw new Error("Combo thiếu biến thể gọng hoặc tròng");
  }
  const cart = await Cart.findOne({ user_id: userId });
  if (!cart) return null;
  const idx = cart.items.findIndex(
    (i) => i.combo_id && i.combo_id.toString() === combo_id,
  );
  if (idx > -1) {
    const q = Number(quantity);
    if (q > frame.stock_quantity || q > lens.stock_quantity) {
      throw new Error(
        `Số lượng combo vượt tồn kho (gọng: ${frame.stock_quantity}, tròng: ${lens.stock_quantity})`,
      );
    }
    cart.items[idx].quantity = q;
    if (lens_params) cart.items[idx].lens_params = lens_params;
    cart.updated_at = Date.now();
    await cart.save();
    return cart;
  }
  return null;
};

exports.removeItem = async (userId, variant_id) => {
  const cart = await Cart.findOne({ user_id: userId });
  if (!cart) return null;
  cart.items = cart.items.filter(
    (i) => !(i.variant_id && i.variant_id.toString() === variant_id),
  );
  cart.updated_at = Date.now();
  await cart.save();
  return cart;
};

exports.removeComboItem = async (userId, combo_id) => {
  const cart = await Cart.findOne({ user_id: userId });
  if (!cart) return null;
  cart.items = cart.items.filter(
    (i) => !(i.combo_id && i.combo_id.toString() === combo_id),
  );
  cart.updated_at = Date.now();
  await cart.save();
  return cart;
};

exports.clearCart = async (userId) => {
  const cart = await Cart.findOne({ user_id: userId });
  if (!cart) return null;
  cart.items = [];
  cart.updated_at = Date.now();
  await cart.save();
  return cart;
};
