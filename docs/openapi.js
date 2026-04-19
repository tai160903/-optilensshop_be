/**
 * OpenAPI 3.0 specification — OptiLens Shop API
 * Served at /api-docs (Swagger UI)
 */
function getOpenApiSpec() {
  const port = process.env.PORT || 3000;
  const defaultServer =
    process.env.SWAGGER_SERVER_URL || `http://localhost:${port}`;

  return {
    openapi: "3.0.3",
    info: {
      title: "OptiLens Shop API",
      description:
        "Backend API: auth, sản phẩm, combo gọng+tròng, giỏ hàng, đơn hàng, quản trị.\n\n**JWT:** gửi header `Authorization: Bearer <access_token>` (nhận từ `/auth/login`).",
      version: "1.0.0",
    },
    servers: [{ url: defaultServer, description: "API server" }],
    tags: [
      { name: "Auth", description: "Đăng ký, đăng nhập, mật khẩu" },
      { name: "Users", description: "Hồ sơ người dùng" },
      { name: "Management", description: "Quản lý staff & manager (RBAC)" },
      { name: "Products", description: "Danh mục sản phẩm & biến thể" },
      { name: "Combos", description: "Combo gọng + tròng" },
      { name: "Categories" },
      { name: "Brands" },
      { name: "Models" },
      { name: "Cart", description: "Giỏ hàng (cần đăng nhập)" },
      { name: "Orders", description: "Checkout & xử lý đơn" },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        ErrorMessage: {
          type: "object",
          properties: {
            message: { type: "string" },
            error: { type: "string" },
          },
        },
        RegisterBody: {
          type: "object",
          required: ["email", "password", "confirm_password"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 5 },
            confirm_password: { type: "string" },
          },
        },
        LoginBody: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string" },
          },
        },
        CheckoutBody: {
          type: "object",
          required: ["shipping_address", "order_type", "payment_method"],
          properties: {
            shipping_address: {
              oneOf: [
                { type: "string" },
                {
                  type: "object",
                  description:
                    "Địa chỉ object — server ghép chuỗi (xem utils/address)",
                },
              ],
            },
            order_type: {
              type: "string",
              enum: ["stock", "preorder", "prescription"],
            },
            payment_method: {
              type: "string",
              enum: ["cod", "momo"],
              description: "Phương thức thanh toán",
            },
            shipping_method: {
              type: "string",
              enum: ["ship", "pickup"],
              description: "Tùy chọn — `ship` cộng phí vận chuyển",
            },
            items: {
              type: "array",
              description:
                "Tùy chọn — subset giỏ hàng. Mỗi phần tử: `{ variant_id, quantity }` hoặc `{ combo_id, quantity }`",
              items: {
                type: "object",
                properties: {
                  variant_id: { type: "string" },
                  combo_id: { type: "string" },
                  quantity: { type: "integer", minimum: 1 },
                },
              },
            },
          },
        },
        ComboCreateBody: {
          type: "object",
          required: [
            "name",
            "slug",
            "frame_variant_id",
            "lens_variant_id",
            "combo_price",
          ],
          properties: {
            name: { type: "string" },
            slug: { type: "string" },
            description: { type: "string" },
            frame_variant_id: { type: "string" },
            lens_variant_id: { type: "string" },
            combo_price: { type: "number", minimum: 0 },
            is_active: { type: "boolean", default: true },
          },
        },
        CartAddItemBody: {
          type: "object",
          properties: {
            variant_id: {
              type: "string",
              description: "Thêm sản phẩm lẻ — XOR với combo_id",
            },
            combo_id: {
              type: "string",
              description: "Thêm combo — XOR với variant_id",
            },
            quantity: { type: "integer", minimum: 1 },
            lens_params: { type: "object", description: "Prescription / thông số tròng" },
          },
        },
        StaffUserBody: {
          type: "object",
          description: "Tham số tạo/cập nhật nhân viên — xem user.service",
          properties: {
            email: { type: "string" },
            password: { type: "string" },
            full_name: { type: "string" },
            phone: { type: "string" },
            role: {
              type: "string",
              enum: ["sales", "operations"],
              description: "Staff thường là sales hoặc operations",
            },
          },
        },
      },
    },
    paths: {
      "/auth/register": {
        post: {
          tags: ["Auth"],
          summary: "Đăng ký",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RegisterBody" },
              },
            },
          },
          responses: {
            201: { description: "Đăng ký thành công" },
            400: {
              description: "Lỗi validation",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorMessage" },
                },
              },
            },
          },
        },
      },
      "/auth/login": {
        post: {
          tags: ["Auth"],
          summary: "Đăng nhập",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/LoginBody" },
              },
            },
          },
          responses: {
            200: {
              description: "access_token + user",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      message: { type: "string" },
                      access_token: { type: "string" },
                      user: { type: "object" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/auth/verify-email": {
        get: {
          tags: ["Auth"],
          summary: "Xác thực email",
          parameters: [
            {
              name: "token",
              in: "query",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: { 200: { description: "OK" } },
        },
      },
      "/auth/resend-verification-email": {
        post: {
          tags: ["Auth"],
          summary: "Gửi lại email xác thực",
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { email: { type: "string" } },
                },
              },
            },
          },
          responses: { 200: { description: "OK" } },
        },
      },
      "/auth/forgot-password": {
        post: {
          tags: ["Auth"],
          summary: "Quên mật khẩu",
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { email: { type: "string" } },
                },
              },
            },
          },
          responses: { 200: { description: "OK" } },
        },
      },
      "/auth/reset-password": {
        post: {
          tags: ["Auth"],
          summary: "Đặt lại mật khẩu",
          parameters: [
            {
              name: "token",
              in: "query",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    password: { type: "string" },
                    confirm_password: { type: "string" },
                  },
                },
              },
            },
          },
          responses: { 200: { description: "OK" } },
        },
      },
      "/auth/change-password": {
        post: {
          tags: ["Auth"],
          security: [{ bearerAuth: [] }],
          summary: "Đổi mật khẩu",
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    current_password: { type: "string" },
                    password: { type: "string" },
                    confirm_password: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: "OK" },
            401: { description: "Chưa đăng nhập / token hết hạn" },
          },
        },
      },
      "/users/me/profile": {
        get: {
          tags: ["Users"],
          security: [{ bearerAuth: [] }],
          summary: "Lấy profile của tôi",
          responses: {
            200: { description: "user object" },
            401: { description: "Unauthorized" },
          },
        },
        put: {
          tags: ["Users"],
          security: [{ bearerAuth: [] }],
          summary: "Cập nhật profile (multipart: avatar + fields)",
          requestBody: {
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  properties: {
                    avatar: { type: "string", format: "binary" },
                    full_name: { type: "string" },
                    phone: { type: "string" },
                  },
                },
              },
            },
          },
          responses: { 200: { description: "OK" } },
        },
      },
      "/management/staff": {
        get: {
          tags: ["Management"],
          security: [{ bearerAuth: [] }],
          summary: "Danh sách staff",
          description: "manager, admin",
          responses: { 200: { description: "OK" }, 403: { description: "Forbidden" } },
        },
        post: {
          tags: ["Management"],
          security: [{ bearerAuth: [] }],
          summary: "Tạo staff",
          requestBody: {
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/StaffUserBody" },
              },
            },
          },
          responses: { 201: { description: "Created" } },
        },
      },
      "/management/staff/{id}": {
        put: {
          tags: ["Management"],
          security: [{ bearerAuth: [] }],
          summary: "Cập nhật staff",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
          ],
          requestBody: {
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/StaffUserBody" },
              },
            },
          },
          responses: { 200: { description: "OK" } },
        },
        delete: {
          tags: ["Management"],
          security: [{ bearerAuth: [] }],
          summary: "Xóa staff",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: { 200: { description: "OK" } },
        },
      },
      "/management/managers": {
        get: {
          tags: ["Management"],
          security: [{ bearerAuth: [] }],
          summary: "Danh sách manager",
          description: "admin only",
          responses: { 200: { description: "OK" } },
        },
        post: {
          tags: ["Management"],
          security: [{ bearerAuth: [] }],
          summary: "Tạo manager",
          responses: { 201: { description: "Created" } },
        },
      },
      "/management/managers/{id}": {
        put: {
          tags: ["Management"],
          security: [{ bearerAuth: [] }],
          summary: "Cập nhật manager",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: { 200: { description: "OK" } },
        },
        delete: {
          tags: ["Management"],
          security: [{ bearerAuth: [] }],
          summary: "Xóa manager",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: { 200: { description: "OK" } },
        },
      },
      "/products": {
        get: {
          tags: ["Products"],
          summary: "Danh sách sản phẩm",
          parameters: [
            { name: "page", in: "query", schema: { type: "integer", default: 1 } },
            { name: "limit", in: "query", schema: { type: "integer", default: 12 } },
            { name: "search", in: "query", schema: { type: "string" } },
            { name: "category_id", in: "query", schema: { type: "string" } },
          ],
          responses: { 200: { description: "items + pagination" } },
        },
        post: {
          tags: ["Products"],
          security: [{ bearerAuth: [] }],
          summary: "Tạo sản phẩm (multipart)",
          description:
            "Form-data: `category`, `name`, `type`, `variants` (JSON string), `images` (file[]), v.v.",
          requestBody: {
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  required: ["category", "name", "variants"],
                  properties: {
                    category: { type: "string" },
                    name: { type: "string" },
                    type: { type: "string", enum: ["frame", "lens", "accessory"] },
                    brand: { type: "string" },
                    model: { type: "string" },
                    material: { type: "string" },
                    description: { type: "string" },
                    variants: {
                      type: "string",
                      description: "JSON array biến thể",
                    },
                    images: {
                      type: "array",
                      items: { type: "string", format: "binary" },
                    },
                  },
                },
              },
            },
          },
          responses: { 201: { description: "Created" } },
        },
      },
      "/products/{slug}": {
        get: {
          tags: ["Products"],
          summary: "Chi tiết sản phẩm theo slug",
          parameters: [
            { name: "slug", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: { 200: { description: "product + variants" }, 404: { description: "Not found" } },
        },
      },
      "/products/{id}/variants": {
        get: {
          tags: ["Products"],
          summary: "Biến thể theo product id (Mongo ObjectId)",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
              description: "Mongo _id của Product",
            },
          ],
          responses: { 200: { description: "variants" } },
        },
        post: {
          tags: ["Products"],
          security: [{ bearerAuth: [] }],
          summary: "Thêm biến thể",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
          ],
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    sku: { type: "string" },
                    attributes: { type: "object" },
                    price: { type: "number" },
                    stock_quantity: { type: "integer" },
                    images: { type: "array", items: { type: "string" } },
                  },
                  required: ["price"],
                },
              },
            },
          },
          responses: { 201: { description: "Created" } },
        },
      },
      "/combos": {
        get: {
          tags: ["Combos"],
          summary: "Danh sách combo đang active",
          parameters: [
            { name: "page", in: "query", schema: { type: "integer" } },
            { name: "limit", in: "query", schema: { type: "integer" } },
          ],
          responses: { 200: { description: "items + pagination" } },
        },
        post: {
          tags: ["Combos"],
          security: [{ bearerAuth: [] }],
          summary: "Tạo combo",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ComboCreateBody" },
              },
            },
          },
          responses: { 201: { description: "Created" } },
        },
      },
      "/combos/{comboKey}": {
        parameters: [
          {
            name: "comboKey",
            in: "path",
            required: true,
            schema: { type: "string" },
            description:
              "GET: **slug** combo. PUT/DELETE: Mongo **_id** của combo (24 ký tự hex).",
          },
        ],
        get: {
          tags: ["Combos"],
          summary: "Chi tiết combo theo slug",
          responses: { 200: { description: "Combo + populate" } },
        },
        put: {
          tags: ["Combos"],
          security: [{ bearerAuth: [] }],
          summary: "Cập nhật combo theo Mongo _id",
          requestBody: {
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ComboCreateBody" },
              },
            },
          },
          responses: { 200: { description: "OK" } },
        },
        delete: {
          tags: ["Combos"],
          security: [{ bearerAuth: [] }],
          summary: "Xóa combo theo Mongo _id",
          responses: { 200: { description: "OK" } },
        },
      },
      "/categories": {
        get: {
          tags: ["Categories"],
          summary: "Danh sách danh mục",
          responses: { 200: { description: "OK" } },
        },
        post: {
          tags: ["Categories"],
          security: [{ bearerAuth: [] }],
          summary: "Tạo danh mục (manager/admin)",
          responses: { 201: { description: "Created" } },
        },
      },
      "/categories/{id}": {
        put: {
          tags: ["Categories"],
          security: [{ bearerAuth: [] }],
          summary: "Cập nhật danh mục",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: { 200: { description: "OK" } },
        },
        delete: {
          tags: ["Categories"],
          security: [{ bearerAuth: [] }],
          summary: "Xóa danh mục",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: { 200: { description: "OK" } },
        },
      },
      "/brands": {
        get: {
          tags: ["Brands"],
          summary: "Danh sách thương hiệu",
          responses: { 200: { description: "OK" } },
        },
        post: {
          tags: ["Brands"],
          security: [{ bearerAuth: [] }],
          summary: "Tạo thương hiệu",
          responses: { 201: { description: "Created" } },
        },
      },
      "/brands/{id}": {
        put: {
          tags: ["Brands"],
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: { 200: { description: "OK" } },
        },
        delete: {
          tags: ["Brands"],
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: { 200: { description: "OK" } },
        },
      },
      "/models": {
        get: {
          tags: ["Models"],
          summary: "Danh sách model mẫu mã",
          responses: { 200: { description: "OK" } },
        },
        post: {
          tags: ["Models"],
          security: [{ bearerAuth: [] }],
          summary: "Tạo model",
          responses: { 201: { description: "Created" } },
        },
      },
      "/models/{id}": {
        put: {
          tags: ["Models"],
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: { 200: { description: "OK" } },
        },
        delete: {
          tags: ["Models"],
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: { 200: { description: "OK" } },
        },
      },
      "/cart": {
        get: {
          tags: ["Cart"],
          security: [{ bearerAuth: [] }],
          summary: "Lấy giỏ hàng",
          responses: { 200: { description: "Cart + populate" } },
        },
      },
      "/cart/items": {
        post: {
          tags: ["Cart"],
          security: [{ bearerAuth: [] }],
          summary: "Thêm vào giỏ (variant_id hoặc combo_id)",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CartAddItemBody" },
              },
            },
          },
          responses: { 200: { description: "OK" } },
        },
      },
      "/cart/items/{id}": {
        put: {
          tags: ["Cart"],
          security: [{ bearerAuth: [] }],
          summary: "Cập nhật số lượng dòng variant",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
          ],
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    quantity: { type: "integer" },
                    lens_params: { type: "object" },
                  },
                },
              },
            },
          },
          responses: { 200: { description: "OK" } },
        },
        delete: {
          tags: ["Cart"],
          security: [{ bearerAuth: [] }],
          summary: "Xóa dòng variant",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: { 200: { description: "OK" } },
        },
      },
      "/cart/combo-items/{combo_id}": {
        put: {
          tags: ["Cart"],
          security: [{ bearerAuth: [] }],
          summary: "Cập nhật số lượng dòng combo",
          parameters: [
            {
              name: "combo_id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    quantity: { type: "integer" },
                    lens_params: { type: "object" },
                  },
                },
              },
            },
          },
          responses: { 200: { description: "OK" } },
        },
        delete: {
          tags: ["Cart"],
          security: [{ bearerAuth: [] }],
          summary: "Xóa dòng combo",
          parameters: [
            {
              name: "combo_id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: { 200: { description: "OK" } },
        },
      },
      "/cart/clear": {
        delete: {
          tags: ["Cart"],
          security: [{ bearerAuth: [] }],
          summary: "Xóa toàn bộ giỏ",
          responses: { 200: { description: "OK" } },
        },
      },
      "/orders/checkout": {
        post: {
          tags: ["Orders"],
          security: [{ bearerAuth: [] }],
          summary: "Checkout (customer)",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CheckoutBody" },
              },
            },
          },
          responses: {
            201: {
              description: "Đơn hàng + payUrl (MoMo nếu có)",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      message: { type: "string" },
                      order: { type: "object" },
                      payUrl: { type: "string", nullable: true },
                    },
                  },
                },
              },
            },
            400: { description: "Lỗi nghiệp vụ / giỏ trống" },
          },
        },
      },
      "/orders/{id}/confirm": {
        post: {
          tags: ["Orders"],
          security: [{ bearerAuth: [] }],
          summary: "Sale xác nhận / từ chối đơn",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
          ],
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    reject: { type: "boolean" },
                    reject_reason: { type: "string" },
                  },
                },
              },
            },
          },
          responses: { 200: { description: "OK" } },
        },
      },
      "/orders/{id}/status": {
        put: {
          tags: ["Orders"],
          security: [{ bearerAuth: [] }],
          summary: "Operations cập nhật trạng thái đơn",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: {
                      type: "string",
                      enum: [
                        "processing",
                        "manufacturing",
                        "packed",
                        "shipped",
                        "delivered",
                      ],
                    },
                  },
                },
              },
            },
          },
          responses: { 200: { description: "OK" } },
        },
      },
    },
  };
}

module.exports = getOpenApiSpec;
