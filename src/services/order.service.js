const mongoose = require("mongoose");
const Order = require("../models/order.schema");
const OrderItem = require("../models/orderItem.schema");
const Cart = require("../models/cart.schema");
const Payment = require("../models/payment.schema");
const Combo = require("../models/combo.schema");
const momoService = require("./momo.service");
const { addressToString } = require("../utils/address");

/**
 * Detect order_type từ cart items
 * Quy tắc: PRESCRIPTION > PRE_ORDER > STOCK
 *
 * - Có lens_params (đơn thuốc) → PRESCRIPTION
 * - Có variant preorder / combo frame preorder → PRE_ORDER
 * - Còn lại → STOCK
 *
 * @param {Array} cartItems  - Mảng cart items (đã populate variant/combo)
 * @param {Object} comboMap  - Map combo_id → combo data (option)
 * @returns {"stock"|"pre_order"|"prescription"}
 */
function determineOrderType(cartItems, comboMap = {}) {
  // 1️⃣ PRESCRIPTION — có lens_params (đơn thuốc)
  for (const item of cartItems) {
    if (item.lens_params && Object.keys(item.lens_params).length > 0) {
      return "prescription";
    }
  }

  // 2️⃣ PRE_ORDER — variant hoặc combo frame có stock_type = preorder
  for (const item of cartItems) {
    // Kiểm tra combo
    if (item.combo_id) {
      const comboId = item.combo_id.toString
        ? item.combo_id.toString()
        : item.combo_id;
      const combo = comboMap[comboId] || item.combo_id;

      // Lấy frame từ populated combo hoặc từ comboMap
      const frame =
        combo?.frame_variant_id?.stock_type !== undefined
          ? combo.frame_variant_id
          : combo?.stock_type !== undefined
          ? combo
          : null;

      if (frame?.stock_type === "preorder") {
        return "pre_order";
      }
    }

    // Kiểm tra variant
    if (item.variant_id?.stock_type === "preorder") {
      return "pre_order";
    }
  }

  // 3️⃣ STOCK — mặc định
  return "stock";
}

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
  const ProductVariant = require("../models/productVariant.schema");
  const PrescriptionOrder = require("../models/prescriptionOrder.schema");

  // ── 1. Lấy cart ────────────────────────────────────────────────
  let cart = await Cart.findOne({ user_id: userId }).populate({
    path: "items.combo_id",
    populate: [
      { path: "frame_variant_id", select: "stock_type stock_quantity" },
      { path: "lens_variant_id", select: "stock_type stock_quantity" },
    ],
  });

  if (!cart || !cart.items.length) throw new Error("Giỏ hàng trống");

  // ── 2. Chọn items đặt hàng (hoặc lấy toàn bộ cart) ─────────────
  const selectedItems = (Array.isArray(orderData.items) && orderData.items.length)
    ? orderData.items
    : cart.items.map((i) => ({
        combo_id:   i.combo_id   ? i.combo_id.toString()   : null,
        variant_id: i.variant_id ? i.variant_id.toString() : null,
        quantity:   i.quantity,
        lens_params: i.lens_params || null,
      }));

  // ── 3. Detect order_type TỰ ĐỘNG từ cart ───────────────────────
  // Quy tắc: PRESCRIPTION > PRE_ORDER > STOCK
  let order_type = "stock";

  for (const sel of selectedItems) {
    // Ưu tiên 1: Có lens_params → PRESCRIPTION
    if (sel.lens_params && Object.keys(sel.lens_params).length > 0) {
      order_type = "prescription";
      break;
    }
  }

  // Ưu tiên 2: Có variant hoặc combo frame preorder → PRE_ORDER
  if (order_type === "stock") {
    for (const sel of selectedItems) {
      if (sel.combo_id) {
        const found = cart.items.find(
          (i) => i.combo_id && i.combo_id.toString() === sel.combo_id,
        );
        const combo = found?.combo_id;
        if (combo?.frame_variant_id?.stock_type === "preorder") {
          order_type = "pre_order";
          break;
        }
      }
      if (sel.variant_id) {
        const found = cart.items.find(
          (i) => i.variant_id && i.variant_id.toString() === sel.variant_id,
        );
        const variant = await ProductVariant.findById(sel.variant_id).select("stock_type");
        if (variant?.stock_type === "preorder") {
          order_type = "pre_order";
          break;
        }
      }
    }
  }

  // ── 4. Validate stock & build itemsToOrder ─────────────────────
  const itemsToOrder = [];
  let total = 0;

  for (const sel of selectedItems) {
    if (sel.combo_id) {
      // --- Combo item ---
      const found = cart.items.find(
        (i) => i.combo_id && i.combo_id.toString() === sel.combo_id,
      );
      if (!found) throw new Error("Item combo trong cart không hợp lệ");

      const combo = await Combo.findOne({ _id: found.combo_id, is_active: true });
      if (!combo) throw new Error("Combo không còn hiệu lực");

      const [frame, lens] = await Promise.all([
        ProductVariant.findById(combo.frame_variant_id),
        ProductVariant.findById(combo.lens_variant_id),
      ]);
      if (!frame || !lens) throw new Error("Không tìm thấy biến thể trong combo");

      const orderQty = Number(sel.quantity ?? found.quantity);
      if (orderQty <= 0) throw new Error("Số lượng đặt combo không hợp lệ");

      // STOCK: check available stock; PRE_ORDER: reserve
      if (order_type !== "pre_order") {
        const fAvail = frame.available_quantity ?? frame.stock_quantity;
        const lAvail = lens.available_quantity ?? lens.stock_quantity;
        if (orderQty > fAvail || orderQty > lAvail) {
          throw new Error("Số lượng combo vượt tồn kho");
        }
      } else {
        // Pre-order: tăng reserved_quantity
        await ProductVariant.updateOne(
          { _id: frame._id },
          { $inc: { reserved_quantity: orderQty } },
        );
        await ProductVariant.updateOne(
          { _id: lens._id },
          { $inc: { reserved_quantity: orderQty } },
        );
      }

      // Dùng combo_price_snapshot (ưu tiên) hoặc combo.combo_price hiện tại
      const effectiveComboPrice =
        found.combo_price_snapshot ?? combo.combo_price;

      const { frameUnit, lensUnit } = splitComboUnitPrices(
        frame.price, lens.price, effectiveComboPrice,
      );
      const combo_group_id = new mongoose.Types.ObjectId();

      itemsToOrder.push({
        kind: "combo",
        quantity: orderQty,
        frame_variant_id: frame._id,
        lens_variant_id: lens._id,
        frame_unit_price: frameUnit,
        lens_unit_price: lensUnit,
        lens_params: sel.lens_params || found.lens_params,
        combo_id: combo._id,
        combo_group_id,
      });
      total += (effectiveComboPrice || 0) * orderQty;

    } else {
      // --- Variant item ---
      const found = cart.items.find(
        (i) => i.variant_id && i.variant_id.toString() === sel.variant_id,
      );
      if (!found) throw new Error("Item trong cart không hợp lệ");

      const variant = await ProductVariant.findById(found.variant_id);
      if (!variant) throw new Error("Không tìm thấy biến thể sản phẩm");

      const orderQty = Number(sel.quantity ?? found.quantity);
      if (orderQty <= 0) throw new Error("Số lượng đặt không hợp lệ");

      // STOCK: check available stock; PRE_ORDER: reserve
      if (order_type !== "pre_order") {
        const available = variant.available_quantity ?? variant.stock_quantity;
        if (orderQty > available) {
          throw new Error("Số lượng vượt tồn kho");
        }
      } else {
        await ProductVariant.updateOne(
          { _id: variant._id },
          { $inc: { reserved_quantity: orderQty } },
        );
      }

      // Dùng price_snapshot (ưu tiên) hoặc variant.price hiện tại
      const effectivePrice = found.price_snapshot ?? variant.price;

      itemsToOrder.push({
        kind: "variant",
        variant_id: variant._id,
        quantity: orderQty,
        price: effectivePrice,
        lens_params: sel.lens_params || found.lens_params,
      });
      total += (effectivePrice || 0) * orderQty;
    }
  }

  // ── 5. Shipping address ────────────────────────────────────────
  let shippingAddressStr = "";
  if (orderData.shipping_address && typeof orderData.shipping_address === "object") {
    shippingAddressStr = addressToString(orderData.shipping_address);
  } else {
    shippingAddressStr = orderData.shipping_address || "";
  }

  // ── 6. Tạo Order ───────────────────────────────────────────────
  const shipping_fee = orderData.shipping_method === "ship" ? 30000 : 0;
  const discount_amount = Number(orderData.discount_amount) || 0;
  const final_amount = total - discount_amount + shipping_fee;

  const order = new Order({
    user_id: userId,
    order_type,                           // ← Tự detect, không lấy từ FE
    status: "pending",
    total_amount: total,
    shipping_fee,
    discount_amount,
    final_amount,
    shipping_address: shippingAddressStr,
    // requires_fabrication tự set trong pre("save") của schema
  });
  await order.save();

  // ── 7. Tạo OrderItems ──────────────────────────────────────────
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
        item_type: "frame",
      }).save();
      await new OrderItem({
        order_id: order._id,
        variant_id: item.lens_variant_id,
        quantity: item.quantity,
        unit_price: item.lens_unit_price,
        lens_params: item.lens_params,
        combo_id: item.combo_id,
        combo_group_id: item.combo_group_id,
        item_type: "lens",
      }).save();
    } else {
      // Xác định item_type từ product
      let item_type = null;
      if (item.variant_id) {
        const pv = await ProductVariant.findById(item.variant_id).populate("product_id");
        if (pv?.product_id) {
          item_type = pv.product_id.type; // "frame" | "lens" | "accessory"
        }
      }
      await new OrderItem({
        order_id: order._id,
        variant_id: item.variant_id,
        quantity: item.quantity,
        unit_price: item.price || 0,
        lens_params: item.lens_params,
        item_type,
      }).save();
    }
  }

  // ── 8. Tạo PrescriptionOrder nếu là đơn prescription ───────────
  if (order_type === "prescription") {
    const prescriptionItems = itemsToOrder.filter(
      (i) => i.lens_params && Object.keys(i.lens_params).length > 0,
    );
    for (const item of prescriptionItems) {
      const lp = item.lens_params || {};
      await PrescriptionOrder.create({
        order_id: order._id,
        // Ghi nhận lens_params từ cart
        sph_right: lp.sph_right,
        sph_left: lp.sph_left,
        cyl_right: lp.cyl_right,
        cyl_left: lp.cyl_left,
        axis_right: lp.axis_right,
        axis_left: lp.axis_left,
        add_right: lp.add_right,
        add_left: lp.add_left,
        pd: lp.pd,
        pupillary_distance: lp.pupillary_distance,
        // Các field bổ sung từ orderData nếu có
        prescription_image: orderData.prescription_image,
        optometrist_name: orderData.optometrist_name,
        clinic_name: orderData.clinic_name,
      });
    }
  }

  // ── 9. Tạo Payment record ─────────────────────────────────────
  await new Payment({
    order_id: order._id,
    amount: total,
    method: orderData.payment_method,
    status: orderData.payment_method === "cod" ? "pending" : "pending-payment",
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
      sel.quantity !== undefined
        ? Number(sel.quantity)
        : Number(plain.quantity);
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
  cart.updated_at = new Date();
  await cart.save();
  return order;
};

const STATE_TRANSITIONS = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["manufacturing", "packed", "received", "shipped"],
  manufacturing: ["packed"],
  packed: ["shipped"],
  shipped: ["delivered"],
  delivered: ["completed", "return_requested"],
  completed: [],
  cancelled: [],
  return_requested: ["returned", "refunded"],
  returned: [],
  refunded: [],
  // Pre-order: hàng về kho
  received: ["packed"],
};

/**
 * Kiểm tra transition có hợp lệ không (theo order_type)
 * - manufacturing: CHỈ dành cho prescription
 * - prescription: KHÔNG được skip manufacturing (processing → packed)
 */
function isValidTransition(currentStatus, newStatus, orderType) {
  const base = STATE_TRANSITIONS[currentStatus] || [];
  if (!base.includes(newStatus)) return false;

  // Chỉ prescription mới được vào trạng thái manufacturing
  if (newStatus === "manufacturing" && orderType !== "prescription") {
    return false;
  }

  // received: CHỉ pre_order (hàng nhà cung cấp về kho)
  if (newStatus === "received" && orderType !== "pre_order") {
    return false;
  }

  // Prescription: processing phải qua manufacturing trước
  if (orderType === "prescription" && currentStatus === "processing") {
    if (newStatus !== "manufacturing") return false;
  }

  // Pre-order: processing phải qua received trước
  if (orderType === "pre_order" && currentStatus === "processing") {
    if (newStatus !== "received") return false;
  }

  return true;
}

/**
 * Lấy danh sách transition hợp lệ từ trạng thái hiện tại
 * (để trả thông tin cho FE hiển thị nút hành động)
 */
function getAllowedTransitions(currentStatus, orderType) {
  const base = STATE_TRANSITIONS[currentStatus] || [];

  if (orderType === "prescription") {
    if (currentStatus === "processing") {
      return base.includes("manufacturing") ? ["manufacturing"] : [];
    }
    return base;
  }

  if (orderType === "pre_order") {
    if (currentStatus === "processing") {
      return base.includes("received") ? ["received"] : [];
    }
    return base.filter((s) => s !== "manufacturing");
  }

  // Stock: loại manufacturing, received
  return base.filter((s) => s !== "manufacturing" && s !== "received");
}

exports.updateOrderStatus = async (orderId, newStatus, userRole) => {
  const order = await Order.findById(orderId);
  if (!order) throw new Error("Không tìm thấy đơn hàng");

  // 🔒 Validate state machine transition (có order_type)
  if (!isValidTransition(order.status, newStatus, order.order_type)) {
    const allowed = getAllowedTransitions(order.status, order.order_type);
    const msg = allowed.length
      ? `Không thể chuyển từ "${order.status}" sang "${newStatus}". Các trạng thái hợp lệ: ${allowed.join(", ")}`
      : `Không thể chuyển từ "${order.status}" — đơn hàng đã ở trạng thái cuối`;
    throw new Error(msg);
  }

  // 🔒 Role-based: chỉ operations được cập nhật các trạng thái vận hành
  const OPS_ONLY_STATUSES = [
    "processing",
    "manufacturing",
    "received",
    "packed",
    "shipped",
    "delivered",
  ];
  if (OPS_ONLY_STATUSES.includes(newStatus) && userRole !== "operations") {
    throw new Error("Chỉ nhân viên operations được cập nhật trạng thái này");
  }

  // ✅ Transition hợp lệ → cập nhật
  order.status = newStatus;

  // ── Stock deduction theo trạng thái ───────────────────────────
  const ProductVariant = require("../models/productVariant.schema");

  if (newStatus === "received") {
    // PRE_ORDER: hàng về kho → chuyển reserved → stock
    if (order.order_type === "pre_order") {
      const OrderItem = require("../models/orderItem.schema");
      const items = await OrderItem.find({ order_id: orderId });

      for (const item of items) {
        // reserved_quantity giảm, stock_quantity tăng
        await ProductVariant.updateOne(
          { _id: item.variant_id },
          {
            $inc: {
              stock_quantity: item.quantity,
              reserved_quantity: -item.quantity,
            },
          },
        );
      }
    }
  }

  if (newStatus === "packed") {
    // STOCK: trừ gọng (frame)
    // PRESCRIPTION: trừ gọng (tròng để manufacturing)
    // PRE_ORDER: chỉ trừ khi ĐÃ received (hàng về kho rồi)
    const isPreOrderNotReceived =
      order.order_type === "pre_order" && order.status !== "received";

    if (!isPreOrderNotReceived) {
      const OrderItem = require("../models/orderItem.schema");
      const items = await OrderItem.find({ order_id: orderId });

      for (const item of items) {
        // Dùng item_type đã lưu khi tạo OrderItem (ko cần populate lại)
        if (item.item_type === "frame") {
          await ProductVariant.updateOne(
            { _id: item.variant_id },
            { $inc: { stock_quantity: -item.quantity } },
          );
        }
      }
    }
  }

  if (newStatus === "manufacturing") {
    // PRESCRIPTION: trừ stock tròng khi bắt đầu làm tròng
    if (order.order_type === "prescription") {
      const OrderItem = require("../models/orderItem.schema");
      const items = await OrderItem.find({ order_id: orderId });

      for (const item of items) {
        if (item.item_type === "lens") {
          await ProductVariant.updateOne(
            { _id: item.variant_id },
            { $inc: { stock_quantity: -item.quantity } },
          );
        }
      }
    }
  }

  if (newStatus === "delivered") {
    // COD: cập nhật payment = paid
    const payment = await Payment.findOne({ order_id: orderId, method: "cod" });
    if (payment && payment.status !== "paid") {
      payment.status = "paid";
      payment.paid_at = new Date();
      await payment.save();
    }
  }

  // Hoàn stock / reserved khi returned / cancelled
  if (newStatus === "returned" || newStatus === "cancelled") {
    const items = await OrderItem.find({ order_id: orderId });

    for (const item of items) {
      if (order.order_type === "pre_order") {
        // Pre-order: hoàn reserved_quantity (chưa trừ stock)
        await ProductVariant.updateOne(
          { _id: item.variant_id },
          { $inc: { reserved_quantity: -item.quantity } },
        );
      } else {
        // Stock / Prescription: hoàn stock_quantity (đã trừ ở packed/manufacturing)
        await ProductVariant.updateOne(
          { _id: item.variant_id },
          { $inc: { stock_quantity: item.quantity } },
        );
      }
    }

    if (newStatus === "returned") {
      const payment = await Payment.findOne({ order_id: orderId, method: "cod" });
      if (payment && payment.status !== "failed") {
        payment.status = "failed";
        await payment.save();
      }
    }
  }

  await order.save();
  return order;
};

exports.confirmOrder = async (orderId, user) => {
  const order = await Order.findById(orderId);
  if (!order) throw new Error("Không tìm thấy đơn hàng");
  if (
    !isValidTransition(order.status, "confirmed", order.order_type) &&
    !isValidTransition(order.status, "cancelled", order.order_type)
  ) {
    throw new Error("Trạng thái hiện tại không cho phép xác nhận hoặc hủy đơn");
  }
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

/**
 * Customer hủy đơn — chỉ pending mới được hủy
 */
exports.cancelOrder = async (orderId, userId, reason) => {
  const order = await Order.findById(orderId);
  if (!order) throw new Error("Không tìm thấy đơn hàng");

  // Chỉ chủ đơn mới được hủy
  if (order.user_id.toString() !== userId.toString()) {
    throw new Error("Bạn không có quyền hủy đơn hàng này");
  }

  // Chỉ pending hoặc confirmed mới hủy được
  if (!isValidTransition(order.status, "cancelled", order.order_type)) {
    throw new Error(`Không thể hủy đơn ở trạng thái "${order.status}"`);
  }

  order.status = "cancelled";
  if (reason) order.cancel_reason = reason;

  // Hoàn reserved_quantity cho pre-order khi hủy
  if (order.order_type === "pre_order") {
    const ProductVariant = require("../models/productVariant.schema");
    const OrderItem = require("../models/orderItem.schema");
    const items = await OrderItem.find({ order_id: orderId });
    for (const item of items) {
      await ProductVariant.updateOne(
        { _id: item.variant_id },
        { $inc: { reserved_quantity: -item.quantity } },
      );
    }
  }

  await order.save();
  return order;
};

exports.getOrderListCustomer = async (userId, filter = {}) => {
  const match = { user_id: userId };
  if (filter.status) match.status = filter.status;
  const page = filter.page ? parseInt(filter.page) : 1;
  const pageSize = filter.pageSize ? parseInt(filter.pageSize) : 10;
  const skip = (page - 1) * pageSize;
  const total = await Order.countDocuments(match);
  const orders = await Order.find(match)
    .sort({ created_at: -1 })
    .skip(skip)
    .limit(pageSize);
  const orderIds = orders.map((o) => o._id);
  let paymentQuery = { order_id: { $in: orderIds } };
  if (filter.payment_method) paymentQuery.method = filter.payment_method;
  if (filter.payment_status) paymentQuery.status = filter.payment_status;
  const payments = await Payment.find(paymentQuery);
  const paymentMap = {};
  payments.forEach((p) => {
    if (p.status !== "pending-payment") {
      paymentMap[p.order_id] = p;
    }
  });
  const filteredOrders = orders.filter(
    (o) =>
      !paymentMap[o._id] ||
      (paymentMap[o._id] && paymentMap[o._id].status !== "pending-payment"),
  );
  return {
    data: filteredOrders.map((o) => ({
      ...o.toObject(),
      payment: paymentMap[o._id] || null,
    })),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
};

exports.getOrderListShop = async (filter = {}) => {
  const match = {};
  if (filter.status) match.status = filter.status;
  const page = filter.page ? parseInt(filter.page) : 1;
  const pageSize = filter.pageSize ? parseInt(filter.pageSize) : 10;
  const skip = (page - 1) * pageSize;
  const total = await Order.countDocuments(match);
  const orders = await Order.find(match)
    .sort({ created_at: -1 })
    .skip(skip)
    .limit(pageSize);
  const orderIds = orders.map((o) => o._id);
  let paymentQuery = { order_id: { $in: orderIds } };
  if (filter.payment_method) paymentQuery.method = filter.payment_method;
  if (filter.payment_status) paymentQuery.status = filter.payment_status;
  const payments = await Payment.find(paymentQuery);
  const paymentMap = {};
  payments.forEach((p) => {
    paymentMap[p.order_id] = p;
  });
  let filteredOrders = orders;
  if (filter.payment_method || filter.payment_status) {
    filteredOrders = orders.filter((o) => paymentMap[o._id]);
  }
  return {
    data: filteredOrders.map((o) => ({
      ...o.toObject(),
      payment: paymentMap[o._id] || null,
    })),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
};

exports.getOrderDetail = async (orderId) => {
  const order = await Order.findById(orderId);
  if (!order) throw new Error("Không tìm thấy đơn hàng");
  const items = await OrderItem.find({ order_id: orderId });
  const payment = await Payment.findOne({ order_id: orderId });

  // Nếu là đơn prescription → lấy thông tin đơn thuốc
  let prescriptions = null;
  if (order.order_type === "prescription") {
    const PrescriptionOrder = require("../models/prescriptionOrder.schema");
    prescriptions = await PrescriptionOrder.find({ order_id: orderId });
  }

  return {
    ...order.toObject(),
    items,
    payment,
    prescriptions,
  };
};
