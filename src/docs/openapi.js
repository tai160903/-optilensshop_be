function getOpenApiSpec() {
  const port = process.env.PORT || 3000;
  const defaultServer =
    process.env.SWAGGER_SERVER_URL || `http://localhost:${port}`;

  return {
    openapi: "3.0.3",
    info: {
      title: "OptiLens Shop API",
      description:
        "Backend API cho hệ thống bán kính mắt trực tuyến OptiLens Shop.\n\n" +
        "## Nghiệp vụ chính\n" +
        "- **3 loại đơn hàng**: `stock` (có sẵn), `preorder` (đặt trước), `prescription` (làm kính theo đơn)\n" +
        "- **Combo**: gói gọng + tròng bán kèm giá ưu đãi\n" +
        "- **Prescription**: lưu thông số SPH, CYL, AXIS, ADD, PD\n\n" +
        "## Auth\n" +
        "- Tất cả endpoint cần auth đều gửi header `Authorization: Bearer <access_token>`\n" +
        "- Nhận token từ `POST /auth/login` sau khi đăng nhập thành công\n" +
        "- Customer phải xác thực email trước khi đăng nhập lần đầu (`GET /auth/verify-email`)\n\n" +
        "## RBAC — Vai trò\n" +
        "| Vai trò | Quyền chính |\n" +
        "|---|---|\n" +
        "| `customer` | Xem SP, giỏ hàng, đặt hàng, xem đơn của mình |\n" +
        "| `sales` | Xác nhận đơn, từ chối đơn |\n" +
        "| `operations` | Cập nhật trạng thái đơn (đóng gói → giao) |\n" +
        "| `manager` | Quản lý SP, combo, categories, brands, staff |\n" +
        "| `admin` | Quản lý manager + toàn bộ |\n\n" +
        "## Order State Machine\n" +
        "```\n" +
        "STOCK:        pending → confirmed → processing → packed → shipped → delivered → completed\n" +
        "PRE_ORDER:    pending → confirmed → processing → received → packed → shipped → delivered → completed\n" +
        "PRESCRIPTION: pending → confirmed → processing → manufacturing → packed → shipped → delivered → completed\n" +
        "```\n" +
        "Hủy: `pending/confirmed → cancelled` | Trả: `delivered → return_requested → returned/refunded`\n\n" +
        "**Auto-detect order_type**: Server tự xác định `order_type` từ cart items:\n" +
        "- Có `lens_params` → `prescription`\n" +
        "- Variant/combo có `stock_type = preorder` → `pre_order`\n" +
        "- Còn lại → `stock`",
      version: "1.0.0",
    },
    servers: [{ url: defaultServer, description: "API server" }],
    tags: [
      {
        name: "Auth",
        description:
          "## Đăng ký / Đăng nhập / Quản lý mật khẩu\n" +
          "- Tạo tài khoản, gửi email xác thực\n" +
          "- Đăng nhập → trả về JWT access_token\n" +
          "- Xác thực email (từ link trong email)\n" +
          "- Gửi lại email xác thực\n" +
          "- Quên mật khẩu (gửi link đặt lại)\n" +
          "- Đặt lại mật khẩu mới\n" +
          "- Đổi mật khẩu (cần đăng nhập)",
      },
      {
        name: "Users",
        description:
          "## Hồ sơ người dùng\n" +
          "- Lấy thông tin cá nhân\n" +
          "- Cập nhật profile (hỗ trợ upload avatar)",
      },
      {
        name: "Management",
        description:
          "## Quản lý nhân sự (manager/admin)\n" +
          "- Staff: sales, operations\n" +
          "- Manager: quản lý cấp cao hơn\n" +
          "- Xem danh sách, tạo, cập nhật, xóa mềm (soft delete)",
      },
      {
        name: "Products",
        description:
          "## Sản phẩm & Biến thể\n" +
          "- Product có 3 loại: `frame` (gọng), `lens` (tròng), `accessory` (phụ kiện)\n" +
          "- Mỗi product có nhiều variant (biến thể): màu sắc, size, giá, tồn kho riêng\n" +
          "- Manager/admin: tạo, cập nhật, xóa sản phẩm & biến thể\n" +
          "- Public: xem danh sách, chi tiết, tìm kiếm",
      },
      {
        name: "Combos",
        description:
          "## Combo gọng + tròng\n" +
          "- Combo = 1 frame variant + 1 lens variant, bán kèm với `combo_price` ưu đãi\n" +
          "- Khi checkout, server tự chia `combo_price` thành giá gọng + giá tròng theo tỷ lệ\n" +
          "- Chi tiết theo slug, CRUD cho manager/admin",
      },
      {
        name: "Categories",
        description:
          "## Danh mục sản phẩm — phân loại gọng kính, tròng, phụ kiện",
      },
      {
        name: "Brands",
        description: "## Thương hiệu — quản lý hãng sản xuất kính",
      },
      {
        name: "Models",
        description: "## Mẫu mã — quản lý kiểu dáng/mẫu kính (frame hoặc lens)",
      },
      {
        name: "Cart",
        description:
          "## Giỏ hàng (cần đăng nhập)\n" +
          "- Mỗi user có 1 giỏ hàng (Cart schema)\n" +
          "- Items: variant lẻ HOẶC combo\n" +
          "- `lens_params`: thông số tròng theo đơn kính (prescription)\n" +
          "- Checkout: chuyển giỏ thành đơn hàng, xóa các items đã đặt khỏi giỏ",
      },
      {
        name: "Orders",
        description:
          "## Đơn hàng — Checkout & Xử lý\n" +
          "- **3 loại**: `stock`, `preorder`, `prescription`\n" +
          "- **Checkout**: tạo đơn từ giỏ hàng, hỗ trợ MoMo hoặc COD\n" +
          "- **Sales**: xác nhận / từ chối đơn\n" +
          "- **Operations**: cập nhật trạng thái đơn theo state machine\n" +
          "- **Customer**: xem đơn của mình, hủy đơn (pending/confirmed)",
      },
      {
        name: "Payments",
        description:
          "## Payment Callbacks — không cần auth\n" +
          "- `GET /payment/success` — FE gọi sau khi redirect từ MoMo để xác nhận thanh toán\n" +
          "- `GET /payment/fail` — Xử lý khi thanh toán thất bại",
      },
      {
        name: "MoMo",
        description:
          "## Tích hợp thanh toán MoMo\n" +
          "- `POST /momo/create` — Tạo payment request, nhận payUrl/deeplink\n" +
          "- `GET /momo/return` — MoMo redirect sau khi user thanh toán\n" +
          "- `POST /momo/ipn` — MoMo gọi IPN khi thanh toán hoàn tất\n" +
          "- Signature: HMAC-SHA256, verify trước khi cập nhật trạng thái",
      },
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
          description:
            "Format lỗi chuẩn của API — mọi endpoint đều trả về object này khi lỗi",
          properties: {
            message: {
              type: "string",
              description: "Mô tả lỗi bằng tiếng Việt",
              example: "Email đã tồn tại",
            },
            error: {
              type: "string",
              description: "Mã lỗi (tùy endpoint)",
              example: "VALIDATION_ERROR",
            },
          },
        },
        StateMachineError: {
          type: "object",
          description:
            "Lỗi khi chuyển trạng thái đơn hàng không hợp lệ theo state machine",
          properties: {
            message: {
              type: "string",
              example:
                "Không thể chuyển từ 'pending' sang 'shipped'. Các trạng thái hợp lệ: confirmed, cancelled",
            },
          },
        },
        BrandBody: {
          type: "object",
          description:
            "Thông tin tạo / cập nhật thương hiệu. Tên thương hiệu không được trùng.",
          properties: {
            name: {
              type: "string",
              description: "Tên thương hiệu (unique)",
              example: "Ray-Ban",
            },
            description: {
              type: "string",
              description: "Mô tả ngắn về thương hiệu",
              example: "Kính mắt cao cấp từ Mỹ",
            },
            logo: {
              type: "string",
              description: "URL ảnh logo thương hiệu",
              example: "https://cloudinary.com/rayban-logo.png",
            },
          },
        },
        CategoryBody: {
          type: "object",
          description:
            "Thông tin tạo / cập nhật danh mục sản phẩm. Slug là duy nhất, dùng làm URL. `parent_id` = null cho danh mục gốc.",
          properties: {
            name: {
              type: "string",
              description: "Tên danh mục hiển thị",
              example: "Kính cận",
            },
            slug: {
              type: "string",
              description: "Slug URL thân thiện (unique, không trùng)",
              example: "kinh-can",
            },
            parent_id: {
              type: "string",
              nullable: true,
              description: "ID danh mục cha — null nếu là danh mục gốc (root)",
              example: null,
            },
          },
        },
        ModelBody: {
          type: "object",
          description:
            "Thông tin tạo / cập nhật mẫu mã kính. Model gắn với loại `frame` hoặc `lens`, tên không được trùng.",
          properties: {
            name: {
              type: "string",
              description: "Tên mẫu mã (unique, không trùng)",
              example: "Aviator",
            },
            type: {
              type: "string",
              enum: ["frame", "lens"],
              description:
                "Loại mẫu mã: `frame` = gọng kính, `lens` = tròng kính",
              example: "frame",
            },
            description: {
              type: "string",
              description: "Mô tả ngắn về kiểu dáng / đặc điểm mẫu mã",
              example: "Thiết kế hình giọt nước kinh điển",
            },
          },
        },
        RegisterBody: {
          type: "object",
          description:
            "Thông tin đăng ký tài khoản khách hàng mới. Sau khi đăng ký thành công, hệ thống gửi email xác thực — tài khoản chưa thể đăng nhập cho đến khi xác thực.",
          required: ["email", "password", "confirm_password"],
          properties: {
            email: {
              type: "string",
              format: "email",
              description:
                "Địa chỉ email — phải là email hợp lệ và chưa được đăng ký",
              example: "admin@gmail.com",
            },
            password: {
              type: "string",
              minLength: 5,
              description: "Mật khẩu — tối thiểu 5 ký tự",
              example: "123456",
            },
            confirm_password: {
              type: "string",
              description: "Xác nhận mật khẩu — phải trùng khớp với `password`",
              example: "123456",
            },
          },
          example: {
            email: "admin@gmail.com",
            password: "123456",
            confirm_password: "123456",
          },
        },
        LoginBody: {
          type: "object",
          description:
            "Đăng nhập bằng email và mật khẩu. Thành công trả về JWT `access_token` — gửi kèm trong header các request cần auth: `Authorization: Bearer <access_token>`.",
          required: ["email", "password"],
          properties: {
            email: {
              type: "string",
              format: "email",
              description: "Email đã đăng ký",
              example: "admin@gmail.com",
            },
            password: {
              type: "string",
              description: "Mật khẩu tài khoản",
              example: "123456",
            },
          },
          example: { email: "admin@gmail.com", password: "123456" },
        },
        CheckoutBody: {
          type: "object",
          description:
            'Thông tin tạo đơn hàng từ giỏ hàng. **`order_type` được server tự động xác định** từ cart items — không cần truyền từ FE. Xem thêm mục "Order State Machine" phía trên. `items` là tùy chọn — nếu không truyền, hệ thống đặt toàn bộ giỏ hàng.',
          required: ["shipping_address", "payment_method"],
          properties: {
            shipping_address: {
              description:
                "Địa chỉ giao hàng — chuỗi thuần hoặc object cấu trúc. Server tự ghép thành chuỗi đầy đủ để lưu vào đơn.",
              oneOf: [
                {
                  type: "string",
                  example: "123 Nguyễn Trãi, P5, Q5, TP.HCM",
                },
                {
                  type: "object",
                  description:
                    "Địa chỉ cấu trúc — server ghép: street + ward + district + city",
                  properties: {
                    street: {
                      type: "string",
                      description: "Số nhà, tên đường",
                      example: "123 Nguyễn Trãi",
                    },
                    ward: {
                      type: "string",
                      description: "Phường / Xã",
                      example: "Phường 5",
                    },
                    district: {
                      type: "string",
                      description: "Quận / Huyện",
                      example: "Quận 5",
                    },
                    city: {
                      type: "string",
                      description: "Tỉnh / Thành phố",
                      example: "TP.HCM",
                    },
                  },
                  example: {
                    street: "123 Nguyễn Trãi",
                    ward: "Phường 5",
                    district: "Quận 5",
                    city: "TP.HCM",
                  },
                },
              ],
            },
            payment_method: {
              type: "string",
              enum: ["cod", "momo"],
              description:
                "`cod` — Thanh toán khi nhận hàng (COD) | `momo` — Thanh toán qua ví MoMo điện tử",
              example: "cod",
            },
            shipping_method: {
              type: "string",
              enum: ["ship", "pickup"],
              description:
                "`ship` — giao hàng tận nơi, cộng phí 30,000 VND | `pickup` — nhận tại cửa hàng, miễn phí",
              example: "ship",
            },
            discount_amount: {
              type: "number",
              description: "Số tiền giảm giá (VND) — trừ vào `total_amount`",
              example: 50000,
            },
            prescription_image: {
              type: "string",
              description:
                "URL ảnh đơn thuốc — upload lên Cloudinary trước, gửi URL vào đây",
              example: "https://cloudinary.com/prescriptions/rx-123.jpg",
            },
            optometrist_name: {
              type: "string",
              description: "Tên bác sĩ / kỹ thuật viên khúc xạ",
              example: "BS. Trần Văn Minh",
            },
            clinic_name: {
              type: "string",
              description: "Tên cơ sở khám mắt",
              example: "Bệnh viện Mắt TP.HCM",
            },
            items: {
              type: "array",
              description:
                "Tùy chọn — nếu không truyền, đặt toàn bộ giỏ hàng hiện tại. Mỗi item là `variant_id` (sản phẩm lẻ) hoặc `combo_id` (combo gọng+tròng).",
              items: {
                type: "object",
                properties: {
                  variant_id: {
                    type: "string",
                    description: "ID của variant (sản phẩm lẻ)",
                    example: "665a1c2d3f4e5a6b7c8d9e0f",
                  },
                  combo_id: {
                    type: "string",
                    description: "ID của combo (gói gọng + tròng)",
                    example: "665a1c2d3f4e5a6b7c8d9e1a",
                  },
                  quantity: {
                    type: "integer",
                    minimum: 1,
                    description: "Số lượng muốn đặt",
                    example: 1,
                  },
                },
              },
              example: [
                { variant_id: "665a1c2d3f4e5a6b7c8d9e0f", quantity: 1 },
                { combo_id: "665a1c2d3f4e5a6b7c8d9e1a", quantity: 2 },
              ],
            },
          },
          example: {
            shipping_address: {
              street: "123 Nguyễn Trãi",
              ward: "Phường 5",
              district: "Quận 5",
              city: "TP.HCM",
            },
            payment_method: "cod",
            shipping_method: "ship",
          },
        },
        ComboCreateBody: {
          type: "object",
          description:
            "Thông tin tạo / cập nhật combo gọng + tròng. Combo gộp 1 frame variant + 1 lens variant bán kèm `combo_price` ưu đãi. Slug phải unique.",
          required: [
            "name",
            "slug",
            "frame_variant_id",
            "lens_variant_id",
            "combo_price",
          ],
          properties: {
            name: {
              type: "string",
              description: "Tên combo hiển thị — nên ghi rõ gọng + tròng",
              example: "Gói Tiêu Chuẩn — Gọng Titan + Tròng Chống UV",
            },
            slug: {
              type: "string",
              description: "Slug URL thân thiện (unique)",
              example: "goi-tieu-chuan-titan-uv",
            },
            description: {
              type: "string",
              description: "Mô tả chi tiết combo, đặc điểm gọng và tròng",
              example:
                "Gói kính hoàn chỉnh: gọng titan không gỉ + tròng chống tia UV 400",
            },
            frame_variant_id: {
              type: "string",
              description: "ID của frame variant (variant.type = 'frame')",
              example: "665a1c2d3f4e5a6b7c8d9e0f",
            },
            lens_variant_id: {
              type: "string",
              description: "ID của lens variant (variant.type = 'lens')",
              example: "665a1c2d3f4e5a6b7c8d9e1a",
            },
            combo_price: {
              type: "number",
              description: "Giá combo (VND) — phải nhỏ hơn tổng giá từng phần",
              minimum: 0,
              example: 1250000,
            },
          },
          example: {
            name: "Gói Tiêu Chuẩn — Gọng Titan + Tròng Chống UV",
            slug: "goi-tieu-chuan-titan-uv",
            description:
              "Gói kính hoàn chỉnh: gọng titan không gỉ + tròng chống tia UV 400",
            frame_variant_id: "665a1c2d3f4e5a6b7c8d9e0f",
            lens_variant_id: "665a1c2d3f4e5a6b7c8d9e1a",
            combo_price: 1250000,
            is_active: true,
          },
        },
        CartAddItemBody: {
          type: "object",
          description:
            "Thêm một sản phẩm vào giỏ hàng. Mỗi request thêm **một** item duy nhất — hoặc `variant_id` (sản phẩm lẻ) hoặc `combo_id` (combo), không được trùng cả hai. Server tự động lưu `price_snapshot` hoặc `combo_price_snapshot` tại thời điểm thêm — giá không đổi trong suốt thời gian nằm trong giỏ. `lens_params` chỉ dùng khi đơn là `prescription`.",
          properties: {
            variant_id: {
              type: "string",
              description:
                "ID variant (sản phẩm lẻ) — dùng khi mua gọng/tròng đơn lẻ. XOR với `combo_id`.",
              example: "665a1c2d3f4e5a6b7c8d9e0f",
            },
            combo_id: {
              type: "string",
              description:
                "ID combo (gói gọng+tròng) — dùng khi mua combo. XOR với `variant_id`.",
              example: "665a1c2d3f4e5a6b7c8d9e1a",
            },
            quantity: {
              type: "integer",
              minimum: 1,
              description: "Số lượng muốn thêm vào giỏ",
              example: 1,
            },
            lens_params: {
              type: "object",
              description:
                "Thông số tròng theo đơn kính (prescription) — chỉ truyền khi đơn làm kính theo đơn thuốc. Server sẽ lưu kèm item.",
              properties: {
                sph_right: {
                  type: "number",
                  description:
                    "SPH mắt phải — công suất cầu vồng (−20 → +20 diop)",
                  example: -2.5,
                },
                sph_left: {
                  type: "number",
                  description:
                    "SPH mắt trái — công suất cầu vồng (−20 → +20 diop)",
                  example: -3.0,
                },
                cyl_right: {
                  type: "number",
                  description:
                    "CYL mắt phải — độ trụ (−6 → +6 diop, 0 nếu không có loạn thị)",
                  example: -0.75,
                },
                cyl_left: {
                  type: "number",
                  description:
                    "CYL mắt trái — độ trụ (−6 → +6 diop, 0 nếu không có loạn thị)",
                  example: -1.0,
                },
                axis_right: {
                  type: "number",
                  description:
                    "Trục mắt phải — góc độ trụ (1 → 180 độ, bắt buộc nếu CYL ≠ 0)",
                  example: 180,
                },
                axis_left: {
                  type: "number",
                  description:
                    "Trục mắt trái — góc độ trụ (1 → 180 độ, bắt buộc nếu CYL ≠ 0)",
                  example: 170,
                },
                add_right: {
                  type: "number",
                  description:
                    "ADD mắt phải — độ cộng kính đa tròng (0 → +4 diop, mặc định 0)",
                  example: 1.5,
                },
                add_left: {
                  type: "number",
                  description:
                    "ADD mắt trái — độ cộng kính đa tròng (0 → +4 diop, mặc định 0)",
                  example: 1.5,
                },
                pd: {
                  type: "number",
                  description: "PD — khoảng cách đồng tử (50 → 80 mm)",
                  example: 63,
                },
              },
              example: {
                sph_right: -2.5,
                sph_left: -3.0,
                cyl_right: -0.75,
                cyl_left: -1.0,
                axis_right: 180,
                axis_left: 170,
                add_right: 1.5,
                add_left: 1.5,
                pd: 63,
              },
            },
          },
          example: {
            variant_id: "665a1c2d3f4e5a6b7c8d9e0f",
            quantity: 1,
            lens_params: {
              sph_right: -2.5,
              sph_left: -3.0,
              cyl_right: -0.75,
              cyl_left: -1.0,
              axis_right: 180,
              axis_left: 170,
              add_right: 1.5,
              add_left: 1.5,
              pd: 63,
            },
          },
        },
        ProductVariantBody: {
          type: "object",
          description:
            "Thông tin tạo / cập nhật biến thể sản phẩm. `stock_type` xác định cách xử lý tồn kho: `in_stock` = bán ngay, `preorder` = đặt trước (chờ nhà cung cấp), `discontinued` = ngừng bán.",
          properties: {
            sku: {
              type: "string",
              description: "Mã SKU (unique)",
              example: "FRAME-RAYBAN-AVIATOR-BLK-M",
            },
            attributes: {
              type: "object",
              description:
                "Thuộc tính biến thể — key/value tùy product (e.g. color, size, material)",
              example: { color: "Đen", size: "M" },
            },
            stock_type: {
              type: "string",
              enum: ["in_stock", "preorder", "discontinued"],
              description:
                "`in_stock` — có sẵn, bán và giao ngay | `preorder` — hết hàng, cần đặt nhà cung cấp | `discontinued` — ngừng kinh doanh",
              default: "in_stock",
              example: "in_stock",
            },
            stock_quantity: {
              type: "integer",
              description: "Số lượng tồn kho thực tế (sau khi trừ reserved)",
              example: 25,
            },
            reserved_quantity: {
              type: "integer",
              description:
                "Số lượng đang được đặt (pre-order) nhưng chưa nhận hàng",
              example: 5,
            },
            available_quantity: {
              type: "integer",
              description:
                "Số lượng thực sự có thể bán = stock_quantity − reserved_quantity (virtual, chỉ đọc)",
              example: 20,
            },
            price: {
              type: "number",
              description: "Giá bán lẻ (VND)",
              example: 1200000,
            },
            images: {
              type: "array",
              items: { type: "string" },
              description: "Mảng URL ảnh biến thể (Cloudinary)",
              example: [
                "https://cloudinary.com/img1.jpg",
                "https://cloudinary.com/img2.jpg",
              ],
            },
          },
        },
        OrderResponse: {
          type: "object",
          description: "Thông tin đơn hàng trả về khi checkout thành công",
          properties: {
            _id: { type: "string", description: "ID đơn hàng" },
            user_id: { type: "string" },
            order_type: {
              type: "string",
              enum: ["stock", "pre_order", "prescription"],
              description: "Tự động detect từ cart items",
            },
            status: { type: "string" },
            total_amount: { type: "number" },
            shipping_fee: { type: "number" },
            discount_amount: { type: "number" },
            final_amount: { type: "number" },
            requires_fabrication: { type: "boolean" },
            shipping_address: { type: "string" },
            created_at: { type: "string", format: "date-time" },
          },
        },
        StaffUserBody: {
          type: "object",
          description:
            "Thông tin tạo / cập nhật nhân viên (staff role: `sales` hoặc `operations`). Password chỉ truyền khi cần đặt mật khẩu mới cho nhân viên mới. Xem thêm user.service.",
          properties: {
            email: {
              type: "string",
              description: "Email công ty của nhân viên (unique)",
              example: "nv.tuan.nguyen@optilens.vn",
            },
            password: {
              type: "string",
              description:
                "Mật khẩu tạm — chỉ truyền khi tạo nhân viên mới hoặc đặt lại mật khẩu",
              example: "StaffPass123@",
            },
            full_name: {
              type: "string",
              description: "Họ và tên đầy đủ",
              example: "Nguyễn Tuấn Anh",
            },
            phone: {
              type: "string",
              description: "Số điện thoại liên hệ nội bộ",
              example: "0901234567",
            },
            role: {
              type: "string",
              enum: ["sales", "operations"],
              description:
                "`sales` — nhân viên bán hàng, xác nhận đơn | `operations` — nhân viên kho/vận hành, đóng gói & giao hàng",
              example: "sales",
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
          responses: {
            200: { description: "OK" },
            403: { description: "Forbidden" },
          },
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
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
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
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
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
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: { 200: { description: "OK" } },
        },
        delete: {
          tags: ["Management"],
          security: [{ bearerAuth: [] }],
          summary: "Xóa manager",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: { 200: { description: "OK" } },
        },
      },
      "/products": {
        get: {
          tags: ["Products"],
          summary: "Danh sách sản phẩm",
          parameters: [
            {
              name: "page",
              in: "query",
              schema: { type: "integer", default: 1 },
            },
            {
              name: "limit",
              in: "query",
              schema: { type: "integer", default: 12 },
            },
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
            "Form-data: `category`, `name`, `type`, `attributes`, `images` (file[]), v.v.",
          requestBody: {
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  required: ["category", "name", "variants"],
                  properties: {
                    category: { type: "string" },
                    name: { type: "string" },
                    type: {
                      type: "string",
                      enum: ["frame", "lens", "accessory"],
                    },
                    brand: { type: "string" },
                    model: { type: "string" },
                    material: { type: "string" },
                    description: { type: "string" },
                    attributes: {
                      type: "object",
                      description:
                        "Thuộc tính sản phẩm tùy loại (frame: color, size; lens: color, material; accessory: material, v.v.)",
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
            {
              name: "slug",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            200: { description: "product + variants" },
            404: { description: "Not found" },
          },
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
          summary: "Thêm biến thể (manager/admin)",
          description:
            "Tạo mới biến thể cho sản phẩm. `stock_type` mặc định là `in_stock`.",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ProductVariantBody" },
              },
            },
          },
          responses: { 201: { description: "Created" } },
        },
      },
      "/products/{productId}/variants/{variantId}": {
        put: {
          tags: ["Products"],
          security: [{ bearerAuth: [] }],
          summary: "Cập nhật biến thể (manager/admin)",
          description:
            "Cập nhật SKU, giá, tồn kho, thuộc tính hoặc `stock_type`. Khi thay đổi `stock_type` → `preorder`, hệ thống giữ nguyên `stock_quantity` nhưng không cho bán trực tiếp.",
          parameters: [
            {
              name: "productId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
            {
              name: "variantId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ProductVariantBody" },
              },
            },
          },
          responses: { 200: { description: "OK" } },
        },
        delete: {
          tags: ["Products"],
          security: [{ bearerAuth: [] }],
          summary: "Xóa biến thể (manager/admin)",
          parameters: [
            {
              name: "productId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
            {
              name: "variantId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: { 200: { description: "OK" } },
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
          summary: "Danh sách danh mục (is_active = true)",
          responses: { 200: { description: "OK" } },
        },
        post: {
          tags: ["Categories"],
          security: [{ bearerAuth: [] }],
          summary: "Tạo danh mục (manager/admin)",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CategoryBody" },
              },
            },
          },
          responses: { 201: { description: "Created" } },
        },
      },
      "/categories/{id}": {
        put: {
          tags: ["Categories"],
          security: [{ bearerAuth: [] }],
          summary: "Cập nhật danh mục (manager/admin)",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CategoryBody" },
              },
            },
          },
          responses: { 200: { description: "OK" } },
        },
        delete: {
          tags: ["Categories"],
          security: [{ bearerAuth: [] }],
          summary: "Xóa danh mục — soft delete (manager/admin)",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
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
          summary: "Tạo thương hiệu (manager/admin)",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/BrandBody" },
              },
            },
          },
          responses: { 201: { description: "Created" } },
        },
      },
      "/brands/{id}": {
        put: {
          tags: ["Brands"],
          security: [{ bearerAuth: [] }],
          summary: "Cập nhật thương hiệu (manager/admin)",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/BrandBody" },
              },
            },
          },
          responses: { 200: { description: "OK" } },
        },
        delete: {
          tags: ["Brands"],
          security: [{ bearerAuth: [] }],
          summary: "Xóa thương hiệu — soft delete (manager/admin)",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
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
          summary: "Tạo model (manager/admin)",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ModelBody" },
              },
            },
          },
          responses: { 201: { description: "Created" } },
        },
      },
      "/models/{id}": {
        put: {
          tags: ["Models"],
          security: [{ bearerAuth: [] }],
          summary: "Cập nhật model (manager/admin)",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ModelBody" },
              },
            },
          },
          responses: { 200: { description: "OK" } },
        },
        delete: {
          tags: ["Models"],
          security: [{ bearerAuth: [] }],
          summary: "Xóa model — soft delete (manager/admin)",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
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
          summary: "Thêm variant vào giỏ hàng",
          description:
            "Thêm **một** variant (sản phẩm lẻ) vào giỏ. Server tự động lưu `price_snapshot`. Nếu variant đã có trong giỏ → cộng dồn số lượng. `lens_params` chỉ truyền khi đơn prescription.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["variant_id", "quantity"],
                  properties: {
                    variant_id: {
                      type: "string",
                      description: "ID variant (bắt buộc)",
                    },
                    quantity: {
                      type: "integer",
                      minimum: 1,
                      description: "Số lượng",
                    },
                    lens_params: {
                      type: "object",
                      description: "Thông số đơn thuốc (prescription)",
                    },
                  },
                  example: {
                    variant_id: "665a1c2d3f4e5a6b7c8d9e0f",
                    quantity: 1,
                    lens_params: { sph_right: -2.5, sph_left: -3.0, pd: 63 },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: "Giỏ hàng đã cập nhật" },
            400: { description: "Hết tồn kho / sản phẩm ngừng bán" },
          },
        },
      },
      "/cart/combo-items": {
        post: {
          tags: ["Cart"],
          security: [{ bearerAuth: [] }],
          summary: "Thêm combo vào giỏ hàng",
          description:
            "Thêm **một** combo (gói gọng + tròng) vào giỏ. Server lưu `combo_price_snapshot` tại thời điểm thêm. `lens_params` chỉ truyền khi đơn prescription.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["combo_id", "quantity"],
                  properties: {
                    combo_id: {
                      type: "string",
                      description: "ID combo (bắt buộc)",
                    },
                    quantity: {
                      type: "integer",
                      minimum: 1,
                      description: "Số lượng combo",
                    },
                    lens_params: {
                      type: "object",
                      description: "Thông số đơn thuốc (prescription)",
                    },
                  },
                  example: {
                    combo_id: "665a1c2d3f4e5a6b7c8d9e1a",
                    quantity: 1,
                    lens_params: { sph_right: -2.5, sph_left: -3.0, pd: 63 },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: "Giỏ hàng đã cập nhật" },
            400: { description: "Combo ngừng bán / hết tồn kho" },
          },
        },
      },
      "/cart/items/{id}": {
        put: {
          tags: ["Cart"],
          security: [{ bearerAuth: [] }],
          summary: "Cập nhật số lượng dòng variant",
          parameters: [
            {
              name: "id",
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
          summary: "Xóa dòng variant",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
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
          summary: "Checkout — tạo đơn từ giỏ hàng (customer)",
          description:
            "Tạo đơn hàng từ giỏ. Server tự động:\n" +
            "1. Detect `order_type` từ cart items (prescription > pre_order > stock)\n" +
            "2. Tính tổng từ `price_snapshot` / `combo_price_snapshot`\n" +
            "3. Tạo `PrescriptionOrder` nếu là đơn prescription\n" +
            "4. Reserve stock cho pre-order",
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
              description: "Đơn hàng đã tạo + payUrl (MoMo)",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      message: {
                        type: "string",
                        example: "Đặt hàng thành công",
                      },
                      order: { $ref: "#/components/schemas/OrderResponse" },
                      payUrl: {
                        type: "string",
                        nullable: true,
                        description: "URL thanh toán MoMo — null nếu COD",
                      },
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
            {
              name: "id",
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
          summary: "Operations cập nhật trạng thái đơn (state machine)",
          description:
            "Cập nhật trạng thái theo state machine tự động validate:\n" +
            "- STOCK: `processing` → `packed` → `shipped` → `delivered`\n" +
            "- PRE_ORDER: `processing` → `received` (hàng về kho) → `packed` → `shipped` → `delivered`\n" +
            "- PRESCRIPTION: `processing` → `manufacturing` (làm tròng) → `packed` → `shipped` → `delivered`\n" +
            "Stock được trừ ở đúng thời điểm: gọng trừ khi `packed`, tròng trừ khi `manufacturing`. Pre-order hoàn reserved khi cancelled/returned.",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
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
                        "received",
                        "manufacturing",
                        "packed",
                        "shipped",
                        "delivered",
                        "return_requested",
                      ],
                      description:
                        "`received` — chỉ pre-order (hàng nhà cung cấp về kho) | `manufacturing` — chỉ prescription (bắt đầu làm tròng)",
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: "OK — trạng thái đã cập nhật, stock đã xử lý" },
            400: {
              description:
                "Transition không hợp lệ theo state machine hoặc role không được phép",
            },
          },
        },
      },
      "/orders": {
        get: {
          tags: ["Orders"],
          security: [{ bearerAuth: [] }],
          summary: "Danh sách đơn hàng của tôi (customer)",
          parameters: [
            { name: "status", in: "query", schema: { type: "string" } },
            {
              name: "page",
              in: "query",
              schema: { type: "integer", default: 1 },
            },
            {
              name: "pageSize",
              in: "query",
              schema: { type: "integer", default: 10 },
            },
          ],
          responses: {
            200: { description: "data[] + pagination" },
            401: { description: "Unauthorized" },
          },
        },
      },
      "/orders/all": {
        get: {
          tags: ["Orders"],
          security: [{ bearerAuth: [] }],
          summary: "Danh sách tất cả đơn (shop — sales/manager/operations)",
          parameters: [
            { name: "status", in: "query", schema: { type: "string" } },
            {
              name: "page",
              in: "query",
              schema: { type: "integer", default: 1 },
            },
            {
              name: "pageSize",
              in: "query",
              schema: { type: "integer", default: 10 },
            },
          ],
          responses: {
            200: { description: "data[] + pagination" },
            403: { description: "Forbidden" },
          },
        },
      },
      "/orders/{id}": {
        get: {
          tags: ["Orders"],
          security: [{ bearerAuth: [] }],
          summary: "Chi tiết đơn hàng",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            200: { description: "order + items + payment" },
            404: { description: "Not found" },
          },
        },
      },
      "/orders/{id}/cancel": {
        put: {
          tags: ["Orders"],
          security: [{ bearerAuth: [] }],
          summary: "Customer hủy đơn hàng",
          description:
            "Chỉ pending hoặc confirmed, chỉ chủ đơn mới được hủy. Dùng state machine validation.",
          parameters: [
            {
              name: "id",
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
                    reason: {
                      type: "string",
                      description: "Lý do hủy (tùy chọn)",
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: "Đã hủy đơn" },
            400: { description: "Không thể hủy ở trạng thái hiện tại" },
            403: { description: "Không có quyền" },
          },
        },
      },
      "/products/{id}": {
        put: {
          tags: ["Products"],
          security: [{ bearerAuth: [] }],
          summary: "Cập nhật sản phẩm (multipart — manager/admin)",
          description:
            "Hỗ trợ form-data với file ảnh mới upload lên Cloudinary",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  properties: {
                    category: { type: "string" },
                    name: { type: "string" },
                    type: {
                      type: "string",
                      enum: ["frame", "lens", "accessory"],
                    },
                    brand: { type: "string" },
                    model: { type: "string" },
                    material: { type: "string" },
                    description: { type: "string" },
                    images: {
                      type: "array",
                      items: { type: "string", format: "binary" },
                    },
                    is_active: { type: "boolean" },
                  },
                },
              },
            },
          },
          responses: { 200: { description: "OK" } },
        },
        delete: {
          tags: ["Products"],
          security: [{ bearerAuth: [] }],
          summary: "Xóa sản phẩm + toàn bộ biến thể (manager/admin)",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: { 200: { description: "OK" } },
        },
      },
      "/products/{id}/active": {
        patch: {
          tags: ["Products"],
          security: [{ bearerAuth: [] }],
          summary: "Ẩn/hiện sản phẩm (manager/admin)",
          description: "Toggle is_active — gọi nhiều lần để chuyển trạng thái",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            200: { description: "OK — trả về trạng thái is_active mới" },
          },
        },
      },
      "/payment/success": {
        get: {
          tags: ["Payments"],
          summary: "Payment success callback — FE gọi sau khi redirect từ MoMo",
          description:
            "Không cần auth. FE decode signed token từ redirect URL để lấy orderId.",
          parameters: [
            {
              name: "orderId",
              in: "query",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            200: { description: "OK" },
            500: { description: "Lỗi server" },
          },
        },
      },
      "/payment/fail": {
        get: {
          tags: ["Payments"],
          summary: "Payment failed callback",
          parameters: [
            { name: "orderId", in: "query", schema: { type: "string" } },
            { name: "msg", in: "query", schema: { type: "string" } },
          ],
          responses: {
            200: { description: "OK" },
            500: { description: "Lỗi server" },
          },
        },
      },
      "/momo/create": {
        post: {
          tags: ["MoMo"],
          security: [{ bearerAuth: [] }],
          summary: "Tạo thanh toán MoMo (server-side)",
          description:
            "Gọi MoMo API để tạo payment, trả về payUrl hoặc deeplink để redirect user",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: [
                    "amount",
                    "orderId",
                    "orderInfo",
                    "redirectUrl",
                    "ipnUrl",
                  ],
                  properties: {
                    amount: {
                      type: "number",
                      description: "Số tiền thanh toán",
                    },
                    orderId: { type: "string", description: "ID đơn hàng" },
                    orderInfo: {
                      type: "string",
                      description: "Mô tả thanh toán",
                    },
                    redirectUrl: {
                      type: "string",
                      description: "URL redirect sau thanh toán",
                    },
                    ipnUrl: {
                      type: "string",
                      description: "URL nhận IPN từ MoMo",
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: "MoMo response — payUrl, deeplink, v.v.",
              content: {
                "application/json": { schema: { type: "object" } },
              },
            },
          },
        },
      },
      "/momo/return": {
        get: {
          tags: ["MoMo"],
          summary: "MoMo redirect sau khi thanh toán",
          description:
            "MoMo tự redirect về URL này. Server verify signature rồi redirect FE.",
          responses: {
            302: {
              description:
                "Redirect đến FE /checkout/success hoặc /checkout/fail",
            },
          },
        },
      },
      "/momo/ipn": {
        post: {
          tags: ["MoMo"],
          summary: "MoMo IPN (Instant Payment Notification)",
          description:
            "MoMo server gọi khi thanh toán xử lý xong. Verify HMAC signature để xác thực.",
          responses: {
            200: {
              description:
                "OK — resultCode: 0 = thành công, trả về `{ message, resultCode: 0 }`",
            },
            400: { description: "Signature không hợp lệ hoặc lỗi khác" },
          },
        },
      },
    },
  };
}

module.exports = getOpenApiSpec;
