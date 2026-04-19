const orderService = require("../services/order.service");
const momoService = require("../services/momo.service");

exports.checkout = async (req, res) => {
  try {
    const {
      shipping_address,
      order_type,
      payment_method,
      shipping_method,
      items,
    } = req.body;
    const { order, payUrl } = await orderService.checkoutWithPayment(
      req.user.id,
      {
        shipping_address,
        order_type,
        payment_method,
        shipping_method,
        items,
      },
    );
    res.status(201).json({ message: "Đặt hàng thành công", order, payUrl });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.confirmOrder = async (req, res, next) => {
  try {
    // Nếu body có reject thì truyền vào service
    const userWithReject = {
      ...req.user,
      reject: req.body.reject,
      reject_reason: req.body.reject_reason,
    };
    const order = await orderService.confirmOrder(
      req.params.id,
      userWithReject,
    );
    if (req.body.reject) {
      res.json({ message: "Đơn hàng đã bị từ chối", order });
    } else {
      res.json({ message: "Đơn hàng đã được xác nhận", order });
    }
  } catch (err) {
    next(err);
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userRole = req.user.role;
    const order = await orderService.updateOrderStatus(id, status, userRole);
    res.json({ message: "Cập nhật trạng thái thành công", order });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
