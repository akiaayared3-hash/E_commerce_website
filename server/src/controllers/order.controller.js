// controllers/order.controller.js
import * as orderService from "../services/order.service.js";

// Forwards async errors to the Express error middleware
const catchAsync = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// ---------- customer ----------

// POST /api/orders
// body: { shipping_address_id }
export const createOrderHandler = catchAsync(async (req, res) => {
  const { shipping_address_id } = req.body;

  // Redirect URLs come from server config, never from the client
  const result = await orderService.createOrderAndStartPayment(
    req.user.id,
    shipping_address_id,
    {
      callback_url: process.env.PAYMENT_CALLBACK_URL,
      return_url: process.env.PAYMENT_RETURN_URL,
    },
  );

  res.status(201).json({ status: "success", data: result });
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
    req.body.status,
  );

  res.status(200).json({ status: "success", data: { order } });
});
