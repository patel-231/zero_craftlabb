import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { getFirestore, collection, query, orderBy, onSnapshot, doc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const loginSection = document.querySelector("#login-section");
const dashboard = document.querySelector("#dashboard");
const loginMessage = document.querySelector("#login-message");

document.querySelector("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  loginMessage.textContent = "";
  try {
    await signInWithEmailAndPassword(
      auth,
      document.querySelector("#login-email").value,
      document.querySelector("#login-password").value
    );
  } catch (error) {
    loginMessage.textContent = error.message;
  }
});

document.querySelector("#logout").addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, (user) => {
  if (!user) {
    loginSection.classList.remove("hidden");
    dashboard.classList.add("hidden");
    return;
  }
  loginSection.classList.add("hidden");
  dashboard.classList.remove("hidden");
  document.querySelector("#admin-email").textContent = user.email;
  loadOrders();
  loadProduct();
});

function loadOrders() {
  const ordersQuery = query(collection(db, "orders"), orderBy("createdAt", "desc"));
  onSnapshot(ordersQuery, (snapshot) => {
    const body = document.querySelector("#orders-body");
    body.innerHTML = "";
    let paid = 0;
    let revenue = 0;

    snapshot.forEach((docSnap) => {
      const order = docSnap.data();
      if (order.status === "paid") {
        paid += 1;
        revenue += (Number(order.amount) || 0) / 100;
      }
      const date = order.createdAt?.toDate?.().toLocaleString() || "—";
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${escapeHTML(order.orderId || docSnap.id)}</td>
        <td>${escapeHTML(order.customer?.name || "—")}<br><small>${escapeHTML(order.customer?.email || "")}</small></td>
        <td>${order.quantity || 0}</td>
        <td>$${((Number(order.amount) || 0) / 100).toFixed(2)}</td>
        <td><span class="status ${order.status}">${escapeHTML(order.status || "—")}</span></td>
        <td>${date}</td>
      `;
      body.appendChild(row);
    });

    document.querySelector("#paid-orders").textContent = paid;
    document.querySelector("#revenue").textContent = `$${revenue.toFixed(2)}`;
  });
}

function loadProduct() {
  onSnapshot(doc(db, "products", "batman-cap"), (snapshot) => {
    document.querySelector("#admin-stock").textContent = snapshot.exists() ? snapshot.data().stock ?? "—" : "—";
  });
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[char]));
}