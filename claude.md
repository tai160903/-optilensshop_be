# SPEC.md — Hệ thống Bán Kính Mắt Trực Tuyến

> Tài liệu phân tích yêu cầu, kiến trúc, công nghệ và kế hoạch triển khai cho dự án.

---

## 1. Tổng Quan Dự Án

### 1.1 Tên dự án

**OptiLens Shop** — Hệ thống bán kính mắt trực tuyến

### 1.2 Mô tả ngắn

Hệ thống E-commerce chuyên biệt cho kính mắt, hỗ trợ 3 loại đơn hàng: **kính có sẵn**, **pre-order**, và **prescription (làm kính theo đơn)**.

### 1.3 Phạm vi

- Website thương mại điện tử đa vai trò
- Quản lý sản phẩm kính (gọng + tròng)
- Xử lý đơn hàng theo nhiều loại nghiệp vụ khác nhau

---

## 2. Các Vấn Đề Cần Giải Quyết

### 2.1 Vấn đề nghiệp vụ chính

| #   | Vấn đề                           | Chi tiết                                                                                        |
| --- | -------------------------------- | ----------------------------------------------------------------------------------------------- |
| 1   | **Đơn hàng đa dạng**             | 3 loại đơn khác nhau (có sẵn, pre-order, prescription) → cần workflow riêng                     |
| 2   | **Quản lý biến thể phức tạp**    | Kính có nhiều thuộc tính: kiểu gọng, size, màu sắc, tròng kèm theo → Sản phẩm biến thể đa chiều |
| 3   | **Prescription Management**      | Quản lý đơn thuốc (SPH, CYL, AXIS, ADD) → cần validation, gia công tròng                        |
| 4   | **Multi-role System**            | 5 vai trò khác nhau với quyền hạn riêng → RBAC phức tạp                                         |
| 5   | **Inventory theo từng loại đơn** | Pre-order: nhập kho sau đặt hàng; Prescription: gia công sau đặt                                |
| 6   | **Quản lý combo & khuyến mãi**   | Combo gọng + tròng, giá theo quy tắc phức tạp                                                   |
| 7   | **Tracking đơn hàng**            | Cập nhật trạng thái theo từng giai đoạn xử lý                                                   |
| 8   | **Chính sách linh hoạt**         | Đổi/trả/bảo hành theo quy định riêng                                                            |

### 2.2 Rủi ro đã nhận diện

- **Rủi ro CAO**: Quản lý prescription data (yêu cầu độ chính xác cao)
- **Rủi ro TRUNG BÌNH**: Đồng bộ inventory giữa các loại đơn
- **Rủi ro TRUNG BÌNH**: Xử lý đơn pre-order (phụ thuộc nhà cung cấp)

---

## 3. Phân Tích Vai Trò & Quyền Hạn

### 3.1 Role: Customer

- **Mục tiêu**: Mua kính dễ dàng, trải nghiệm tốt
- **Chức năng chính**:
  - [ ] Duyệt danh mục, lọc, tìm kiếm sản phẩm
  - [ ] Xem chi tiết sản phẩm
  - [ ] Đặt hàng: có sẵn / pre-order / prescription
  - [ ] Giỏ hàng, checkout, thanh toán
  - [ ] Quản lý tài khoản, lịch sử đơn hàng
  - [ ] Yêu cầu đổi/trả

### 3.2 Role: Sales

- **Mục tiêu**: Hỗ trợ khách hàng, xử lý đơn hàng
- **Chức năng chính**:
  - [ ] Tiếp nhận và xử lý đơn hàng
  - [ ] Kiểm tra thông số prescription → liên hệ khách điều chỉnh nếu cần
  - [ ] Xác nhận đơn hàng → chuyển Operations
  - [ ] Xử lý đơn pre-order
  - [ ] Xử lý khiếu nại: đổi trả, bảo hành, hoàn tiền

### 3.3 Role: Operations Staff

- **Mục tiêu**: Thực hiện các tác vụ vật lý với đơn hàng
- **Chức năng chính**:
  - [ ] Đóng gói sản phẩm, tạo vận đơn
  - [ ] Cập nhật tracking vận chuyển
  - [ ] Tiếp nhận hàng pre-order về kho
  - [ ] Gia công lắp tròng, làm kính (prescription)
  - [ ] Cập nhật trạng thái đơn hàng

### 3.4 Role: Manager

- **Mục tiêu**: Quản lý kinh doanh và nhân sự
- **Chức năng chính**:
  - [ ] Quản lý quy định nghiệp vụ, chính sách mua/đổi trả/bảo hành
  - [ ] Quản lý sản phẩm: cấu hình biến thể thuộc tính
  - [ ] Quản lý giá bán, combo, khuyến mãi
  - [ ] Quản lý người dùng, nhân sự
  - [ ] Xem báo cáo doanh thu

### 3.5 Role: System Admin

- **Mục tiêu**: Vận hành hệ thống
- **Chức năng chính**:
  - [ ] Cấu hình hệ thống
  - [ ] Quản trị chức năng
  - [ ] Monitoring, logs

---

## 4. Kiến Trúc Hệ Thống Đề Xuất

### 4.1 Kiến trúc tổng thể: Express Monolith

```
┌─────────────────────────────────────────────────────┐
│                    CLIENT LAYER                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │  Web (React) │  │ Mobile App  │  │ Admin Panel  │ │
│  │             │  │  (React     │  │  (React +    │ │
│  │             │  │   Native)   │  │   Ant Design)│ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘ │
└─────────┼────────────────┼────────────────┼─────────┘
          │                │                │
┌─────────▼────────────────▼────────────────▼─────────┐
│              EXPRESS MONOLITH (API Server)           │
│  ┌──────────────────────────────────────────────────┐│
│  │ Auth │ Product │ Order │ Payment │ Prescription ││
│  │ User │ Inventory │ Notification │ Report        ││
│  └──────────────────────────────────────────────────┘│
│              REST API + Swagger + JWT Auth            │
└─────────────────────────┬───────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────┐
│                    DATA LAYER                        │
│  ┌──────────────────┐  ┌────────────────────────┐  │
│  │  MongoDB          │  │  Local File Storage    │  │
│  │  (Database)       │  │  (Images / RX files)   │  │
│  └──────────────────┘  └────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### 4.2 Cấu trúc thư mục (Backend - Express)

```
backend/
├── src/
│   ├── app.js                  # Express app setup
│   ├── server.js               # Entry point
│   ├── config/                 # Cấu hình env, database
│   │   ├── db.js               # MongoDB connection
│   │   └── env.js              # Environment config
│   ├── middlewares/            # Shared middlewares
│   │   ├── auth.middleware.js  # JWT verify
│   │   ├── rbac.middleware.js  # Role-based access
│   │   ├── validate.middleware.js
│   │   └── error.middleware.js
│   ├── modules/
│   │   ├── auth/               # Authentication + JWT + RBAC
│   │   │   ├── auth.routes.js
│   │   │   ├── auth.controller.js
│   │   │   ├── auth.service.js
│   │   │   └── auth.validation.js
│   │   ├── users/              # User management
│   │   ├── products/           # Product catalog + variants
│   │   ├── orders/             # Order processing (3 loại đơn)
│   │   ├── payments/           # Payment integration
│   │   ├── prescriptions/      # Prescription/RX management
│   │   ├── inventory/          # Warehouse & stock
│   │   ├── notifications/      # Email/SMS notifications
│   │   └── reports/            # Revenue & analytics
│   ├── models/                 # Mongoose models/schemas
│   └── uploads/                # Local file uploads (images, RX)
├── test/                       # Jest tests
├── .env                        # Environment variables
├── .env.example
├── package.json
└── README.md
```

### 4.3 Cấu trúc thư mục (Frontend - Next.js/React)

```
frontend/
├── src/
│   ├── app/                  # Next.js App Router
│   │   ├── (auth)/          # Auth pages (login, register)
│   │   ├── (shop)/          # Customer pages
│   │   │   ├── products/
│   │   │   ├── cart/
│   │   │   ├── checkout/
│   │   │   └── orders/
│   │   ├── (admin)/         # Admin pages
│   │   │   ├── dashboard/
│   │   │   ├── products/
│   │   │   ├── orders/
│   │   │   ├── users/
│   │   │   └── settings/
│   │   └── api/             # API routes (if BFF pattern)
│   ├── components/
│   │   ├── ui/              # Base UI components
│   │   ├── product/         # Product-related
│   │   ├── cart/            # Cart components
│   │   └── admin/           # Admin components
│   ├── hooks/               # Custom React hooks
│   ├── services/            # API clients
│   ├── stores/              # State management
│   ├── lib/                 # Utilities
│   └── types/               # TypeScript types
├── public/
│   └── images/              # Static assets
└── package.json
```

---

## 5. Công Nghệ Đề Xuất

### 5.1 Backend

| Layer           | Công nghệ                           | Lý do chọn                                                  |
| --------------- | ----------------------------------- | ----------------------------------------------------------- |
| **Runtime**     | Node.js 20+ (JavaScript/TypeScript) | Phù hợp I/O-intensive, ecosystem lớn                        |
| **Framework**   | Express.js                          | Nhẹ, linh hoạt, dễ cấu hình, cộng đồng lớn                  |
| **Database**    | MongoDB (Mongoose ODM)              | Schema linh hoạt, phù hợp đơn hàng đa dạng, hỗ trợ JSON tốt |
| **Auth**        | jsonwebtoken + bcryptjs             | Stateless JWT, role-based access control                    |
| **Validation**  | Joi / Zod                           | Runtime validation mạnh, schema-driven                      |
| **Docs**        | swagger-jsdoc + swagger-ui-express  | API documentation tự động                                   |
| **File Upload** | Multer + local storage              | Đơn giản cho dev, dễ migrate sang S3 sau                    |
| **Logging**     | Morgan + Winston                    | HTTP request logs + log tập trung                           |
| **Testing**     | Jest + Supertest                    | Unit + integration tests                                    |

### 5.2 Frontend

| Layer          | Công nghệ                | Lý do chọn                         |
| -------------- | ------------------------ | ---------------------------------- |
| **Framework**  | Next.js 14+ (App Router) | SSR/SSG, SEO, routing mạnh         |
| **UI Library** | TailwindCSS + shadcn/ui  | Customizable, đẹp, performance tốt |
| **State**      | Zustand / TanStack Query | State nhẹ, cache API               |
| **Form**       | React Hook Form + Zod    | Performance, validation mạnh       |
| **Animation**  | Framer Motion            | Animation mượt cho UI              |
| **i18n**       | next-intl                | Đa ngôn ngữ                        |
| **Charts**     | Recharts / Tremor        | Báo cáo dashboard                  |

---

## 6. Danh Sách Thư Viện Chi Tiết

### 6.1 Backend Dependencies

```json
{
  "dependencies": {
    "express": "^4.18.0",
    "mongoose": "^8.0.0",
    "jsonwebtoken": "^9.0.0",
    "bcryptjs": "^2.4.3",
    "joi": "^17.11.0",
    "multer": "^1.4.4",
    "morgan": "^1.10.0",
    "winston": "^3.0.0",
    "helmet": "^7.0.0",
    "cors": "^2.8.5",
    "dotenv": "^16.0.0",
    "uuid": "^9.0.0",
    "dayjs": "^1.11.0",
    "swagger-jsdoc": "^6.0.0",
    "swagger-ui-express": "^5.0.0",
    "express-rate-limit": "^7.0.0",
    "express-async-errors": "^3.0.0",
    "nodemailer": "^6.9.0",
    "socket.io": "^4.6.0",
    "stripe": "^14.0.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.0",
    "@types/node": "^20.0.0",
    "@types/bcryptjs": "^2.4.0",
    "@types/cors": "^2.8.0",
    "@types/multer": "^1.4.0",
    "@types/jsonwebtoken": "^9.0.0",
    "@types/uuid": "^9.0.0",
    "typescript": "^5.0.0",
    "ts-node": "^10.0.0",
    "nodemon": "^3.0.0",
    "jest": "^29.0.0",
    "@types/jest": "^29.0.0",
    "supertest": "^6.0.0",
    "@types/supertest": "^6.0.0",
    "eslint": "^8.0.0",
    "prettier": "^3.0.0"
  }
}
```

### 6.2 Frontend Dependencies

```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "@tanstack/react-query": "^5.0.0",
    "zustand": "^4.0.0",
    "react-hook-form": "^7.0.0",
    "@hookform/resolvers": "^3.0.0",
    "zod": "^3.22.0",
    "axios": "^1.0.0",
    "@stripe/stripe-js": "^2.0.0",
    "@stripe/react-stripe-js": "^2.0.0",
    "framer-motion": "^10.0.0",
    "clsx": "^2.0.0",
    "tailwind-merge": "^2.0.0",
    "lucide-react": "^0.300.0",
    "date-fns": "^3.0.0",
    "next-intl": "^3.0.0",
    "sonner": "^1.0.0",
    "embla-carousel-react": "^8.0.0",
    "recharts": "^2.10.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^18.0.0",
    "@types/react-dom": "^18.0.0",
    "typescript": "^5.0.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.0.0",
    "autoprefixer": "^10.0.0",
    "eslint": "^8.0.0",
    "eslint-config-next": "^14.0.0",
    "prettier": "^3.0.0",
    "prettier-plugin-tailwindcss": "^0.5.0",
    "husky": "^8.0.0",
    "lint-staged": "^14.0.0"
  }
}
```

---

## 7. Thiết Kế Database (ERD Summary)

### 7.1 Các bảng chính

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│    Users    │────▶│ UserProfiles │     │   Categories    │
├─────────────┤     └──────────────┘     ├─────────────────┤
│ id          │                           │ id              │
│ email       │     ┌──────────────┐     │ name            │
│ password    │     │  Addresses   │     │ parent_id       │
│ role        │     ├──────────────┤     │ slug            │
│ status      │     │ id           │     │ is_active       │
│ created_at  │     │ user_id      │     └─────────────────┘
└──────┬──────┘     │ full_name    │              │
       │            │ phone        │              │ 1:N
       │            │ address      │              ▼
       │            │ is_default   │     ┌─────────────────┐
       │            └──────────────┘     │    Products      │
       │                                  ├─────────────────┤
       │ 1:1              1:N            │ id               │
       ▼            ┌─────────────────┐  │ category_id      │
┌─────────────┐    │    Orders       │  │ sku              │
│  Wallets    │    ├─────────────────┤  │ name             │
├─────────────┤    │ id              │  │ slug             │
│ id          │    │ user_id         │  │ description      │
│ user_id     │    │ order_type      │  │ price            │
│ balance     │    │ status          │  │ images           │
│ currency    │    │ total_amount    │  │ is_active        │
└─────────────┘    │ shipping_fee    │  └─────────────────┘
                  │ shipping_address│          │
                  │ created_at      │          │ 1:N
                  └────────┬────────┘          ▼
                           │           ┌─────────────────────┐
                           │           │  ProductVariants   │
                           │           ├─────────────────────┤
                           │           │ id                  │
                           │           │ product_id          │
                           │           │ sku                 │
                           │           │ attributes (JSON)   │
                           │           │ price               │
                           │           │ stock_quantity      │
                           │           │ images              │
                           │           └─────────────────────┘
                           │                    │
                           │ 1:N                │
                           ▼                    ▼
                  ┌─────────────────────┐ ┌─────────────────────┐
                  │   OrderItems        │ │  PrescriptionOrders │
                  ├─────────────────────┤ ├─────────────────────┤
                  │ id                   │ │ id                   │
                  │ order_id            │ │ order_id            │
                  │ variant_id          │ │ sph_right           │
                  │ quantity            │ │ sph_left            │
                  │ unit_price          │ │ cyl_right           │
                  │ lens_params (JSON)  │ │ cyl_left            │
                  └─────────────────────┘ │ axis_right          │
                                          │ axis_left           │
┌──────────────┐                          │ add_right           │
│  Inventory   │                          │ add_left            │
├──────────────┤                          │ pd                  │
│ id           │                          │ pupillary_distance  │
│ variant_id   │                          │ expiration_date     │
│ warehouse_id │                          │ eye_exam_date       │
│ quantity     │                          │ prescription_image  │
│ reserved_qty │                          │ optometrist_name    │
│ available_qty│                          │ clinic_name         │
└──────────────┘                          └─────────────────────┘

┌──────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Warehouses  │     │  Payments    │     │   Promotions    │
├──────────────┤     ├──────────────┤     ├─────────────────┤
│ id           │     │ id           │     │ id              │
│ name         │     │ order_id     │     │ code            │
│ address      │     │ amount       │     │ type            │
│ is_active    │     │ method       │     │ discount_value  │
└──────────────┘     │ status       │     │ min_order_value │
                     │ transaction_id│    │ start_date      │
                     │ paid_at      │     │ end_date        │
                     └──────────────┘     │ is_active       │
                                          └─────────────────┘

┌──────────────────┐
│  ProductReviews  │
├──────────────────┤
│ id               │
│ user_id          │
│ product_id       │
│ rating           │
│ comment          │
│ images           │
│ created_at       │
└──────────────────┘
```

---

## 8. API Design (Key Endpoints)

### 8.1 Authentication

```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
POST   /api/v1/auth/refresh
POST   /api/v1/auth/forgot-password
POST   /api/v1/auth/reset-password
GET    /api/v1/auth/me
```

### 8.2 Products

```
GET    /api/v1/products                    # List with filters
GET    /api/v1/products/:slug              # Detail
GET    /api/v1/products/:id/variants       # Get variants
POST   /api/v1/admin/products              # Create (Manager)
PUT    /api/v1/admin/products/:id          # Update (Manager)
DELETE /api/v1/admin/products/:id          # Delete (Manager)
GET    /api/v1/products/:id/reviews         # Product reviews
```

### 8.3 Orders

```
POST   /api/v1/orders                      # Create order
GET    /api/v1/orders                      # List user orders
GET    /api/v1/orders/:id                  # Order detail
PUT    /api/v1/orders/:id/cancel           # Cancel order
POST   /api/v1/admin/orders/:id/confirm     # Sales confirm
POST   /api/v1/admin/orders/:id/process     # Ops process
POST   /api/v1/admin/orders/:id/ship        # Ops ship
PUT    /api/v1/orders/:id/tracking         # Update tracking
```

### 8.4 Prescription

```
POST   /api/v1/prescriptions/validate     # Validate RX
POST   /api/v1/prescriptions/upload       # Upload RX image
GET    /api/v1/prescriptions/history       # User RX history
```

### 8.5 Cart & Checkout

```
GET    /api/v1/cart
POST   /api/v1/cart/items
PUT    /api/v1/cart/items/:id
DELETE /api/v1/cart/items/:id
POST   /api/v1/cart/prescription            # Add prescription to cart
POST   /api/v1/checkout
POST   /api/v1/checkout/payment/intent      # Stripe payment
```

---

## 9. Order Workflow State Machine

```
┌──────────┐
│  PENDING │  ← Customer tạo đơn
└────┬─────┘
     │ Sales xác nhận
     ▼
┌──────────────┐
│  CONFIRMED   │  ← Sales check prescription (nếu có)
└────┬─────────┘
     │ Chuyển Operations
     ▼
┌──────────────┐
│  PROCESSING  │  ← Phân loại xử lý:
└────┬─────────┘     - Stock: đóng gói
     │               - Pre-order: đặt hàng nhà cung cấp
     │               - Prescription: làm tròng
     ▼
┌──────────────────┐
│  MANUFACTURING   │  ← Prescription: đang gia công tròng
└────────┬─────────┘
         │ Hoàn thành
         ▼
┌──────────────┐
│   PACKED     │  ← Đóng gói xong
└────┬─────────┘
     │ Tạo vận đơn
     ▼
┌──────────────┐
│   SHIPPED    │  ← Đã bàn giao vận chuyển
└────┬─────────┘
     │ Giao hàng thành công
     ▼
┌──────────────┐
│  DELIVERED   │  ← Hoàn thành
└────┬─────────┘
     │ Quá hạn đổi trả
     ▼
┌──────────────┐
│  COMPLETED   │
└──────────────┘

─── Trạng thái hủy ───
PENDING/CONFIRMED ──▶ CANCELLED
Any status ─────────▶ RETURN_REQUESTED ──▶ RETURNED/REFUNDED
```

---

## 10. Kế Hoạch Triển Khai (Phases)

### Phase 1: MVP — Auth + Products + Cart + Orders + Prescription (P0) ⭐

**Ước tính: 6-8 tuần**

#### Backend (3-4 tuần)

- [ ] Setup Express project + MongoDB connection
- [ ] Auth module: register, login, JWT, RBAC (5 roles)
- [ ] Users module: CRUD + profile + addresses
- [ ] Products module: CRUD + categories + variants
- [ ] Cart module: add/update/remove items
- [ ] Orders module: create + state machine (3 loại đơn)
- [ ] Prescriptions module: input + validation + link to order

#### Frontend (3-4 tuần)

- [ ] Setup Next.js + Tailwind + shadcn/ui
- [ ] Auth pages: login, register, forgot password
- [ ] Product catalog: list, detail, filters, search
- [ ] Cart page + checkout flow
- [ ] Order placement: chọn loại đơn (có sẵn/pre-order/prescription)
- [ ] Prescription input form
- [ ] User dashboard: order history, profile

---

### Phase 2: Core v1.1 — Payments + Inventory + Notifications (P1) 🟡

**Ước tính: 4-6 tuần**

#### Backend

- [ ] Payments module: Stripe integration + COD
- [ ] Refund flow cho đổi trả
- [ ] Inventory module: stock tracking, reservations
- [ ] Low-stock alerts
- [ ] Notifications module: email (Nodemailer) + in-app (Socket.io)

#### Frontend

- [ ] Checkout: Stripe Elements integration
- [ ] Payment success/failure pages
- [ ] In-app notification bell
- [ ] Admin: inventory management UI
- [ ] Admin: order processing workflow UI

---

### Phase 3: Enhancement v1.2 — Reports + Promo (P2) 🟢

**Ước tính: 4-6 tuần**

#### Backend

- [ ] Reports module: revenue, orders, inventory aggregation
- [ ] Promotions module: promo codes, combo pricing
- [ ] Wallet/points ledger (optional)

#### Frontend

- [ ] Admin dashboard: charts (Recharts)
- [ ] Admin: promo code management
- [ ] Product reviews + ratings UI

---

### Phase 4: Polish & Launch (P0-P2)

**Ước tính: 2-4 tuần**

- [ ] Unit tests + Integration tests (Jest + Supertest)
- [ ] Security audit: JWT, RBAC, input validation
- [ ] Performance optimization: indexes, pagination
- [ ] SEO: meta tags, sitemap, structured data
- [ ] UAT (User Acceptance Testing)
- [ ] Production deployment (Vercel / Railway / VPS)

---

### Tổng ước tính: **16-24 tuần**

### Milestone Summary

| Tuần  | Backend                        | Frontend                   |
| ----- | ------------------------------ | -------------------------- |
| 1-2   | Express setup, MongoDB schemas | Next.js setup, auth UI     |
| 3-4   | Auth + Users module            | Login, register, profile   |
| 5-6   | Products + Categories          | Catalog, product detail    |
| 7-8   | Cart + Orders (3 types)        | Cart, checkout, order form |
| 9-10  | Prescription module            | RX input form              |
| 11-14 | Payments + Inventory           | Stripe, admin inventory    |
| 15-16 | Notifications + Reports        | Dashboard, notifications   |
| 17-18 | Promotions + Wallet            | Promo, reviews             |
| 19-20 | Testing, polish, deploy        | UAT, launch                |

---

## 11. Môi Trường Phát Triển

### 11.1 Yêu cầu

- Node.js 20+
- MongoDB (local hoặc MongoDB Atlas)
- pnpm / npm

### 11.2 Biến môi trường (.env)

```env
# Database
MONGODB_URI="mongodb://localhost:27017/optilens"

# JWT
JWT_ACCESS_TOKEN_SECRET="your-jwt-secret-key"
JWT_EXPIRES_IN="7d"

# App
PORT=3001
NODE_ENV="development"

# Frontend URL (for CORS)
FRONTEND_URL="http://localhost:3000"

# File Upload
UPLOAD_DIR="./uploads"
MAX_FILE_SIZE=5242880
```

---

## 12. Tiêu Chuẩn Code

### 12.1 Git Convention

```
feat: add new feature
fix: bug fix
docs: documentation
style: formatting
refactor: code refactoring
test: adding tests
chore: maintenance
```

### 12.2 Code Review Checklist

- [ ] TypeScript strict mode compliance
- [ ] Unit tests cho services (Jest)
- [ ] No console.log (dùng Winston + Morgan logger)
- [ ] API validation với Joi/Zod schemas
- [ ] Error handling nhất quán (Express error middleware)
- [ ] Security: JWT verify, RBAC middleware, input sanitization
- [ ] MongoDB: proper indexing, no N+1 (dùng populate/aggregation)
- [ ] Accessibility (WCAG 2.1 AA) cho UI

---

## 13. Roadmap Tiếp Theo

1. **Ngay**: Tạo Express project structure, kết nối MongoDB
2. **Tuần 1-2**: Auth module (JWT + RBAC) + Users module
3. **Tuần 3-4**: Products module + Categories + Variants
4. **Tuần 5-6**: Cart + Orders module (3 loại đơn)
5. **Tuần 7-8**: Prescription module + validation
6. **Tuần 9-10**: Frontend core (Next.js + auth + catalog)
7. **Tuần 11-12**: Checkout + Payment integration
8. **Tuần 13-14**: Inventory + Admin UI
9. **Tuần 15+**: Tiếp tục theo Phase plan

---

_Lần cuối cập nhật: 2026-04-19_
