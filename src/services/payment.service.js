const Payment = require("../models/payment.schema");
const Order = require("../models/order.schema");

function canManagePayment(user, order) {
  const privilegedRoles = ["admin", "manager", "sales", "operations"];
  if (privilegedRoles.includes(user?.role)) return true;
  if (!user?._id && !user?.id) return false;
  const requesterId = user._id || user.id;
  return order.user_id.toString() === requesterId.toString();
}

exports.success = async (orderId, user) => {
  try {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new Error("Order not found");
    }
    if (!canManagePayment(user, order)) {
      throw new Error("Bạn không có quyền cập nhật thanh toán đơn này");
    }
    const payment = await Payment.findOne({ order_id: orderId });
    if (!payment) {
      throw new Error("Payment record not found");
    }
    payment.status = "paid";
    payment.paid_at = new Date();
    await payment.save();
    return payment;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

exports.fail = async (orderId, message, user) => {
  try {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new Error("Order not found");
    }
    if (!canManagePayment(user, order)) {
      throw new Error("Bạn không có quyền cập nhật thanh toán đơn này");
    }
    const payment = await Payment.findOne({ order_id: orderId });
    if (!payment) {
      throw new Error("Payment record not found");
    }
    payment.status = "failed";
    await payment.save();
    return payment;
  } catch (error) {
    console.log(error);
    throw error;
  }
};
