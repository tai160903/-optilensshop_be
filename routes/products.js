const express = require("express");
const productController = require("../controllers/product.controller");
const { authenticate, authorize } = require("../middlewares/auth.middleware");

const router = express.Router();

router.get("/", productController.listProducts);
router.get("/:slug", productController.getProductDetailBySlug);
router.get("/:id/variants", productController.getProductVariants);

// Multer cấu hình memoryStorage để upload file lên Cloudinary
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });

// Thêm sản phẩm mới (chỉ manager/admin, hỗ trợ form-data có file ảnh)
router.post(
  "/",
  authenticate,
  authorize(["manager", "admin"]),
  upload.array("images"),
  productController.createProduct,
);

// Thêm biến thể cho product (manager/admin)
router.post(
  "/:id/variants",
  authenticate,
  authorize(["manager", "admin"]),
  productController.addVariant,
);

module.exports = router;
