const Product = require("../models/product.schema");
const ProductVariant = require("../models/productVariant.schema");
const Category = require("../models/category.schema");
const Brand = require("../models/brand.schema");
const Model = require("../models/model.schema");

async function addVariant(productId, payload, user) {
  if (!productId) throw createHttpError("Thiếu productId", 400);
  const product = await Product.findById(productId);
  if (!product) throw createHttpError("Không tìm thấy sản phẩm", 404);

  // Validate input
  let { sku, attributes, price, stock_quantity, images } = payload;
  if (!price) {
    throw createHttpError("Thiếu giá cho biến thể", 400);
  }
  // Auto-generate SKU nếu không truyền
  if (!sku) {
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    sku = `VAR-${Date.now()}-${random}`;
  }
  // Kiểm tra trùng SKU
  const exists = await ProductVariant.findOne({ sku });
  if (exists) {
    throw createHttpError("SKU biến thể đã tồn tại", 409);
  }
  const variant = await ProductVariant.create({
    product_id: productId,
    sku,
    attributes: attributes || {},
    price,
    stock_quantity: stock_quantity || 0,
    images: images || [],
  });
  return { message: "Thêm biến thể thành công", variant };
}

function createHttpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function toPositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return fallback;
  return parsed;
}

async function listProducts(query = {}) {
  const page = toPositiveInt(query.page, 1);
  const limit = toPositiveInt(query.limit, 12);
  const skip = (page - 1) * limit;

  const filters = { is_active: true };

  if (query.search) {
    const keyword = String(query.search).trim();
    if (keyword) {
      filters.$or = [
        { name: { $regex: keyword, $options: "i" } },
        { slug: { $regex: keyword, $options: "i" } },
        { sku: { $regex: keyword, $options: "i" } },
      ];
    }
  }

  if (query.category_id) {
    filters.category_id = query.category_id;
  }

  const [items, total] = await Promise.all([
    Product.find(filters).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Product.countDocuments(filters),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit) || 1,
    },
  };
}

async function getProductDetailBySlug(slug) {
  if (!slug) {
    throw createHttpError("Thiếu slug sản phẩm", 400);
  }

  const product = await Product.findOne({ slug, is_active: true });
  if (!product) {
    throw createHttpError("Không tìm thấy sản phẩm", 404);
  }

  const variants = await ProductVariant.find({ product_id: product._id }).sort({
    createdAt: -1,
  });

  return { product, variants };
}

async function getProductVariants(productId) {
  if (!productId) {
    throw createHttpError("Thiếu productId", 400);
  }

  const product = await Product.findOne({ _id: productId, is_active: true });
  if (!product) {
    throw createHttpError("Không tìm thấy sản phẩm", 404);
  }

  const variants = await ProductVariant.find({ product_id: productId }).sort({
    createdAt: -1,
  });

  return { product_id: productId, variants };
}

async function createProduct(payload, user) {
  const {
    category,
    name,
    type,
    brand,
    model,
    material,
    images,
    description,
    variants,
  } = payload;
  if (!category || !name || !variants || images === undefined) {
    throw createHttpError("Thiếu thông tin bắt buộc", 400);
  }
  // Tạo slug trước khi kiểm tra trùng
  const slug =
    name
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "") +
    "-" +
    Date.now();
  const exists = await Product.findOne({ slug });
  if (exists) {
    throw createHttpError("Slug đã tồn tại", 409);
  }

  const categoryDoc = await Category.findById(category);
  if (!categoryDoc) {
    throw createHttpError("Không tìm thấy danh mục", 404);
  }

  const brandDoc = brand ? await Brand.findById(brand) : null;
  if (brand && !brandDoc) {
    throw createHttpError("Không tìm thấy thương hiệu", 404);
  }

  const modelDoc = model ? await Model.findById(model) : null;
  if (model && !modelDoc) {
    throw createHttpError("Không tìm thấy mẫu mã", 404);
  }

  const product = await Product.create({
    category,
    name,
    slug,
    images: images || [],
    description: description || "",
    is_active: true,
  });

  if (!Array.isArray(variants) || variants.length === 0) {
    throw createHttpError("Phải nhập ít nhất 1 biến thể cho sản phẩm", 400);
  }

  const createdVariants = await ProductVariant.insertMany(
    variants.map((v) => {
      let sku = v.sku;
      if (!sku) {
        const random = Math.random().toString(36).substring(2, 8).toUpperCase();
        sku = `VAR-${Date.now()}-${random}`;
      }
      return {
        product_id: product._id,
        sku,
        attributes: v.attributes || {},
        price: v.price || price,
        stock_quantity: v.stock_quantity || 0,
        images: v.images || [],
      };
    }),
  );
  return {
    message: "Tạo sản phẩm thành công",
    product,
    variants: createdVariants,
  };
}

module.exports = {
  listProducts,
  getProductDetailBySlug,
  getProductVariants,
  createProduct,
  addVariant,
};
