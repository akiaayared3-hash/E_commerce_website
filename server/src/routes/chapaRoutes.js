// routes/chapaRoutes.js  (mounted at /api/chapa)
import { Router } from "express";

const router = Router();
const CHAPA = "https://api.chapa.co/v1";

// read the key when a request comes in, so .env is already loaded
const auth = () => ({
  Authorization: `Bearer ${process.env.CHAPA_SECRET_KEY}`,
});

// 1) Start a payment
router.post("/initialize", async (req, res) => {
  try {
    const { orderId, amount, name, phone } = req.body;
    // IMPORTANT: in production, look the order up in your database and use ITS total,
    // not the amount sent from the browser.
    const [first_name, ...rest] = String(name).split(" ");
    const tx_ref = `order-${orderId}-${Date.now()}`;

    // where the customer returns after paying (your React site)
    const siteUrl = (process.env.SITE_URL || "http://localhost:5173").replace(
      /\/+$/,
      "",
    );
    if (!process.env.SITE_URL) {
      console.warn("SITE_URL is not set in .env, using http://localhost:5173");
    }
    if (!process.env.CHAPA_SECRET_KEY) {
      console.error("CHAPA_SECRET_KEY is missing in .env");
      return res
        .status(500)
        .json({ message: "CHAPA_SECRET_KEY is missing on the server" });
    }

    const r = await fetch(`${CHAPA}/transaction/initialize`, {
      method: "POST",
      headers: { ...auth(), "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: String(amount),
        currency: "ETB",
        first_name,
        last_name: rest.join(" ") || first_name,
        phone_number: phone,
        tx_ref,
        callback_url: `${process.env.API_URL || "http://localhost:3000"}/api/chapa/callback`,
        return_url: `${siteUrl}/order-success/${orderId}?tx_ref=${tx_ref}`,
        "customization[title]": "Order payment",
      }),
    });
    const data = await r.json();
    if (data.status !== "success") {
      console.error("Chapa refused the request:", JSON.stringify(data));
      return res.status(400).json(data);
    }
    // save tx_ref on the order in your database here
    res.json({ checkout_url: data.data.checkout_url, tx_ref });
  } catch (err) {
    console.error("Chapa initialize error:", err);
    res.status(500).json({ message: "Could not reach Chapa" });
  }
});

// 2) Chapa calls this when payment finishes: verify, then mark the order paid
router.get("/callback", async (req, res) => {
  try {
    const { tx_ref } = req.query;
    const r = await fetch(`${CHAPA}/transaction/verify/${tx_ref}`, {
      headers: auth(),
    });
    const data = await r.json();
    if (data.status === "success" && data.data?.status === "success") {
      // mark the order with this tx_ref as paid in your database here
    }
  } catch (err) {
    console.error("Chapa callback error:", err);
  }
  res.sendStatus(200);
});

// 3) The order-success page calls this to confirm before clearing the cart
router.get("/verify/:tx_ref", async (req, res) => {
  try {
    const r = await fetch(`${CHAPA}/transaction/verify/${req.params.tx_ref}`, {
      headers: auth(),
    });
    const data = await r.json();
    res.json({ paid: data.data?.status === "success" });
  } catch (err) {
    console.error("Chapa verify error:", err);
    res.status(500).json({ paid: false });
  }
});

export default router;
