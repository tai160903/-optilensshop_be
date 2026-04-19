const express = require("express");
const paymentController = require("../controllers/payment.controller");

const router = express.Router();
router.get("/success", paymentController.success);
router.get("/fail", paymentController.fail);

module.exports = router;
