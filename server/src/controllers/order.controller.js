// controllers/order.controller.js
import * as orderService from "../services/order.service.js";

// Forwards async errors to the Express error middleware
const catchAsync = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// ---------- customer ----------

// POST /api/orders
//
// A) saved address:  { shipping_address_id, payment_method? }
// B) new address:    { full_name, phone | phone_number, address | street,
//                      region | delivery_zone, city?, sub_city?, woreda?,
//                      note | landmark?, payment_method? }
//
// payment_method: "cod" (default) | "chapa" ("online" is accepted too)
//
// Response: 201 { status, data: { order } }                       (cod)
//           201 { status, data: { order, payment: { tx_ref, checkout_url } } }
export const createOrderHandler = catchAsync(async (req, res) => {
  const body = req.body ?? {};

  const { order, payment } = await orderService.placeOrder(req.user.id, {
    shippingAddressId: body.shipping_address_id || null,
    address: {
      full_name: body.full_name,
      phone: body.phone_number ?? body.phone,
      street: body.address ?? body.street,
      region: body.region ?? body.delivery_zone,
      city: body.city,
      sub_city: body.sub_city,
      woreda: body.woreda,
      landmark: body.note ?? body.landmark,
    },
    paymentMethod: body.payment_method,
    callback_url: process.env.PAYMENT_CALLBACK_URL,
    return_url: process.env.PAYMENT_RETURN_URL,
  });

  res.status(201).json({
    status: "success",
    data: payment ? { order, payment } : { order },
  });
});

// GET /api/orders?page=1&limit=10
export const getMyOrdersHandler = catchAsync(async (req, res) => {
  const { page, limit } = req.query;
  const result = await orderService.getMyOrders(req.user.id, { page, limit });

  res.status(200).json({ status: "success", data: result });
});

// GET /api/orders/:orderId
export const getMyOrderHandler = catchAsync(async (req, res) => {
  const order = await orderService.getMyOrderById(
    req.user.id,
    req.params.orderId,
  );

  res.status(200).json({ status: "success", data: { order } });
});

// PATCH /api/orders/:orderId/cancel
export const cancelMyOrderHandler = catchAsync(async (req, res) => {
  const order = await orderService.cancelMyOrder(
    req.user.id,
    req.params.orderId,
  );

  res.status(200).json({ status: "success", data: { order } });
});

// ---------- admin ----------

// GET /api/orders/admin/all?status=paid&page=1&limit=10
export const getAllOrdersHandler = catchAsync(async (req, res) => {
  const { status, page, limit } = req.query;
  const result = await orderService.getAllOrders({ status, page, limit });

  res.status(200).json({ status: "success", data: result });
});

// GET /api/orders/admin/:orderId
export const getOrderAdminHandler = catchAsync(async (req, res) => {
  const order = await orderService.getOrderByIdAdmin(req.params.orderId);

  res.status(200).json({ status: "success", data: { order } });
});

// PATCH /api/orders/admin/:orderId/status
// body: { status }
export const updateOrderStatusHandler = catchAsync(async (req, res) => {
  const order = await orderService.updateOrderStatus(
    req.params.orderId,
    req.body?.status,
  );

  res.status(200).json({ status: "success", data: { order } });
});
