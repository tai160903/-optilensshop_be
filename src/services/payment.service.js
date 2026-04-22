const Payment = require("../models/payment.schema");
const Order = require("../models/order.schema");

exports.success = async (orderId) => {
  try {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new Error("Không tìm thấy đơn hàng");
    }
    const payment = await Payment.findOne({ order_id: orderId });
    if (!payment) {
      throw new Error("Không tìm thấy thanh toán");
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

exports.fail = async (orderId) => {
  try {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new Error("Không tìm thấy đơn hàng");
    }

    const payment = await Payment.findOne({ order_id: orderId });
    if (!payment) {
      throw new Error("Không tìm thấy thanh toán");
    }
    payment.status = "failed";
    await payment.save();
    return payment;
  } catch (error) {
    console.log(error);
    throw error;
  }
};
