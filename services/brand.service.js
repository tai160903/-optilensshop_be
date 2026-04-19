const Brand = require("../models/brand.schema");

function createHttpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function listBrands() {
  return Brand.find({ is_active: true });
}

async function createBrand(payload) {
  const { name, description, logo } = payload;
  if (!name) throw createHttpError("Thiếu tên thương hiệu", 400);
  const exists = await Brand.findOne({ name });
  if (exists) throw createHttpError("Brand đã tồn tại", 409);
  const brand = await Brand.create({ name, description, logo });
  return { message: "Tạo brand thành công", brand };
}

async function updateBrand(id, payload) {
  const { name, description, logo } = payload;
  const brand = await Brand.findById(id);
  if (!brand) throw createHttpError("Không tìm thấy brand", 404);
  if (name && name !== brand.name) {
    const exists = await Brand.findOne({ name });
    if (exists) throw createHttpError("Brand đã tồn tại", 409);
    brand.name = name;
  }
  if (description !== undefined) brand.description = description;
  if (logo !== undefined) brand.logo = logo;
  await brand.save();
  return { message: "Cập nhật brand thành công", brand };
}

async function deleteBrand(id) {
  const brand = await Brand.findById(id);
  if (!brand) throw createHttpError("Không tìm thấy brand", 404);
  brand.is_active = false;
  await brand.save();
  return { message: "Đã xóa brand" };
}

module.exports = {
  listBrands,
  createBrand,
  updateBrand,
  deleteBrand,
};
