const express = require("express");
const router = express.Router();

const orderController = require("../controllers/order.controller");
const authMiddleware = require("../middlewares/auth.middleware");

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
