# OptiLens Shop — FE Integration Guide

> Tài liệu dành cho Frontend Developer tích hợp API OptiLens Shop.

---

## Mục lục

1. [Cấu hình & Auth](#1-cấu-hình--auth)
2. [Luồng mua hàng tổng quan](#2-luồng-mua-hàng-tổng-quan)
3. [Cart — Giỏ hàng](#3-cart--giỏ-hàng)
4. [Checkout — Tạo đơn hàng](#4-checkout--tạo-đơn-hàng)
5. [Order — Trạng thái đơn hàng](#5-order--trạng-thái-đơn-hàng)
6. [Products — Sản phẩm](#6-products--sản-phẩm)
7. [Combos — Gói combo](#7-combos--gói-combo)
8. [Các trường hợp đặc biệt](#8-các-trường-hợp-đặc-biệt)
9. [Lỗi thường gặp & xử lý](#9-lỗi-thường-gặp--xử-lý)
10. [Checklist trước khi release](#10-checklist-trước-khi-release)

---

## 1. Cấu hình & Auth

### 1.1 Base URL

```
Development: http://localhost:3001
Production:  https://api.optilensshop.vn  (tùy config)
```

### 1.2 Auth Header

Tất cả request cần auth đều gửi header:

```
Authorization: Bearer <access_token>
```

### 1.3 Auth Flow

```
┌─────────────────┐       ┌──────────────────┐       ┌─────────────────┐
│  User nhập email │  →   │  POST /auth/login │  →   │  Lưu access_token │
│  + password      │       │                  │       │  vào localStorage │
└─────────────────┘       └──────────────────┘       └─────────────────┘
```

```js
// Ví dụ: đăng nhập
const res = await fetch("/api/v1/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
});
const { access_token, user } = await res.json();
localStorage.setItem("access_token", access_token);
```

### 1.4 Mỗi request gửi token

```js
// Interceptor cho axios hoặc fetch wrapper
function authFetch(url, options = {}) {
  const token = localStorage.getItem("access_token");
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  });
}
```

### 1.5 Refresh token (khi token hết hạn)

- Server trả về **401 Unauthorized** khi token hết hạn
- FE cần redirect user về trang login, xóa token

```js
// Axios interceptor example
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("access_token");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  },
);
```

### 1.6 Đăng xuất

```js
// Gọi API logout → clear token
await fetch("/api/v1/auth/logout", {
  method: "POST",
  headers: { Authorization: `Bearer ${token}` },
});
localStorage.removeItem("access_token");
```

---

## 2. Luồng mua hàng tổng quan

```
┌─────────────────────────────────────────────────────────────────┐
│                      LUỒNG MUA HÀNG                             │
│                                                                 │
│  ① Xem sản phẩm                                               │
│     GET /products → list sản phẩm                              │
│     GET /products/{slug} → chi tiết + variants                  │
│                                                                 │
│  ② Thêm vào giỏ (không cần chọn order_type)                   │
│     POST /cart/items        → variant đơn lẻ                   │
│     POST /cart/combo-items  → combo gọng+tròng                   │
│                                                                 │
│  ③ Xem giỏ hàng                                                │
│     GET /cart → danh sách items + giá (price_snapshot)          │
│                                                                 │
│  ④ Checkout → Tự động detect order_type                        │
│     POST /orders/checkout                                      │
│     Server tự xác định: stock | pre_order | prescription        │
│     → Tạo đơn, tạo PrescriptionOrder (nếu cần)                 │
│                                                                 │
│  ⑤ Theo dõi đơn hàng                                           │
│     GET /orders             → danh sách đơn của tôi            │
│     GET /orders/{id}        → chi tiết + trạng thái             │
│     GET /orders/{id}/status → lịch sử trạng thái                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Cart — Giỏ hàng

### 3.1 Lấy giỏ hàng

```
GET /api/v1/cart
Authorization: Bearer <token>
```

**Response:**

```json
{
  "user_id": "...",
  "items": [
    {
      "variant_id": {
        "_id": "...",
        "sku": "FRAME-RB-AVI-BLK-M",
        "price": 1200000,
        "stock_quantity": 25,
        "stock_type": "in_stock",
        "available_quantity": 20,
        "product_id": { "name": "Ray-Ban Aviator", "type": "frame" }
      },
      "quantity": 2,
      "price_snapshot": 1200000,
      "lens_params": null
    },
    {
      "combo_id": {
        "_id": "...",
        "name": "Gói Tiêu Chuẩn",
        "combo_price": 1800000,
        "frame_variant_id": { "product_id": { "name": "Gọng Titan" } },
        "lens_variant_id": { "product_id": { "name": "Tròng UV" } }
      },
      "quantity": 1,
      "combo_price_snapshot": 1800000,
      "lens_params": {
        "sph_right": -2.5,
        "sph_left": -3.0,
        "cyl_right": -0.75,
        "cyl_left": -1.0,
        "axis_right": 180,
        "axis_left": 170,
        "add_right": 1.5,
        "add_left": 1.5,
        "pd": 63
      }
    }
  ],
  "updated_at": "2026-04-20T10:00:00Z"
}
```

### 3.2 Thêm variant đơn lẻ

```
POST /api/v1/cart/items
Body: { variant_id, quantity }
```

**Luồng FE:**

1. User chọn variant → nhấn "Thêm vào giỏ"
2. Gửi `POST /cart/items`
3. Nếu thành công → hiển thị cart badge + toast "Đã thêm vào giỏ"
4. Nếu lỗi → hiển thị message (hết hàng / ngừng bán / vượt tồn kho)

**Payload:**

```js
// Thêm gọng kính (không prescription)
{
  "variant_id": "665a1c2d3f4e5a6b7c8d9e0f",
  "quantity": 1
}

// Thêm tròng (có prescription → cần lens_params)
{
  "variant_id": "665a1c2d3f4e5a6b7c8d9e1a",
  "quantity": 1,
  "lens_params": {
    "sph_right": -2.5,
    "sph_left": -3.0,
    "cyl_right": -0.75,
    "cyl_left": -1.0,
    "axis_right": 180,
    "axis_left": 170,
    "add_right": 0,
    "add_left": 0,
    "pd": 63
  }
}
```

### 3.3 Thêm combo

```
POST /api/v1/cart/combo-items
Body: { combo_id, quantity }
```

**Khi nào dùng combo?**

- Khi user chọn mua gói gọng + tròng cùng lúc
- Giá combo rẻ hơn mua lẻ
- Combo tự động ghép 1 frame + 1 lens đã được admin cấu hình

**Payload:**

```js
// Combo không có đơn thuốc
{ "combo_id": "...", "quantity": 1 }

// Combo có đơn thuốc (khi mua tròng RX)
{
  "combo_id": "...",
  "quantity": 1,
  "lens_params": {
    "sph_right": -2.5,
    "sph_left": -3.0,
    "pd": 63
  }
}
```

### 3.4 Cập nhật số lượng

```
PUT /api/v1/cart/items/{variant_id}
Body: { quantity, lens_params? }
```

```js
// Tăng số lượng
await fetch(`/api/v1/cart/items/${variantId}`, {
  method: "PUT",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({ quantity: 3 }),
});

// Cập nhật đơn thuốc (prescription)
await fetch(`/api/v1/cart/items/${variantId}`, {
  method: "PUT",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({
    quantity: 1,
    lens_params: { sph_right: -2.5, sph_left: -3.0, pd: 63 },
  }),
});
```

### 3.5 Xóa item khỏi giỏ

```
DELETE /api/v1/cart/items/{variant_id}     → xóa variant
DELETE /api/v1/cart/combo-items/{combo_id} → xóa combo
DELETE /api/v1/cart/clear                   → xóa toàn bộ giỏ
```

### 3.6 Tính tổng giá trong giỏ

```js
function calculateCartTotal(cart) {
  return cart.items.reduce((sum, item) => {
    if (item.variant_id) {
      // Sản phẩm lẻ — dùng price_snapshot (hoặc price hiện tại)
      const price = item.price_snapshot ?? item.variant_id.price;
      return sum + price * item.quantity;
    }
    if (item.combo_id) {
      // Combo — dùng combo_price_snapshot (hoặc combo_price hiện tại)
      const price = item.combo_price_snapshot ?? item.combo_id.combo_price;
      return sum + price * item.quantity;
    }
    return sum;
  }, 0);
}
```

> ⚠️ **Lưu ý:** Luôn dùng `price_snapshot` / `combo_price_snapshot` — đảm bảo giá không đổi trong suốt thời gian nằm trong giỏ. Nếu không có snapshot, fallback về giá hiện tại.

---

## 4. Checkout — Tạo đơn hàng

### 4.1 API

```
POST /api/v1/orders/checkout
Authorization: Bearer <token>
```

### 4.2 Payload

```js
{
  "shipping_address": {
    "street": "123 Nguyễn Trãi",
    "ward": "Phường 5",
    "district": "Quận 5",
    "city": "TP.HCM"
  },
  "payment_method": "cod",        // hoặc "momo"
  "shipping_method": "ship",     // "ship" = giao tận nơi (+30,000đ)
                                  // "pickup" = nhận tại cửa hàng (miễn phí)
  "discount_amount": 50000,       // tùy chọn, số tiền giảm giá

  // ⚠️ KHÔNG cần truyền order_type — server tự detect!
  // items là tùy chọn — nếu không truyền, đặt TOÀN BỘ giỏ hàng
  "items": [
    { "variant_id": "...", "quantity": 1 },
    { "combo_id": "...", "quantity": 1 }
  ],

  // Nếu cart có lens_params (đơn prescription):
  "prescription_image": "https://cloudinary.com/rx-123.jpg",
  "optometrist_name": "BS. Trần Văn Minh",
  "clinic_name": "Bệnh viện Mắt TP.HCM"
}
```

### 4.3 Auto-detect order_type (không cần FE)

Server tự động xác định loại đơn hàng:

```
Quy tắc: PRESCRIPTION > PRE_ORDER > STOCK

① Có lens_params (đơn thuốc)?
   → order_type = "prescription"

② Có variant stock_type = "preorder" hoặc combo có gọng hết hàng?
   → order_type = "pre_order"

③ Còn lại (gọng có sẵn, không có đơn thuốc)
   → order_type = "stock"
```

**FE KHÔNG cần truyền `order_type`** — chỉ cần gửi cart items + shipping, server tự xử lý.

### 4.4 Đọc kết quả checkout

```js
const res = await fetch("/api/v1/orders/checkout", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify(checkoutData),
});

const data = await res.json();

if (res.ok) {
  // ✅ Thành công
  const { order, payUrl } = data;

  if (order.order_type === "prescription") {
    // Hiển thị: "Đơn của bạn đang chờ xác nhận đơn thuốc"
  }

  if (payUrl) {
    // MoMo → redirect đến payUrl
    window.location.href = payUrl;
  } else {
    // COD → hiển thị trang thành công
    showOrderSuccess(order);
  }
} else {
  // ❌ Lỗi
  showError(data.message);
}
```

**Response thành công:**

```json
{
  "message": "Đặt hàng thành công",
  "order": {
    "_id": "665a...",
    "order_type": "prescription",
    "status": "pending",
    "total_amount": 2400000,
    "shipping_fee": 30000,
    "discount_amount": 50000,
    "final_amount": 2380000,
    "requires_fabrication": true,
    "shipping_address": "123 Nguyễn Trãi, Phường 5, Quận 5, TP.HCM",
    "created_at": "2026-04-20T10:00:00Z"
  },
  "payUrl": null // null = COD, có URL = MoMo
}
```

### 4.5 Luồng thanh toán MoMo

```
Checkout (COD)
   │
   └── Hiển thị thành công → xong

Checkout (MoMo)
   │
   └── Nhận payUrl → redirect user đến MoMo
        │
        └── User thanh toán trên MoMo app
             │
             ├── Thành công → MoMo redirect về /payment/success?orderId=...
             │                   → FE gọi GET /orders/{id} để lấy chi tiết
             │
             └── Thất bại → MoMo redirect về /payment/fail?orderId=...&msg=...
                               → FE hiển thị thông báo lỗi
```

**FE xử lý MoMo return:**

```js
// Trang /payment/success
const orderId = new URLSearchParams(window.location.search).get("orderId");
const res = await fetch(`/api/v1/orders/${orderId}`, {
  headers: { Authorization: `Bearer ${token}` },
});
const order = await res.json();
showOrderSuccess(order);

// Trang /payment/fail
const msg = new URLSearchParams(window.location.search).get("msg");
showError(msg || "Thanh toán thất bại. Vui lòng thử lại.");
```

---

## 5. Order — Trạng thái đơn hàng

### 5.1 Danh sách đơn của tôi

```
GET /api/v1/orders?page=1&pageSize=10
```

### 5.2 Chi tiết đơn hàng

```
GET /api/v1/orders/{id}
```

**Response đầy đủ:**

```json
{
  "_id": "665a...",
  "order_type": "prescription",
  "status": "manufacturing",
  "total_amount": 2400000,
  "shipping_fee": 30000,
  "discount_amount": 50000,
  "final_amount": 2380000,
  "requires_fabrication": true,
  "shipping_address": "...",
  "items": [
    {
      "_id": "...",
      "variant_id": { "name": "Ray-Ban Aviator", "type": "frame" },
      "quantity": 1,
      "unit_price": 1200000,
      "lens_params": null,
      "item_type": "frame"
    },
    {
      "_id": "...",
      "variant_id": { "name": "Tròng Chống UV", "type": "lens" },
      "quantity": 1,
      "unit_price": 1200000,
      "lens_params": {
        "sph_right": -2.5,
        "sph_left": -3.0,
        "cyl_right": -0.75,
        "cyl_left": -1.0,
        "axis_right": 180,
        "axis_left": 170,
        "add_right": 1.5,
        "add_left": 1.5,
        "pd": 63
      },
      "item_type": "lens"
    }
  ],
  "payment": {
    "amount": 2380000,
    "method": "cod",
    "status": "pending"
  },
  "prescriptions": [
    {
      "sph_right": -2.5,
      "sph_left": -3.0,
      "cyl_right": -0.75,
      "cyl_left": -1.0,
      "axis_right": 180,
      "axis_left": 170,
      "add_right": 1.5,
      "add_left": 1.5,
      "pd": 63,
      "optometrist_name": "BS. Trần Văn Minh",
      "clinic_name": "Bệnh viện Mắt TP.HCM",
      "prescription_image": "https://..."
    }
  ],
  "created_at": "2026-04-20T10:00:00Z"
}
```

### 5.3 State Machine — 3 nhánh đơn hàng

```
┌──────────────────────────────────────────────────────────────────┐
│ STOCK                                                           │
│ pending → confirmed → processing → packed → shipped → delivered  │
├──────────────────────────────────────────────────────────────────┤
│ PRE_ORDER                                                       │
│ pending → confirmed → processing → received → packed → shipped  │
│                                                    → delivered  │
├──────────────────────────────────────────────────────────────────┤
│ PRESCRIPTION                                                    │
│ pending → confirmed → processing → manufacturing → packed      │
│                                                   → shipped      │
│                                                   → delivered   │
└──────────────────────────────────────────────────────────────────┘
         ↓                  ↓                   ↓
      hủy được          hủy được           KHÔNG hủy
      (pending, confirmed)
```

### 5.4 Hiển thị trạng thái cho user

```js
const STATUS_CONFIG = {
  pending: { label: "Chờ xác nhận", color: "orange", icon: "⏳" },
  confirmed: { label: "Đã xác nhận", color: "blue", icon: "✓" },
  processing: { label: "Đang xử lý", color: "blue", icon: "⚙️" },
  received: { label: "Hàng về kho", color: "blue", icon: "📦" },
  manufacturing: { label: "Đang làm tròng", color: "purple", icon: "🔬" },
  packed: { label: "Đã đóng gói", color: "green", icon: "📦" },
  shipped: { label: "Đang giao", color: "cyan", icon: "🚚" },
  delivered: { label: "Đã giao", color: "green", icon: "✅" },
  completed: { label: "Hoàn thành", color: "gray", icon: "🏆" },
  cancelled: { label: "Đã hủy", color: "red", icon: "❌" },
  return_requested: { label: "Yêu cầu đổi/trả", color: "orange", icon: "↩️" },
  returned: { label: "Đã trả hàng", color: "red", icon: "↩️" },
  refunded: { label: "Đã hoàn tiền", color: "red", icon: "💰" },
};

// Hàm hiển thị timeline
function OrderTimeline({ currentStatus, orderType }) {
  const steps = getStepsForOrderType(orderType);
  const currentIdx = steps.indexOf(currentStatus);

  return (
    <div className="timeline">
      {steps.map((step, idx) => (
        <div key={step} className={`step ${idx <= currentIdx ? "active" : ""}`}>
          {STATUS_CONFIG[step].icon}
          <span>{STATUS_CONFIG[step].label}</span>
        </div>
      ))}
    </div>
  );
}

function getStepsForOrderType(orderType) {
  if (orderType === "prescription") {
    return [
      "pending",
      "confirmed",
      "processing",
      "manufacturing",
      "packed",
      "shipped",
      "delivered",
    ];
  }
  if (orderType === "pre_order") {
    return [
      "pending",
      "confirmed",
      "processing",
      "received",
      "packed",
      "shipped",
      "delivered",
    ];
  }
  return [
    "pending",
    "confirmed",
    "processing",
    "packed",
    "shipped",
    "delivered",
  ];
}
```

### 5.5 Cancel — Hủy đơn

```
PUT /api/v1/orders/{id}/cancel
Body: { reason?: string }
```

**Chỉ cho phép khi:**

- User là chủ đơn
- Trạng thái: `pending` hoặc `confirmed`
- Order type KHÔNG phải `prescription` ở giai đoạn sau

```js
async function cancelOrder(orderId, reason) {
  const res = await fetch(`/api/v1/orders/${orderId}/cancel`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ reason }),
  });

  if (res.ok) {
    showSuccess("Đơn đã được hủy");
    refreshOrderList();
  } else {
    const data = await res.json();
    showError(data.message); // "Không thể hủy đơn ở trạng thái 'processing'"
  }
}
```

---

## 6. Products — Sản phẩm

### 6.1 Danh sách sản phẩm

```
GET /api/v1/products?page=1&limit=12&search=rayban&category_id=...
```

### 6.2 Chi tiết sản phẩm

```
GET /api/v1/products/{slug}
```

### 6.3 Biến thể (variants)

```
GET /api/v1/products/{id}/variants
```

**Cấu trúc variant:**

```json
{
  "_id": "...",
  "sku": "FRAME-RB-AVI-BLK-M",
  "attributes": { "color": "Đen", "size": "M" },
  "stock_type": "in_stock", // "in_stock" | "preorder" | "discontinued"
  "stock_quantity": 25,
  "reserved_quantity": 5,
  "available_quantity": 20, // stock_quantity - reserved_quantity
  "price": 1200000,
  "images": ["url1", "url2"]
}
```

### 6.4 FE hiển thị stock status

```js
function StockBadge({ variant }) {
  if (variant.stock_type === "discontinued") {
    return <span className="badge discontinued">Ngừng bán</span>;
  }
  if (variant.stock_type === "preorder") {
    return <span className="badge preorder">📦 Đặt trước 7-14 ngày</span>;
  }
  if (variant.available_quantity <= 0) {
    return <span className="badge out-of-stock">Hết hàng</span>;
  }
  if (variant.available_quantity <= 5) {
    return (
      <span className="badge low-stock">
        Chỉ còn {variant.available_quantity} cái
      </span>
    );
  }
  return <span className="badge in-stock">Còn hàng</span>;
}
```

### 6.5 Thêm vào giỏ — validation phía FE

```js
async function addToCart(variant, quantity = 1) {
  // 1. Kiểm tra stock_type
  if (variant.stock_type === "discontinued") {
    toast.error("Sản phẩm này đã ngừng kinh doanh");
    return;
  }

  // 2. Kiểm tra available_quantity
  if (
    variant.stock_type === "in_stock" &&
    variant.available_quantity < quantity
  ) {
    toast.error(`Chỉ còn ${variant.available_quantity} cái trong kho`);
    return;
  }

  // 3. Nếu là tròng (type === "lens") → bắt buộc nhập lens_params
  if (variant.product_id?.type === "lens") {
    if (!lensParams) {
      showPrescriptionForm();
      return; // chờ user nhập đơn thuốc
    }
    await cartService.addItem(variant._id, quantity, lensParams);
  } else {
    await cartService.addItem(variant._id, quantity);
  }

  toast.success("Đã thêm vào giỏ");
  updateCartBadge();
}
```

---

## 7. Combos — Gói combo

### 7.1 Danh sách combo

```
GET /api/v1/combos?page=1&limit=10
```

### 7.2 Chi tiết combo

```
GET /api/v1/combos/{slug}
```

**Response:**

```json
{
  "_id": "...",
  "name": "Gói Tiêu Chuẩn — Gọng Titan + Tròng UV",
  "slug": "goi-tieu-chuan-titan-uv",
  "description": "...",
  "combo_price": 1800000,
  "frame_variant_id": {
    "product_id": { "name": "Gọng Titan Pro", "type": "frame" },
    "attributes": { "color": "Đen" },
    "price": 1200000, // giá gốc
    "stock_type": "in_stock"
  },
  "lens_variant_id": {
    "product_id": { "name": "Tròng Chống UV400", "type": "lens" },
    "attributes": { "index": "1.67" },
    "price": 800000, // giá gốc
    "stock_type": "in_stock"
  },
  "is_active": true
}
```

### 7.3 FE hiển thị combo card

```jsx
function ComboCard({ combo }) {
  const frame = combo.frame_variant_id;
  const lens = combo.lens_variant_id;
  const totalOriginal = frame.price + lens.price;
  const savings = totalOriginal - combo.combo_price;

  return (
    <div className="combo-card">
      <img src={frame.images?.[0]} alt={frame.product_id.name} />
      <h3>{combo.name}</h3>
      <p>
        {frame.product_id.name} + {lens.product_id.name}
      </p>

      <div className="price-section">
        <span className="combo-price">{formatVND(combo.combo_price)}</span>
        <span className="original-price">{formatVND(totalOriginal)}</span>
        <span className="savings-badge">Tiết kiệm {formatVND(savings)}</span>
      </div>

      <button
        disabled={
          frame.stock_type === "discontinued" ||
          lens.stock_type === "discontinued"
        }
        onClick={() => showAddToCart(combo)}
      >
        {frame.stock_type === "preorder" || lens.stock_type === "preorder"
          ? "Đặt trước"
          : "Mua combo"}
      </button>
    </div>
  );
}
```

---

## 8. Các trường hợp đặc biệt

### 8.1 Prescription — đơn làm kính theo đơn thuốc

```
Khi nào: Cart có item có lens_params (tròng theo đơn kính)
Server tự: order_type = "prescription"
           requires_fabrication = true
           Tạo PrescriptionOrder lưu đơn thuốc
Flow:      pending → confirmed → processing → manufacturing → packed → shipped → delivered
```

**FE cần làm:**

1. Form nhập đơn thuốc (SPH, CYL, AXIS, ADD, PD)
2. Gửi `lens_params` kèm cart item
3. Hiển thị badge "Đơn prescription" trong order list
4. Hiển thị chi tiết đơn thuốc trong order detail

**Form đơn thuốc:**

```jsx
function PrescriptionForm({ onSubmit }) {
  const [params, setParams] = useState({
    sph_right: "",
    sph_left: "",
    cyl_right: "",
    cyl_left: "",
    axis_right: "",
    axis_left: "",
    add_right: "",
    add_left: "",
    pd: "",
  });

  const handleSubmit = () => {
    // Validation
    if (!params.sph_right || !params.sph_left || !params.pd) {
      toast.error("Vui lòng nhập đầy đủ SPH và PD");
      return;
    }
    if (
      (params.cyl_right !== "0" && !params.axis_right) ||
      (params.cyl_left !== "0" && !params.axis_left)
    ) {
      toast.error("CYL ≠ 0 → bắt buộc nhập Axis");
      return;
    }
    onSubmit(params);
  };
}
```

### 8.2 Pre-order — đặt trước (hết hàng)

```
Khi nào: Variant có stock_type = "preorder" (hết hàng, chờ nhà cung cấp)
Server tự: order_type = "pre_order"
           reserved_quantity tăng (chưa trừ stock)
Flow:      pending → confirmed → processing → received → packed → shipped → delivered
Thời gian: 7-14 ngày
```

**FE hiển thị:**

```jsx
{
  stock_type === "preorder" && (
    <div className="preorder-banner">
      ⚠️ Sản phẩm đang hết hàng. Đặt trước 7-14 ngày. Không cần thanh toán
      trước.
    </div>
  );
}
```

### 8.3 Mixed cart — giỏ hàng nhiều loại

```
Ví dụ: Giỏ có gọng (stock) + tròng (prescription)
→ order_type = "prescription" (loại nặng nhất)
→ Gọng: trừ stock khi packed
→ Tròng: làm tròng → trừ stock khi manufacturing
→ Giao: gọng có thể giao trước, tròng chờ làm xong
```

**FE không cần xử lý gì đặc biệt** — server tự phân loại. Chỉ cần hiển thị đúng order_type trong UI.

### 8.4 Gộp tròng vào combo

```
Khi user chọn combo + nhập lens_params
→ Trong giỏ: combo item + lens_params
→ Checkout: order_type = "prescription"
→ Server tách: frame → giao ngay, lens → làm tròng
→ Có 2 OrderItem: frame (item_type=frame) + lens (item_type=lens)
```

---

## 9. Lỗi thường gặp & xử lý

### 9.1 Mã lỗi từ server

```js
const ERROR_MESSAGES = {
  // Cart
  "variant_id không hợp lệ": "Sản phẩm không tồn tại",
  "Sản phẩm này đã ngừng kinh doanh": "Sản phẩm ngừng bán, không thể thêm",
  "Số lượng vượt quá tồn kho": "Số lượng vượt tồn kho hiện có",
  "Giỏ hàng trống": "Không có sản phẩm nào trong giỏ",

  // Order
  "Số lượng đặt không hợp lệ": "Số lượng phải lớn hơn 0",
  "Không tìm thấy biến thể": "Sản phẩm đã thay đổi, vui lòng cập nhật giỏ",
  "Combo không còn hiệu lực": "Combo đã bị ngừng, vui lòng chọn combo khác",
  "Số lượng combo vượt tồn kho": "Số lượng vượt tồn kho gọng hoặc tròng",

  // State machine
  "Không thể hủy đơn ở trạng thái 'processing'":
    "Đơn đang xử lý, không thể hủy",
  "Không thể chuyển từ 'processing' sang 'shipped'":
    "Đơn phải qua bước 'packed' trước",
  "Chỉ nhân viên operations được cập nhật trạng thái này": "Lỗi quyền hạn",

  // Payment
  "Thanh toán thất bại": "Thanh toán MoMo không thành công, vui lòng thử lại",
  "Đơn đã thanh toán": "Đơn đã được thanh toán trước đó",
};
```

### 9.2 Xử lý lỗi chung

```js
async function handleApiCall(apiCall) {
  try {
    const res = await apiCall();
    return { success: true, data: await res.json() };
  } catch (err) {
    // Network error
    if (!err.response) {
      toast.error("Không có kết nối. Vui lòng kiểm tra internet.");
      return { success: false, error: "NETWORK_ERROR" };
    }

    const { message, error } = err.response.data;

    // 401 → logout
    if (err.response.status === 401) {
      localStorage.removeItem("access_token");
      window.location.href = "/login";
      return { success: false, error: "UNAUTHORIZED" };
    }

    // 400/500 → hiển thị message
    toast.error(message || "Đã xảy ra lỗi. Vui lòng thử lại.");
    return { success: false, error: message };
  }
}
```

### 9.3 Validation lens_params

```js
function validateLensParams(params) {
  const errors = [];

  if (params.sph_right === "" || params.sph_left === "") {
    errors.push("SPH bắt buộc cho cả hai mắt");
  }
  if (params.pd === "" || params.pd < 50 || params.pd > 80) {
    errors.push("PD phải từ 50-80mm");
  }
  if (
    params.cyl_right !== "0" &&
    params.cyl_right !== "" &&
    !params.axis_right
  ) {
    errors.push("CYL mắt phải ≠ 0 → bắt buộc nhập Axis phải");
  }
  if (params.cyl_left !== "0" && params.cyl_left !== "" && !params.axis_left) {
    errors.push("CYL mắt trái ≠ 0 → bắt buộc nhập Axis trái");
  }
  if (params.add_right && (params.add_right < 0 || params.add_right > 4)) {
    errors.push("ADD phải từ 0-4 diop");
  }
  if (params.add_left && (params.add_left < 0 || params.add_left > 4)) {
    errors.push("ADD phải từ 0-4 diop");
  }

  return errors;
}
```

---

## 10. Checklist trước khi release

### Auth

- [ ] Token được lưu đúng chỗ (localStorage)
- [ ] 401 → redirect login
- [ ] Logout → clear token

### Cart

- [ ] Thêm variant → cập nhật badge số lượng
- [ ] Thêm combo → cập nhật badge
- [ ] Price snapshot hiển thị đúng (không nhảy giá)
- [ ] Stock badge hiển thị đúng (in_stock / preorder / discontinued)
- [ ] Out of stock → disable nút thêm giỏ

### Prescription

- [ ] Form nhập đơn thuốc đầy đủ (SPH, CYL, AXIS, ADD, PD)
- [ ] Validation: CYL ≠ 0 → bắt buộc Axis
- [ ] Gửi lens_params kèm cart item
- [ ] Hiển thị trạng thái "Đơn làm kính" trong order list
- [ ] Chi tiết order hiển thị thông số đơn thuốc

### Pre-order

- [ ] Banner "Đặt trước 7-14 ngày" cho variant preorder
- [ ] Không check stock khi thêm (preorder được phép)

### Checkout

- [ ] KHÔNG gửi `order_type` (server tự detect)
- [ ] COD → hiển thị trang thành công
- [ ] MoMo → redirect payUrl
- [ ] Kết quả trả về có `order._id` → lưu để tracking

### Order tracking

- [ ] Timeline hiển thị đúng nhánh (stock / pre_order / prescription)
- [ ] Trạng thái manufacturing cho prescription
- [ ] Trạng thái received cho pre_order
- [ ] Cancel chỉ enabled khi pending/confirmed
- [ ] Trạng thái cancelled/returned → hiển thị lý do

### Payment

- [ ] MoMo success → FE gọi API lấy order detail
- [ ] MoMo fail → hiển thị message lỗi
- [ ] COD → payment status pending → paid khi delivered
