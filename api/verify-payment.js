const crypto = require("crypto");
const { getFirebaseAdmin } = require("./_firebase");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const {
      payment,
      orderId,
      customer,
      quantity
    } = req.body || {};

    if (
      !payment?.razorpay_order_id ||
      !payment?.razorpay_payment_id ||
      !payment?.razorpay_signature
    ) {
      return res.status(400).json({
        error: "Incomplete payment details."
      });
    }

    const expectedSignature = crypto
      .createHmac(
        "sha256",
        process.env.RAZORPAY_KEY_SECRET
      )
      .update(
        `${payment.razorpay_order_id}|${payment.razorpay_payment_id}`
      )
      .digest("hex");

    const isValid = crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(payment.razorpay_signature)
    );

    if (!isValid) {
      return res.status(400).json({
        error: "Invalid payment signature."
      });
    }

    const admin = getFirebaseAdmin();
    const db = admin.database();

    const orderRef = db.ref(`orders/${orderId}`);
    const orderSnapshot = await orderRef.once("value");

    if (!orderSnapshot.exists()) {
      return res.status(404).json({
        error: "Order not found."
      });
    }

    const order = orderSnapshot.val();

    if (order.status === "paid") {
      return res.status(200).json({
        orderId,
        message: "Order already confirmed."
      });
    }

    if (order.status === "processing") {
      return res.status(409).json({
        error: "Payment is already being processed."
      });
    }

    const processingResult = await orderRef.transaction((currentOrder) => {
      if (!currentOrder) return;

      if (currentOrder.status !== "payment_pending") {
        return;
      }

      return {
        ...currentOrder,
        status: "processing"
      };
    });

    if (!processingResult.committed) {
      return res.status(409).json({
        error: "Payment is already being processed."
      });
    }

    const productRef = db.ref("products/batman-cap/stock");

    const stockResult = await productRef.transaction((currentStock) => {
      const stock = Number(currentStock ?? 0);
      const qty = Number(quantity);

      if (stock < qty) {
        return;
      }

      return stock - qty;
    });

    if (!stockResult.committed) {
      await orderRef.update({
        status: "payment_pending"
      });

      return res.status(409).json({
        error: "Stock changed during payment. Contact support."
      });
    }

    await orderRef.update({
      status: "paid",
      paymentId: payment.razorpay_payment_id,
      paymentSignature: payment.razorpay_signature,
      customer,
      paidAt: Date.now()
    });

    return res.status(200).json({
      orderId,
      message: "Payment verified."
    });

  } catch (error) {
    console.error("VERIFY PAYMENT ERROR:", error);

    return res.status(500).json({
      error: "Payment verification failed."
    });
  }
};
