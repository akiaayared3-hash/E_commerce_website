// Minimal Express server for Chapa. Run separately from your React app.
// npm i express cors dotenv
// .env:  CHAPA_SECRET_KEY=CHASECK_TEST-xxxx   SITE_URL=http://localhost:5173
import express from "express";
import cors from "cors";
import "dotenv/config";

const app = express();
app.use(cors({ origin: process.env.SITE_URL }));
app.use(express.json());

const CHAPA = "https://api.chapa.co/v1";
const auth = { Authorization: `Bearer ${process.env.CHAPA_SECRET_KEY}` };

// 1) Start a payment
app.post("/api/chapa/initialize", async (req, res) => {
  const { orderId, amount, name, phone } = req.body;
  // IMPORTANT: in production, look the order up in your database and use ITS total,
  // not the amount sent from the browser.
  const [first_name, ...rest] = String(name).split(" ");
  const tx_ref = `order-${orderId}-${Date.now()}`;

  const r = await fetch(`${CHAPA}/transaction/initialize`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: String(amount),
      currency: "ETB",
      first_name,
      last_name: rest.join(" ") || first_name,
      phone_number: phone,
      tx_ref,
      callback_url: `${process.env.API_URL || "http://localhost:3000"}/api/chapa/callback`,
      return_url: `${process.env.SITE_URL}/order-success/${orderId}?tx_ref=${tx_ref}`,
      "customization[title]": "Order payment",
    }),
  });
  const data = await r.json();
  if (data.status !== "success") {
    console.error("Chapa refused the request:", JSON.stringify(data));
    return res.status(400).json(data);
  }
  // save tx_ref on the order here
  res.json({ checkout_url: data.data.checkout_url, tx_ref });
});

// 2) Chapa calls this when payment finishes: verify, then mark the order paid
app.get("/api/chapa/callback", async (req, res) => {
  const { tx_ref } = req.query;
  const r = await fetch(`${CHAPA}/transaction/verify/${tx_ref}`, {
    headers: auth,
  });
  const data = await r.json();
  if (data.status === "success" && data.data?.status === "success") {
    // mark the order with this tx_ref as "pending" (paid) in your database
  }
  res.sendStatus(200);
});

// 3) Your success page can call this to confirm before clearing the cart
app.get("/api/chapa/verify/:tx_ref", async (req, res) => {
  const r = await fetch(`${CHAPA}/transaction/verify/${req.params.tx_ref}`, {
    headers: auth,
  });
  const data = await r.json();
  res.json({ paid: data.data?.status === "success" });
});

app.listen(3000, () => console.log("Server on :3000"));
