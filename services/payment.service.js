const Payment = require("../models/payment.schema");

exports.success = async (orderId) => {
  try {
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

exports.fail = async (orderId, message) => {
  try {
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
