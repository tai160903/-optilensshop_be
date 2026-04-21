# FE Implementation Guide (OptiLens BE)

Tài liệu này dành cho FE để triển khai UI theo đúng logic backend hiện tại.

## 1) Base Information

- Base URL local: `http://localhost:{PORT}`
- Auth header:
  - `Authorization: Bearer <access_token>`
- Response lỗi phổ biến:
  - `{ "message": "..." }`

## 2) Roles và quyền UI

- `customer`
  - Xem sản phẩm, giỏ hàng, checkout, xem đơn của mình, hủy đơn của mình.
- `sales`
  - Xem đơn shop, xác nhận/từ chối đơn.
- `operations`
  - Xem đơn shop, cập nhật trạng thái vận hành.
- `manager`
  - Quản lý product/variant/category/brand/model/combo, staff.
- `admin`
  - Tất cả quyền manager + quản lý managers + xem đơn shop.

## 3) Product/Variant cho UI Catalog

### 3.1 Endpoints chính

- `GET /products`
- `GET /products/:slug`
- `GET /products/:id/variants`

### 3.2 Các field variant quan trọng

- `price`
- `stock_quantity`
- `reserved_quantity`
- `stock_type`: `in_stock | preorder | discontinued`
- `available_quantity` (virtual): `stock_quantity - reserved_quantity`

### 3.3 Quy tắc hiển thị FE

- Nếu `stock_type = discontinued`: disable mua hàng, badge "Ngừng bán".
- Nếu `stock_type = preorder`: badge "Pre-order", cho phép mua nhưng thông báo thời gian chờ.
- Nếu `stock_type = in_stock`:
  - Chỉ cho tăng quantity <= `available_quantity`.

## 4) Cart UI

### 4.1 Endpoints

- `GET /cart`
- `POST /cart/items` (thêm variant hoặc combo)
- `PUT /cart/items/:id`
- `DELETE /cart/items/:id`
- `PUT /cart/combo-items/:combo_id`
- `DELETE /cart/combo-items/:combo_id`
- `DELETE /cart/clear`

### 4.2 Payload add item

- Variant:
  - `variant_id`, `quantity`, optional `lens_params`
- Combo:
  - `combo_id`, `quantity`, optional `lens_params`

### 4.3 UI notes

- Giữ `lens_params` theo từng dòng item.
- Khi backend báo vượt tồn kho, hiển thị lỗi ngay tại line item.

## 5) Checkout và tạo Order

### 5.1 Endpoint

- `POST /orders/checkout`

### 5.2 Backend tự detect order_type

Không cần FE gửi `order_type`.

Rule backend:
- Có `lens_params` -> `prescription`
- Không có lens params nhưng có `stock_type = preorder` -> `pre_order`
- Còn lại -> `stock`

### 5.3 Payload đề xuất FE gửi

- `shipping_address` (string hoặc object)
- `payment_method`: `cod | momo`
- `shipping_method`: `ship | pickup`
- Optional:
  - `discount_amount`
  - `items` (nếu checkout một phần cart)
  - `prescription_image`, `optometrist_name`, `clinic_name`

### 5.4 Response quan trọng

- `order`
- `payUrl`:
  - Có giá trị nếu `payment_method = momo`
  - `null` nếu COD

## 6) Order List/Detail cho FE

### 6.1 Endpoints customer

- `GET /orders`
- `GET /orders/:id`
- `PUT /orders/:id/cancel`

### 6.2 Endpoints internal shop

- `GET /orders/all` (sales/manager/operations/admin)
- `POST /orders/:id/confirm` (sales)
- `PUT /orders/:id/status` (operations)

### 6.3 Quyền xem chi tiết đơn

- Chủ đơn được xem.
- Nội bộ `sales/manager/operations/admin` được xem.

## 7) State Machine để FE render action button

### 7.1 Stock order

- `pending -> confirmed -> processing -> packed -> shipped -> delivered -> completed`

### 7.2 Pre-order

- `pending -> confirmed -> processing -> received -> packed -> shipped -> delivered -> completed`

### 7.3 Prescription (gia công)

- `pending -> confirmed -> processing -> manufacturing -> packed -> shipped -> delivered -> completed`

### 7.4 Cancel/Return

- Cancel:
  - Từ `pending` hoặc `confirmed` -> `cancelled`
- Return:
  - `delivered -> return_requested -> returned/refunded`

### 7.5 Gợi ý FE button map

- Customer:
  - `pending|confirmed`: hiện nút "Hủy đơn"
- Sales:
  - `pending`: hiện "Xác nhận đơn" / "Từ chối đơn"
- Operations:
  - dựa `status` hiện tại để hiện đúng next action duy nhất theo flow.

## 8) Inventory business rules FE nên hiểu

- `pre_order`:
  - Checkout sẽ reserve số lượng.
  - Khi `received`: reserve giảm, stock tăng.
  - Khi `packed`: trừ stock thực tế.
- `prescription`:
  - `manufacturing`: trừ stock phần lens.
  - `packed`: trừ stock phần còn lại.

Lưu ý: tồn kho luôn do backend quyết định, FE chỉ dùng để hiển thị và chặn UX cơ bản.

## 9) Payment Flow

### 9.1 COD

- Tạo order xong là hoàn tất checkout.
- Payment status sẽ cập nhật theo trạng thái đơn (ví dụ delivered).

### 9.2 MoMo

- Sau checkout lấy `payUrl` để redirect.
- Backend có các endpoint:
  - `/momo/return`
  - `/momo/ipn`
  - `/payment/success`, `/payment/fail`

FE chỉ cần:
- redirect user sang `payUrl`
- xử lý trang success/fail theo callback URL.

## 10) Validation/UI guard nên có phía FE

- Không cho quantity < 1.
- Không cho add to cart khi discontinued.
- Với in_stock: không vượt `available_quantity`.
- Bắt buộc địa chỉ và phương thức thanh toán khi checkout.
- Disable submit khi request đang pending (tránh double submit).

## 11) Suggested FE modules

- `authApi`
- `productApi`
- `cartApi`
- `orderApi`
- `managementApi`
- `paymentApi`

Mỗi module nên normalize error về cùng format:
- `message`
- `statusCode`
- `raw` (optional)

## 12) Quick UI checklist

- Catalog page:
  - filter/search/pagination từ `GET /products`
- Product detail page:
  - variant selector + stock badge + add to cart
- Cart page:
  - line item update/remove + checkout CTA
- Checkout page:
  - shipping/payment + momo redirect
- My orders page:
  - list + detail + cancel
- Admin/Manager pages:
  - product CRUD + variant CRUD + toggle active
- Shop operations pages:
  - order queue + status transitions

---

Nếu BE thay đổi thêm state/field mới, cập nhật tài liệu này cùng lúc để FE bám đúng.
