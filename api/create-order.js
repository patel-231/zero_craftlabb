const Razorpay = require("razorpay");
const crypto = require("crypto");
const { getFirebaseAdmin } = require("./_firebase");

const PRODUCT_PRICE_CENTS = 5000;
const MAX_QUANTITY = 10;

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { quantity, customer } = req.body || {};
    const qty = Number(quantity);

    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QUANTITY) {
      return res.status(400).json({ error: "Invalid quantity." });
    }

    if (!customer?.name || !customer?.email || !customer?.phone || !customer?.address) {
      return res.status(400).json({ error: "Complete customer details are required." });
    }

    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    const productRef = db.collection("products").doc("batman-cap");
    const productSnapshot = await productRef.get();
    const stock = productSnapshot.exists ? Number(productSnapshot.data().stock ?? 0) : 0;

    if (stock < qty) {
      return res.status(400).json({ error: `Only ${stock} cap(s) are available.` });
    }

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });

    const receipt = `zc_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
    const order = await razorpay.orders.create({
      amount: PRODUCT_PRICE_CENTS * qty,
      currency: "USD",
      receipt,
      notes: { product: "batman-cap", quantity: String(qty) }
    });

    await db.collection("orders").doc(order.id).set({
      orderId: order.id,
      product: "batman-cap",
      quantity: qty,
      amount: PRODUCT_PRICE_CENTS * qty,
      currency: "USD",
      customer,
      status: "payment_pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return res.status(200).json({
      keyId: process.env.RAZORPAY_KEY_ID,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not create payment order." });
  }
};