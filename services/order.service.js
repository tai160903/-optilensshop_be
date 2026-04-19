const mongoose = require("mongoose");
const Order = require("../models/order.schema");
const OrderItem = require("../models/orderItem.schema");
const Cart = require("../models/cart.schema");
const Payment = require("../models/payment.schema");
const Combo = require("../models/combo.schema");
const momoService = require("./momo.service");
const { addressToString } = require("../utils/address");

function splitComboUnitPrices(frameRetail, lensRetail, comboUnitPrice) {
  const fp = Number(frameRetail) || 0;
  const lp = Number(lensRetail) || 0;
  const sum = fp + lp;
  const unit = Number(comboUnitPrice) || 0;
  if (!sum || sum <= 0) {
    const half = Math.round(unit / 2);
    return { frameUnit: half, lensUnit: unit - half };
  }
  const frameUnit = Math.round((fp / sum) * unit);
  const lensUnit = unit - frameUnit;
  return { frameUnit, lensUnit };
}
// Checkout tổng hợp, trả về order và payUrl nếu momo
exports.checkoutWithPayment = async (userId, orderData) => {
  const order = await exports.createOrderFromCart(userId, orderData);
  let payUrl = null;
  if (orderData.payment_method === "momo") {
    const momoRes = await momoService.createMomoPayment({
      amount: order.total_amount,
      orderId: order._id.toString(),
      orderInfo: `Thanh toán đơn hàng #${order._id}`,
      redirectUrl: process.env.MOMO_REDIRECT_URL,
      ipnUrl: process.env.MOMO_IPN_URL,
    });
    payUrl = momoRes.payUrl || momoRes.deeplink || null;
  }
  return { order, payUrl };
};

exports.createOrderFromCart = async (userId, orderData) => {
  const cart = await Cart.findOne({ user_id: userId });
  if (!cart || !cart.items.length) throw new Error("Giỏ hàng trống");
  const selectedItems =
    Array.isArray(orderData.items) && orderData.items.length
      ? orderData.items
      : cart.items.map((i) => {
          if (i.combo_id) {
            return { combo_id: i.combo_id.toString(), quantity: i.quantity };
          }
          return {
            variant_id: i.variant_id.toString(),
            quantity: i.quantity,
          };
        });
  const ProductVariant = require("../models/productVariant.schema");
  const itemsToOrder = [];
  let total = 0;
  for (const sel of selectedItems) {
    if (sel.combo_id) {
      const found = cart.items.find(
        (i) => i.combo_id && i.combo_id.toString() === sel.combo_id,
      );
      if (!found) {
        throw new Error("Item combo trong cart không hợp lệ hoặc thiếu số lượng");
      }
      const orderQty =
        sel.quantity !== undefined
          ? Number(sel.quantity)
          : Number(found.quantity);
      if (orderQty <= 0 || orderQty > Number(found.quantity)) {
        throw new Error("Số lượng đặt combo không hợp lệ");
      }
      const combo = await Combo.findOne({
        _id: found.combo_id,
        is_active: true,
      });
      if (!combo) throw new Error("Combo không còn hiệu lực");
      const [frame, lens] = await Promise.all([
        ProductVariant.findById(combo.frame_variant_id),
        ProductVariant.findById(combo.lens_variant_id),
      ]);
      if (!frame || !lens) {
        throw new Error("Không tìm thấy biến thể trong combo");
      }
      if (orderQty > frame.stock_quantity || orderQty > lens.stock_quantity) {
        throw new Error("Số lượng combo vượt tồn kho");
      }
      const { frameUnit, lensUnit } = splitComboUnitPrices(
        frame.price,
        lens.price,
        combo.combo_price,
      );
      const combo_group_id = new mongoose.Types.ObjectId();
      itemsToOrder.push({
        kind: "combo",
        quantity: orderQty,
        frame_variant_id: frame._id,
        lens_variant_id: lens._id,
        frame_unit_price: frameUnit,
        lens_unit_price: lensUnit,
        lens_params: found.lens_params,
        combo_id: combo._id,
        combo_group_id,
      });
      total += (combo.combo_price || 0) * orderQty;
    } else {
      const found = cart.items.find(
        (i) => i.variant_id && i.variant_id.toString() === sel.variant_id,
      );
      if (!found) {
        throw new Error("Item trong cart không hợp lệ hoặc thiếu số lượng");
      }
      const orderQty =
        sel.quantity !== undefined
          ? Number(sel.quantity)
          : Number(found.quantity);
      if (orderQty <= 0 || orderQty > Number(found.quantity)) {
        throw new Error("Số lượng đặt không hợp lệ");
      }
      const variant = await ProductVariant.findById(found.variant_id);
      if (!variant) throw new Error("Không tìm thấy biến thể sản phẩm");
      itemsToOrder.push({
        kind: "variant",
        ...found.toObject(),
        quantity: orderQty,
        price: variant.price,
      });
      total += (variant.price || 0) * orderQty;
    }
  }

  let shippingAddressStr = "";
  if (
    orderData.shipping_address &&
    typeof orderData.shipping_address === "object"
  ) {
    shippingAddressStr = addressToString(orderData.shipping_address);
  } else {
    shippingAddressStr = orderData.shipping_address || "";
  }
  const order = new Order({
    user_id: userId,
    order_type: orderData.order_type,
    status: "pending",
    total_amount: total,
    shipping_fee: orderData.shipping_method === "ship" ? 30000 : 0,
    shipping_address: shippingAddressStr,
  });
  await order.save();
  for (const item of itemsToOrder) {
    if (item.kind === "combo") {
      await new OrderItem({
        order_id: order._id,
        variant_id: item.frame_variant_id,
        quantity: item.quantity,
        unit_price: item.frame_unit_price,
        lens_params: item.lens_params,
        combo_id: item.combo_id,
        combo_group_id: item.combo_group_id,
      }).save();
      await new OrderItem({
        order_id: order._id,
        variant_id: item.lens_variant_id,
        quantity: item.quantity,
        unit_price: item.lens_unit_price,
        lens_params: item.lens_params,
        combo_id: item.combo_id,
        combo_group_id: item.combo_group_id,
      }).save();
    } else {
      await new OrderItem({
        order_id: order._id,
        variant_id: item.variant_id,
        quantity: item.quantity,
        unit_price: item.price || 0,
        lens_params: item.lens_params,
      }).save();
    }
  }
  await new Payment({
    order_id: order._id,
    amount: total,
    method: orderData.payment_method,
    status: orderData.payment_method === "cod" ? "pending" : "pending",
  }).save();
  cart.items = cart.items.reduce((arr, i) => {
    const plain = i.toObject ? i.toObject() : { ...i };
    const sel = selectedItems.find((s) => {
      if (s.combo_id && plain.combo_id) {
        return String(s.combo_id) === String(plain.combo_id);
      }
      if (s.variant_id && plain.variant_id) {
        return String(s.variant_id) === String(plain.variant_id);
      }
      return false;
    });
    if (!sel) {
      arr.push({
        variant_id: plain.variant_id,
        combo_id: plain.combo_id,
        quantity: plain.quantity,
        lens_params: plain.lens_params,
      });
      return arr;
    }
    const requestedQty =
      sel.quantity !== undefined ? Number(sel.quantity) : Number(plain.quantity);
    const remain = Number(plain.quantity) - requestedQty;
    if (remain > 0) {
      arr.push({
        variant_id: plain.variant_id,
        combo_id: plain.combo_id,
        quantity: remain,
        lens_params: plain.lens_params,
      });
    }
    return arr;
  }, []);
  cart.updated_at = Date.now();
  await cart.save();
  return order;
};

exports.updateOrderStatus = async (orderId, newStatus, userRole) => {
  const order = await Order.findById(orderId);
  if (!order) throw new Error("Không tìm thấy đơn hàng");

  if (
    ["processing", "manufacturing", "packed", "shipped", "delivered"].includes(
      newStatus,
    ) &&
    userRole !== "operations"
  ) {
    throw new Error("Chỉ operator được cập nhật trạng thái này");
  }

  // Chuyển trạng thái
  order.status = newStatus;
  await order.save();

  // Nếu giao thành công thì trừ stock_quantity trong ProductVariant
  if (newStatus === "delivered") {
    const ProductVariant = require("../models/productVariant.schema");
    const items = await OrderItem.find({ order_id: orderId });
    for (const item of items) {
      await ProductVariant.updateOne(
        { _id: item.variant_id },
        { $inc: { stock_quantity: -item.quantity } },
      );
    }
  }
  return order;
};

exports.confirmOrder = async (orderId, user) => {
  const order = await Order.findById(orderId);
  if (!order) throw new Error("Không tìm thấy đơn hàng");
  if (order.status !== "pending")
    throw new Error("Chỉ xác nhận đơn ở trạng thái pending");
  if (user.role !== "sales")
    throw new Error("Chỉ nhân viên sale được xác nhận đơn");

  // Nếu có reject thì từ chối đơn
  if (user.reject === true || user.reject === "true") {
    order.status = "cancelled";
    if (user.reject_reason) order.reject_reason = user.reject_reason;
    await order.save();
    return order;
  }

  order.status = "confirmed";
  await order.save();
  return order;
};
