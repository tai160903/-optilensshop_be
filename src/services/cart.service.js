const Cart = require("../models/cart.schema");
const ProductVariant = require("../models/productVariant.schema");
const Combo = require("../models/combo.schema");
const mongoose = require("mongoose");
const { sanitizeLensParams } = require("../utils/lens-params");

function populateCartQuery(query) {
  return query.populate("items.variant_id").populate({
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
  const safeLensParams = sanitizeLensParams(lens_params);
  if (!mongoose.Types.ObjectId.isValid(variant_id)) {
    throw new Error("variant_id không hợp lệ");
  }
  const variant = await ProductVariant.findById(variant_id).populate("product_id");
  if (!variant) {
    throw new Error("Không tìm thấy biến thể sản phẩm");
  }

  // ── Validate stock_type ─────────────────────────────────────
  // discontinued: không được thêm vào giỏ
  if (variant.stock_type === "discontinued") {
    throw new Error("Sản phẩm này đã ngừng kinh doanh");
  }

  let cart = await Cart.findOne({ user_id: userId });
  if (!cart) {
    cart = await Cart.create({ user_id: userId, items: [] });
  }

  const idxExisting = cart.items.findIndex(
    (i) => i.variant_id && i.variant_id.toString() === variant_id,
  );
  let currentQty = Number(cart.items[idxExisting]?.quantity || 0);
  const totalQty = currentQty + Number(quantity);

  // ── in_stock: kiểm tra tồn kho ─────────────────────────────
  if (variant.stock_type === "in_stock") {
    const available = variant.available_quantity ?? variant.stock_quantity;
    if (totalQty > available) {
      throw new Error(`Số lượng vượt quá tồn kho (${available})`);
    }
  }
  // preorder: không check stock_quantity (đặt trước)
  // → sẽ reserve khi checkout

  if (idxExisting > -1) {
    cart.items[idxExisting].quantity = totalQty;
    if (safeLensParams) cart.items[idxExisting].lens_params = safeLensParams;
    // Cập nhật price_snapshot nếu giá thay đổi (lấy giá mới nhất)
    cart.items[idxExisting].price_snapshot = variant.price;
  } else {
    cart.items.push({
      variant_id,
      quantity: Number(quantity),
      lens_params: safeLensParams,
      price_snapshot: variant.price, // ← Lưu giá tại thời điểm thêm
    });
  }
  cart.updated_at = new Date();
  await cart.save();
  return cart;
};

exports.addComboItem = async (userId, combo_id, quantity, lens_params) => {
  const safeLensParams = sanitizeLensParams(lens_params);
  if (!mongoose.Types.ObjectId.isValid(combo_id)) {
    throw new Error("combo_id không hợp lệ");
  }
  const combo = await Combo.findOne({ _id: combo_id, is_active: true })
    .populate("frame_variant_id")
    .populate("lens_variant_id");
  if (!combo) {
    throw new Error("Không tìm thấy combo hoặc combo đã ngừng bán");
  }

  const frame = combo.frame_variant_id;
  const lens = combo.lens_variant_id;
  if (!frame || !lens) {
    throw new Error("Combo thiếu biến thể gọng hoặc tròng");
  }

  // ── Validate stock_type ─────────────────────────────────────
  if (frame.stock_type === "discontinued" || lens.stock_type === "discontinued") {
    throw new Error("Sản phẩm trong combo đã ngừng kinh doanh");
  }

  let cart = await Cart.findOne({ user_id: userId });
  if (!cart) {
    cart = await Cart.create({ user_id: userId, items: [] });
  }

  const idxExisting = cart.items.findIndex(
    (i) => i.combo_id && i.combo_id.toString() === combo_id,
  );
  let currentQty = Number(cart.items[idxExisting]?.quantity || 0);
  const totalQty = currentQty + Number(quantity);

  // in_stock: kiểm tra tồn kho cho cả gọng và tròng
  if (frame.stock_type === "in_stock") {
    const fAvailable = frame.available_quantity ?? frame.stock_quantity;
    if (totalQty > fAvailable) {
      throw new Error(`Số lượng vượt tồn kho gọng (${fAvailable})`);
    }
  }
  if (lens.stock_type === "in_stock") {
    const lAvailable = lens.available_quantity ?? lens.stock_quantity;
    if (totalQty > lAvailable) {
      throw new Error(`Số lượng vượt tồn kho tròng (${lAvailable})`);
    }
  }
  // preorder: không check stock (đặt trước)

  if (idxExisting > -1) {
    cart.items[idxExisting].quantity = totalQty;
    if (safeLensParams) cart.items[idxExisting].lens_params = safeLensParams;
    // Cập nhật combo_price_snapshot nếu giá thay đổi
    cart.items[idxExisting].combo_price_snapshot = combo.combo_price;
  } else {
    cart.items.push({
      combo_id,
      quantity: Number(quantity),
      lens_params: safeLensParams,
      combo_price_snapshot: combo.combo_price, // ← Lưu giá combo tại thời điểm thêm
    });
  }
  cart.updated_at = new Date();
  await cart.save();
  return cart;
};

exports.updateItem = async (userId, variant_id, quantity, lens_params) => {
  const safeLensParams = sanitizeLensParams(lens_params);
  if (!mongoose.Types.ObjectId.isValid(variant_id)) {
    throw new Error("variant_id không hợp lệ");
  }
  const variant = await ProductVariant.findById(variant_id).populate("product_id");
  if (!variant) {
    throw new Error("Không tìm thấy biến thể sản phẩm");
  }
  if (variant.stock_type === "discontinued") {
    throw new Error("Sản phẩm này đã ngừng kinh doanh");
  }
  const cart = await Cart.findOne({ user_id: userId });
  if (!cart) return null;
  const idx = cart.items.findIndex(
    (i) => i.variant_id && i.variant_id.toString() === variant_id,
  );
  if (idx > -1) {
    if (variant.stock_type === "in_stock") {
      const available = variant.available_quantity ?? variant.stock_quantity;
      if (Number(quantity) > available) {
        throw new Error(`Số lượng vượt quá tồn kho (${available})`);
      }
    }
    cart.items[idx].quantity = quantity;
    if (safeLensParams) cart.items[idx].lens_params = safeLensParams;
    cart.items[idx].price_snapshot = variant.price; // cập nhật giá mới nhất
    cart.updated_at = new Date();
    await cart.save();
    return cart;
  }
  return null;
};

exports.updateComboItem = async (userId, combo_id, quantity, lens_params) => {
  const safeLensParams = sanitizeLensParams(lens_params);
  if (!mongoose.Types.ObjectId.isValid(combo_id)) {
    throw new Error("combo_id không hợp lệ");
  }
  const combo = await Combo.findOne({ _id: combo_id, is_active: true })
    .populate("frame_variant_id")
    .populate("lens_variant_id");
  if (!combo) {
    throw new Error("Không tìm thấy combo hoặc combo đã ngừng bán");
  }
  const frame = combo.frame_variant_id;
  const lens = combo.lens_variant_id;
  if (!frame || !lens) {
    throw new Error("Combo thiếu biến thể gọng hoặc tròng");
  }
  if (frame.stock_type === "discontinued" || lens.stock_type === "discontinued") {
    throw new Error("Sản phẩm trong combo đã ngừng kinh doanh");
  }
  const cart = await Cart.findOne({ user_id: userId });
  if (!cart) return null;
  const idx = cart.items.findIndex(
    (i) => i.combo_id && i.combo_id.toString() === combo_id,
  );
  if (idx > -1) {
    const q = Number(quantity);
    if (frame.stock_type === "in_stock") {
      const fAvailable = frame.available_quantity ?? frame.stock_quantity;
      if (q > fAvailable) {
        throw new Error(`Số lượng vượt tồn kho gọng (${fAvailable})`);
      }
    }
    if (lens.stock_type === "in_stock") {
      const lAvailable = lens.available_quantity ?? lens.stock_quantity;
      if (q > lAvailable) {
        throw new Error(`Số lượng vượt tồn kho tròng (${lAvailable})`);
      }
    }
    cart.items[idx].quantity = q;
    if (safeLensParams) cart.items[idx].lens_params = safeLensParams;
    cart.items[idx].combo_price_snapshot = combo.combo_price; // cập nhật giá mới nhất
    cart.updated_at = new Date();
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
  cart.updated_at = new Date();
  await cart.save();
  return cart;
};

exports.removeComboItem = async (userId, combo_id) => {
  const cart = await Cart.findOne({ user_id: userId });
  if (!cart) return null;
  cart.items = cart.items.filter(
    (i) => !(i.combo_id && i.combo_id.toString() === combo_id),
  );
  cart.updated_at = new Date();
  await cart.save();
  return cart;
};

exports.clearCart = async (userId) => {
  const cart = await Cart.findOne({ user_id: userId });
  if (!cart) return null;
  cart.items = [];
  cart.updated_at = new Date();
  await cart.save();
  return cart;
};
