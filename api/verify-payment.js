const crypto = require("crypto");
const { getFirebaseAdmin } = require("./_firebase");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { payment, orderId, customer, quantity } = req.body || {};
    if (!payment?.razorpay_order_id || !payment?.razorpay_payment_id || !payment?.razorpay_signature) {
      return res.status(400).json({ error: "Incomplete payment details." });
    }

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${payment.razorpay_order_id}|${payment.razorpay_payment_id}`)
      .digest("hex");

    const isValid = crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(payment.razorpay_signature)
    );

    if (!isValid) return res.status(400).json({ error: "Invalid payment signature." });

    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    const orderRef = db.collection("orders").doc(orderId);
    const orderSnapshot = await orderRef.get();

    if (!orderSnapshot.exists) return res.status(404).json({ error: "Order not found." });

    const order = orderSnapshot.data();
    if (order.status === "paid") {
      return res.status(200).json({ orderId, message: "Order already confirmed." });
    }

    const productRef = db.collection("products").doc("batman-cap");
    const productSnapshot = await productRef.get();
    const stock = productSnapshot.exists ? Number(productSnapshot.data().stock ?? 0) : 0;

    if (stock < Number(quantity)) {
      return res.status(409).json({ error: "Stock changed during payment. Contact support." });
    }

    const batch = db.batch();
    batch.update(orderRef, {
      status: "paid",
      paymentId: payment.razorpay_payment_id,
      paymentSignature: payment.razorpay_signature,
      customer,
      paidAt: admin.firestore.FieldValue.serverTimestamp()
    });
    batch.update(productRef, {
      stock: admin.firestore.FieldValue.increment(-Number(quantity))
    });
    await batch.commit();

    return res.status(200).json({ orderId, message: "Payment verified." });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Payment verification failed." });
  }
};