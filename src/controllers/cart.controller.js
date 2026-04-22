const cartService = require("../services/cart.service");

function buildCartPayload(cart) {
  const safeCart = cart || { items: [] };
  const items = safeCart.items || [];
  const totalAmount = items.reduce((sum, item) => {
    const unitPrice =
      Number(item.combo_price_snapshot ?? item.price_snapshot ?? 0) || 0;
    const qty = Number(item.quantity || 0) || 0;
    return sum + unitPrice * qty;
  }, 0);
  return { success: true, items, totalAmount };
}

exports.getCart = async (req, res) => {
  try {
    const cart = await cartService.getCartByUser(req.user.id);
    res.status(200).json(buildCartPayload(cart));
  } catch (err) {
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
};

exports.addItem = async (req, res) => {
  try {
    const { variant_id, combo_id, quantity, lens_params } = req.body;
    let cart;
    if (combo_id) {
      cart = await cartService.addComboItem(
        req.user.id,
        combo_id,
        quantity,
        lens_params,
      );
    } else if (variant_id) {
      cart = await cartService.addItem(
        req.user.id,
        variant_id,
        quantity,
        lens_params,
      );
    } else {
      return res.status(400).json({ message: "Cần variant_id hoặc combo_id" });
    }
    res.status(200).json(buildCartPayload(cart.cart || cart));
  } catch (err) {
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
};

exports.updateItem = async (req, res) => {
  try {
    const { quantity, lens_params } = req.body;
    const { cartLineId } = req.params;
    const cart = await cartService.updateItemByLineId(
      req.user.id,
      cartLineId,
      quantity,
      lens_params,
    );
    if (!cart)
      return res
        .status(404)
        .json({ message: "Không tìm thấy sản phẩm trong giỏ." });
    res.status(200).json(buildCartPayload(cart));
  } catch (err) {
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
};

exports.removeItem = async (req, res) => {
  try {
    const { cartLineId } = req.params;
    const cart = await cartService.removeItemByLineId(req.user.id, cartLineId);
    if (!cart)
      return res
        .status(404)
        .json({ message: "Không tìm thấy sản phẩm trong giỏ." });
    res.status(200).json(buildCartPayload(cart));
  } catch (err) {
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
};

exports.updateComboItem = async (req, res) => {
  try {
    const { quantity, lens_params } = req.body;
    const { combo_id } = req.params;
    const cart = await cartService.updateComboItem(
      req.user.id,
      combo_id,
      quantity,
      lens_params,
    );
    if (!cart) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy combo trong giỏ." });
    }
    res.status(200).json(buildCartPayload(cart));
  } catch (err) {
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
};

exports.removeComboItem = async (req, res) => {
  try {
    const { combo_id } = req.params;
    const cart = await cartService.removeComboItem(req.user.id, combo_id);
    if (!cart) {
      return res.status(404).json({ message: "Không tìm thấy giỏ hàng." });
    }
    res.status(200).json(buildCartPayload(cart));
  } catch (err) {
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
};

exports.clearCart = async (req, res) => {
  try {
    const cart = await cartService.clearCart(req.user.id);
    res.status(200).json(buildCartPayload(cart));
  } catch (err) {
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
};
