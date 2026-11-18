// Payment methods shown at checkout (Ethiopia)
export const PAYMENT_METHODS = [
  {
    id: "chapa",
    label: "Pay online with Chapa",
    hint: "Telebirr, CBE Birr, bank and cards through Chapa's secure page",
    online: true,
  },
  {
    id: "cod",
    label: "Cash on Delivery",
    hint: "Pay in cash when your order arrives",
    online: false,
  },
];

// Same backend URL used by the customer API client.
export const API_BASE = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3000"
).replace(/\/+$/, "");

// Keep existing checkout behavior unchanged.
export const ORDER_ENDPOINT = "";

export const SHOP = {
  name: "Your Shop Name",
};
