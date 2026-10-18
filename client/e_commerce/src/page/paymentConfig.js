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

// Base URL of YOUR server (the one that holds the Chapa secret key)
export const API_BASE =
  import.meta.env?.VITE_API_URL || "http://localhost:3000";

// ---- Keep your ORIGINAL values for these two (they were in your old file) ----
// Where new orders are sent. Leave "" to only save them in the browser.
export const ORDER_ENDPOINT = "";

// Shop details used in order messages / success page
export const SHOP = {
  name: "Your Shop Name",
  // add the other fields you had before (whatsapp number, phone, etc.)
};
