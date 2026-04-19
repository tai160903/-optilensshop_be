const cartService = require("../services/cart.service");

exports.getCart = async (req, res) => {
  try {
    const cart = await cartService.getCartByUser(req.user.id);
    res.json(cart || { items: [] });
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
      return res
        .status(400)
        .json({ message: "Cần variant_id hoặc combo_id" });
    }
    res.status(200).json({ message: "Thêm vào giỏ thành công", cart });
  } catch (err) {
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
};

exports.updateItem = async (req, res) => {
  try {
    const { quantity, lens_params } = req.body;
    const { id: variant_id } = req.params;
    const cart = await cartService.updateItem(
      req.user.id,
      variant_id,
      quantity,
      lens_params,
    );
    if (!cart)
      return res
        .status(404)
        .json({ message: "Không tìm thấy sản phẩm trong giỏ." });
    res.status(200).json({ message: "Cập nhật sản phẩm thành công", cart });
  } catch (err) {
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
};

exports.removeItem = async (req, res) => {
  try {
    const { id: variant_id } = req.params;
    const cart = await cartService.removeItem(req.user.id, variant_id);
    if (!cart)
      return res
        .status(404)
        .json({ message: "Không tìm thấy sản phẩm trong giỏ." });
    res.status(200).json({ message: "Xóa sản phẩm thành công", cart });
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
    res.status(200).json({ message: "Cập nhật combo trong giỏ thành công", cart });
  } catch (err) {
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
};

exports.removeComboItem = async (req, res) => {
  try {
    const { combo_id } = req.params;
    const cart = await cartService.removeComboItem(req.user.id, combo_id);
    if (!cart) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy giỏ hàng." });
    }
    res.status(200).json({ message: "Xóa combo khỏi giỏ thành công", cart });
  } catch (err) {
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
};

exports.clearCart = async (req, res) => {
  try {
    const cart = await cartService.clearCart(req.user.id);
    res.status(200).json({ message: "Xóa giỏ hàng thành công", cart });
  } catch (err) {
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
};
