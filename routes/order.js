const express = require("express");
const router = express.Router();

const orderController = require("../controllers/order.controller");
const authMiddleware = require("../middlewares/auth.middleware");

router.get(
  "/",
  authMiddleware.authenticate,
  authMiddleware.authorize(["customer"]),
  orderController.getOrderListCustomer,
);

router.get(
  "/all",
  authMiddleware.authenticate,
  authMiddleware.authorize(["sales", "manager", "operations"]),
  orderController.getOrderListShop,
);

router.get("/:id", authMiddleware.authenticate, orderController.getOrderDetail);

// Đặt hàng (checkout)
router.post(
  "/checkout",
  authMiddleware.authenticate,
  authMiddleware.authorize(["customer"]),
  orderController.checkout,
);

// Sale xác nhận đơn hàng
router.post(
  "/:id/confirm",
  authMiddleware.authenticate,
  authMiddleware.authorize(["sales"]),
  orderController.confirmOrder,
);

router.put(
  "/:id/status",
  authMiddleware.authenticate,
  authMiddleware.authorize(["operations"]),
  orderController.updateStatus,
);

module.exports = router;
