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
  - Quản lý product/variant/category/brand/model/combo, staff, xem thống kê tổng quan.
- `admin`
  - Tất cả quyền manager + quản lý managers + xem đơn shop + xem thống kê nâng cao.

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

`lens_params` nên gửi theo object rõ ràng:
- `sph_right`, `sph_left`
- `cyl_right`, `cyl_left`
- `axis_right`, `axis_left`
- `add_right`, `add_left`
- `pd` hoặc `pupillary_distance`
- `note` (optional)

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
    - mỗi item có thể có `lens_params` theo cùng format ở mục Cart
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

## 11) Statistics Dashboard (Manager/Admin)

### 11.1 Endpoints

- `GET /statistics/overview` (role: `manager`, `admin`)
- `GET /statistics/admin` (role: `admin`)
- `GET /statistics/timeseries` (role: `manager`, `admin`)
- `GET /statistics/top-products` (role: `manager`, `admin`)
- `GET /statistics/inventory-alerts` (role: `manager`, `admin`)
- `GET /statistics/funnel` (role: `manager`, `admin`)

### 11.2 Query params

- `start_date` (ISO datetime, optional)
- `end_date` (ISO datetime, optional)

Nếu không truyền:
- `end_date` = thời điểm hiện tại
- `start_date` = `end_date - 30 ngày`

### 11.3 Response chính cho `overview`

- `period.start_date`, `period.end_date`
- `orders`
  - `total`
  - `completed`
  - `completion_rate` (%)
  - `by_status` (object theo từng trạng thái đơn)
- `revenue.total` (tổng `final_amount` của đơn `delivered/completed`)
- `payments[]`
  - `method`, `status`, `count`, `amount`

### 11.4 Response thêm cho `admin`

- `users.active_customers`
- `users.new_customers_by_status`
- `staff.by_role` (`sales`, `operations`, `manager`)

### 11.5 Gợi ý UI

- Dashboard manager: dùng `overview` để render KPI doanh thu, tỉ lệ hoàn tất, biểu đồ trạng thái đơn, payment mix.
- Dashboard admin: dùng `admin` để bổ sung block nhân sự và tăng trưởng user.

### 11.6 Timeseries chart

Endpoint: `GET /statistics/timeseries`

Query:
- `start_date`, `end_date` (optional)
- `group_by`: `day | week | month` (default `day`)

Response:
- `group_by`
- `points[]`
  - `label` (ví dụ: `2026-04-21`, `2026-W17`, `2026-04`)
  - `revenue`
  - `orders`

### 11.7 Top products

Endpoint: `GET /statistics/top-products`

Query:
- `start_date`, `end_date` (optional)
- `limit` (default 10, max 50)

Response:
- `items[]`
  - `variant_id`, `sku`
  - `product_name`, `product_type`
  - `sold_quantity`
  - `revenue`

### 11.8 Inventory alerts

Endpoint: `GET /statistics/inventory-alerts`

Query:
- `threshold` (default 10)
- `limit` (default 50, max 200)

Response:
- `total_alerts`
- `items[]` gồm:
  - `variant_id`, `sku`, `product_name`
  - `stock_quantity`, `reserved_quantity`, `available_quantity`
  - `stock_type`

### 11.9 Funnel

Endpoint: `GET /statistics/funnel`

Query:
- `start_date`, `end_date` (optional)

Response:
- `total_orders`
- `steps[]`:
  - `status`
  - `count`
  - `ratio` (% trên tổng đơn trong kỳ)

## 12) Suggested FE modules

- `authApi`
- `productApi`
- `cartApi`
- `orderApi`
- `managementApi`
- `paymentApi`
- `statisticsApi`

Mỗi module nên normalize error về cùng format:
- `message`
- `statusCode`
- `raw` (optional)

## 13) Quick UI checklist

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
