# OptiLens Backend System Overview

Tai lieu nay tong hop nhanh cac thanh phan chinh cua backend: schema, API, role, va luong nghiep vu end-to-end.

## 1) Kien truc tong quan

- Kieu du an: Node.js + Express + Mongoose (MongoDB)
- Pattern chinh: `routes -> controllers -> services -> models`
- Entry routes: `src/routes/index.js`
- OpenAPI: `src/docs/openapi.js` (chua bao phu 100% route, xem route file de doi chieu thuc te)

## 2) Domain va model chinh

### 2.1 Identity / User

`User` (`src/models/user.schema.js`)

- email (unique), password
- role: `customer | sales | operations | manager | admin`
- status: `active | inactive | banned | pending`
- profile (dob, gender, avatar), addresses[]
- email verification fields, reset password fields
- soft delete: `is_deleted`, `deleted_at`

### 2.2 Catalog

`Category` (`src/models/category.schema.js`)

- name, slug(unique), parent_id, is_active

`Brand` (`src/models/brand.schema.js`)

- name(unique), description, logo, is_active

`Model` (`src/models/model.schema.js`)

- name(unique), type(`frame|lens`), description, is_active

`Product` (`src/models/product.schema.js`)

- category(ref Category), brand(ref Brand), model(ref Model)
- name, slug(unique), type(`frame|lens|accessory`)
- material, gender, shape, images[], is_active

`ProductVariant` (`src/models/productVariant.schema.js`)

- product_id(ref Product), sku(unique), price
- stock_quantity, reserved_quantity, is_active
- frame attrs: size, bridge_fit
- lens attrs: diameter, base_curve, power
- virtual `available_quantity = max(0, stock_quantity - reserved_quantity)`

`Combo` (`src/models/combo.schema.js`)

- frame_variant_id(ref ProductVariant), lens_variant_id(ref ProductVariant)
- combo_price, name, slug(unique), is_active

### 2.3 Cart & Order

`Cart` (`src/models/cart.schema.js`)

- user_id(unique, ref User)
- items[]: moi dong cart co `_id` rieng (cart line ID), gom variant_id xor combo_id, quantity, lens_params
- snapshot gia: `price_snapshot`, `combo_price_snapshot`

`Order` (`src/models/order.schema.js`)

- user_id, order_type: `stock | pre_order | prescription`
- status:
  - `pending, confirmed, processing, manufacturing, packed, shipped, delivered, completed, cancelled, return_requested, returned, refunded`
- total_amount, shipping_fee, final_amount
- deposit_rate, deposit_amount, remaining_amount
- payment_phase: `full | deposit | remaining`
- shipping_address, cancel_reason, reject_reason

`OrderItem` (`src/models/orderItem.schema.js`)

- order_id, variant_id, quantity, unit_price
- lens_params (cho prescription)
- combo_id, combo_group_id (neu sinh tu combo)
- item_type: `frame | lens | null`

`PrescriptionOrder` (`src/models/prescriptionOrder.schema.js`)

- order_id + thong so do mat (SPH/CYL/AXIS/ADD/PD...)
- prescription_image, optometrist_name, clinic_name

### 2.4 Payment

`Payment` (`src/models/payment.schema.js`)

- order_id, amount, method(`cod|momo|vnpay`)
- status:
  - `pending, pending-payment, deposit-paid, remaining-due, paid, failed, refunded`
- transaction_id, paid_at

### 2.5 Inventory

`InventoryReceipt` (`src/models/inventoryReceipt.schema.js`)

- variant_id, qty_in, unit_cost, supplier_name, note
- status: `draft | confirmed | cancelled`
- created_by, confirmed_by, confirmed_at

`InventoryLedger` (`src/models/inventoryLedger.schema.js`)

- variant_id, event_type:
  - `receipt_confirmed, manual_adjustment, order_reserve, order_release, order_deduct`
- quantity_delta
- stock_before/after, reserved_before/after
- ref_type(`inventory_receipt|order|cart|manual|null`), ref_id
- created_by

## 3) Role matrix (tom tat)

- `customer`
  - auth, profile/address, cart, checkout/preorder-now, xem/huy don cua minh
- `sales`
  - xac nhan/tu choi don (`/orders/:id/confirm`)
- `operations`
  - cap nhat status van hanh don (`/orders/:id/status`)
- `manager`
  - quan ly catalog, staff, inventory receipt/ledger, statistics manager scope
- `admin`
  - tat ca manager + quan ly manager + statistics admin scope

## 4) API map theo nhom

## 4.1 Auth (`/auth`)

- `POST /register`
- `POST /login`
- `GET /verify-email`
- `POST /resend-verification-email`
- `POST /forgot-password`
- `POST /reset-password`
- `POST /change-password` (auth)

## 4.2 Users (`/users`)

- `GET /me/profile` (auth)
- `PUT /me/profile` (auth, multipart avatar)
- `GET /me/addresses` (auth)
- `POST /me/addresses` (auth)

## 4.3 Management (`/management`)

- Staff (manager/admin):
  - `GET /staff`, `POST /staff`, `PUT /staff/:id`, `DELETE /staff/:id`
- Manager (admin):
  - `GET /managers`, `POST /managers`, `PUT /managers/:id`, `DELETE /managers/:id`

## 4.4 Catalog

- Products:
  - `GET /products`, `GET /products/:slug`, `GET /products/:id/variants`
  - `POST /products`, `PUT /products/:id`, `DELETE /products/:id` (manager/admin)
  - `POST /products/:id/variants` (manager/admin)
  - `PUT/DELETE /products/:productId/variants/:variantId` (manager/admin)
  - `PATCH /products/:id/active` (manager/admin)
- Variants:
  - `GET /variants`
- Combos:
  - `GET /combos`, `GET /combos/:slug`
  - `POST /combos`, `PUT /combos/:id`, `DELETE /combos/:id` (manager/admin)
- Taxonomy:
  - `GET/POST/PUT/DELETE /categories`
  - `GET/POST/PUT/DELETE /brands`
  - `GET/POST/PUT/DELETE /models`

## 4.5 Cart (`/cart`)

- `GET /`
- `POST /items`
- `PUT /items/:cartLineId` (cap nhat theo `_id` cua dong hang trong cart)
- `DELETE /items/:cartLineId` (xoa theo `_id` cua dong hang trong cart)
- `PUT /combo-items/:combo_id`
- `DELETE /combo-items/:combo_id`
- `DELETE /clear`
- Response da duoc chuan hoa ve dang:
  - `{ success: true, items: [...], totalAmount }`

## 4.6 Orders (`/orders`)

- `GET /` (customer list)
- `GET /all` (sales/manager/operations/admin)
- `GET /:id` (owner hoac privileged role)
- `POST /checkout` (customer)
- `POST /preorder-now` (customer)
- `POST /:id/confirm` (sales)
- `PUT /:id/cancel` (customer)
- `PUT /:id/status` (operations)

## 4.7 Payment gateways

- Payment endpoint:
  - `GET /payment/success` (auth)
  - `GET /payment/fail` (auth)
- MoMo:
  - `POST /momo/create`
  - `GET /momo/return`
  - `POST /momo/ipn`
- VNPay:
  - `POST /vnpay/create`
  - `GET /vnpay/verify`

## 4.8 Statistics (`/statistics`)

- `GET /overview` (manager/admin)
- `GET /admin` (admin)
- `GET /timeseries` (manager/admin)
- `GET /top-products` (manager/admin)
- `GET /inventory-alerts` (manager/admin)
- `GET /funnel` (manager/admin)

## 4.9 Inventory (`/inventory`)

- `GET /receipts` (manager/admin)
- `POST /receipts` (manager/admin)
- `PATCH /receipts/:id/confirm` (manager/admin)
- `GET /ledger` (manager/admin)

## 5) Luong nghiep vu end-to-end

### 5.1 Dang ky -> xac thuc -> dang nhap

1. User `POST /auth/register`
2. System tao user + token verify + gui mail
3. User click `GET /auth/verify-email?token=...`
4. User `POST /auth/login` de lay JWT

### 5.2 Cart -> Checkout (stock/preorder/prescription)

1. Customer thao tac gio (`/cart/*`)
2. Customer `POST /orders/checkout`
3. `order.service`:
   - doc cart va selected items
   - detect `order_type`
   - validate ton kho/preorder
   - tao `Order`, `OrderItem`, `Payment`
   - xoa item da checkout khoi `Cart`
4. Neu `payment_method = momo/vnpay` -> tra `payUrl`

### 5.3 Preorder ngay (khong qua cart)

1. Customer `POST /orders/preorder-now`
2. Service validate item preorder, reserve variant
3. Tao `Order`, `OrderItem`, `Payment`
4. Tra `payUrl` neu online payment

### 5.4 Xac nhan va van hanh don

1. Sales `POST /orders/:id/confirm`
2. Operations `PUT /orders/:id/status`
3. Theo status transition, system cap nhat inventory va payment (COD) theo rule trong `order.service`
4. Customer co the `PUT /orders/:id/cancel` neu hop le

### 5.5 Thanh toan online

1. Tao URL thanh toan:
   - MoMo (`/momo/create`) hoac VNPay (`/vnpay/create`)
2. Gateway callback:
   - MoMo: return + ipn
   - VNPay: verify
3. System cap nhat `Payment.status` (va mot phan `Order.payment_phase`)
4. Co cleanup job dinh ky cho cac don online bi tre:
   - `pending-payment` qua han -> danh dau payment `failed` + cancel order
   - Job: `src/jobs/pending-payment-cleanup.job.js`
   - Config qua env:
     - `ENABLE_PENDING_PAYMENT_CLEANUP`
     - `PENDING_PAYMENT_TIMEOUT_MINUTES`
     - `PENDING_PAYMENT_CLEANUP_INTERVAL_MINUTES`

### 5.6 Nhap kho va ledger

1. Manager/Admin tao phieu nhap `POST /inventory/receipts` (draft)
2. Xac nhan phieu `PATCH /inventory/receipts/:id/confirm`
3. Transaction:
   - tang `ProductVariant.stock_quantity`
   - cap nhat receipt sang confirmed
   - ghi `InventoryLedger`
4. Theo doi qua `GET /inventory/receipts` va `GET /inventory/ledger`

### 5.7 Thong ke

1. Manager/Admin goi cac endpoint `/statistics/*`
2. `statistics.service` aggregate truc tiep tu `Order`, `Payment`, `User`, `OrderItem`, `ProductVariant`

## 6) Quan he du lieu (quick map)

- `User (1) - (1) Cart`
- `User (1) - (N) Order`
- `Order (1) - (N) OrderItem`
- `Order (1) - (1) Payment` (thuc te dang dung 1 ban ghi/payment cho order)
- `Order (1) - (N) PrescriptionOrder` (khi la prescription)
- `Product (1) - (N) ProductVariant`
- `Combo` tham chieu 2 `ProductVariant` (frame + lens)
- `InventoryReceipt (N) - (1) ProductVariant`
- `InventoryLedger (N) - (1) ProductVariant`

## 7) File tham chieu nhanh

- Routes: `src/routes/*.js`
- Controllers: `src/controllers/*.js`
- Services:
  - order: `src/services/order.service.js`
  - cart: `src/services/cart.service.js`
  - payment: `src/services/payment.service.js`
  - jobs: `src/jobs/pending-payment-cleanup.job.js`
  - gateways: `src/services/momo.service.js`, `src/services/vnpay.service.js`
  - inventory: `src/services/inventory.service.js`
  - statistics: `src/services/statistics.service.js`
- OpenAPI: `src/docs/openapi.js`

## 8) Luu y hien trang

- Co mot so logic overlap giua `order.service`, `payment.service`, `vnpay.service` trong cap nhat payment status.
- Inventory ledger hien ghi day du cho flow receipt; flow order dang mutate stock/reserved nhieu trong `order.service`.
- Nen coi file nay la "ban do he thong", va OpenAPI la "contract API". Khi thay doi route/schema, cap nhat ca hai.
