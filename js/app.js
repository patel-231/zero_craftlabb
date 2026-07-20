import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { OBJLoader } from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/OBJLoader.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

const PRODUCT_PRICE = 50;
const firebaseApp = initializeApp(firebaseConfig);
const db = getDatabase(firebaseApp);

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

let quantity = 1;
let stock = 50;

function updateQuantity(next) {
  quantity = Math.max(1, Math.min(10, next));
  $("#quantity").textContent = quantity;
  $("#summary-quantity").textContent = quantity;
  $("#summary-total").textContent = `$${PRODUCT_PRICE * quantity}`;
}

$("#minus-qty").addEventListener("click", () => updateQuantity(quantity - 1));
$("#plus-qty").addEventListener("click", () => updateQuantity(quantity + 1));

$$(".thumbnail").forEach((thumb) => {
  thumb.addEventListener("click", () => {
    $("#main-product-image").style.opacity = "0";
    setTimeout(() => {
      $("#main-product-image").src = thumb.dataset.image;
      $("#image-number").textContent = thumb.dataset.number;
      $("#main-product-image").style.opacity = "1";
    }, 180);
    $$(".thumbnail").forEach((item) => item.classList.remove("active"));
    thumb.classList.add("active");
  });
});

const modal = $("#checkout-modal");
function openCheckout() {
  if (stock <= 0) {
    alert("This drop is sold out.");
    return;
  }
  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}
function closeCheckout() {
  modal.classList.add("hidden");
  document.body.style.overflow = "";
}
$("#open-checkout").addEventListener("click", openCheckout);
$("#open-checkout-2").addEventListener("click", openCheckout);
$$("[data-close-modal]").forEach((el) => el.addEventListener("click", closeCheckout));

function setupCursor() {
  const glow = $(".cursor-glow");
  window.addEventListener("pointermove", (event) => {
    glow.style.left = `${event.clientX}px`;
    glow.style.top = `${event.clientY}px`;
  });
}
setupCursor();

function setup3D(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, container.clientWidth / container.clientHeight, 0.1, 1000);
  camera.position.set(0, 0.2, 5);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x222222, 2.5));
  const keyLight = new THREE.DirectionalLight(0xffffff, 4);
  keyLight.position.set(4, 5, 5);
  scene.add(keyLight);
  const rimLight = new THREE.DirectionalLight(0x777777, 2);
  rimLight.position.set(-4, 2, -4);
  scene.add(rimLight);

  const objectGroup = new THREE.Group();
  scene.add(objectGroup);

  const loader = new OBJLoader();
  loader.load(
    "assets/3d/cap.obj",
    (object) => {
      object.traverse((child) => {
        if (child.isMesh) {
          child.material = new THREE.MeshStandardMaterial({
            color: 0x151515,
            roughness: 0.38,
            metalness: 0.12
          });
        }
      });
      const box = new THREE.Box3().setFromObject(object);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const maxSize = Math.max(size.x, size.y, size.z);
      const scale = 3.2 / maxSize;
      object.scale.setScalar(scale);
      object.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
      objectGroup.add(object);
    },
    undefined,
    (error) => {
      console.error("OBJ model could not be loaded:", error);
      container.innerHTML = `<div class="model-error">ADD YOUR MODEL AT<br><strong>assets/3d/cap.obj</strong></div>`;
    }
  );

  let isDragging = false;
  let previousX = 0;
  let rotationY = 0;
  let targetRotation = 0;

  container.addEventListener("pointerdown", (event) => {
    isDragging = true;
    previousX = event.clientX;
    container.setPointerCapture(event.pointerId);
  });
  container.addEventListener("pointermove", (event) => {
    if (!isDragging) return;
    targetRotation += (event.clientX - previousX) * 0.01;
    previousX = event.clientX;
  });
  container.addEventListener("pointerup", () => { isDragging = false; });
  container.addEventListener("pointercancel", () => { isDragging = false; });

  function animate() {
    requestAnimationFrame(animate);
    if (!isDragging) targetRotation += 0.0025;
    rotationY += (targetRotation - rotationY) * 0.08;
    objectGroup.rotation.y = rotationY;
    renderer.render(scene, camera);
  }
  animate();

  const resize = () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  };
  window.addEventListener("resize", resize);
}

setup3D("hero-model");
setup3D("product-model");

async function loadStock() {
  try {
    const productRef = ref(db, "products/batman-cap");

    onValue(productRef, (snapshot) => {
      if (!snapshot.exists()) return;

      stock = Number(snapshot.val().stock ?? 50);

      $("#stock-count").textContent = stock;
      $("#stock-label").textContent =
        stock <= 0 ? "SOLD OUT" : `${stock} LEFT`;

      $("#stock-bar-fill").style.width =
        `${Math.max(0, Math.min(100, (stock / 50) * 100))}%`;

      $("#open-checkout").disabled = stock <= 0;
      $("#open-checkout-2").disabled = stock <= 0;
    });
  } catch (error) {
    console.warn("Stock listener unavailable. Using default stock.", error);
  }
}


$("#checkout-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const payButton = $("#pay-button");
  const message = $("#checkout-message");
  const formData = new FormData(form);
  const customer = Object.fromEntries(formData.entries());

  payButton.disabled = true;
  payButton.innerHTML = "CREATING SECURE CHECKOUT...";
  message.textContent = "";

  try {
    const response = await fetch("/api/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity, customer })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not create order.");

    const options = {
      key: data.keyId,
      amount: data.amount,
      currency: data.currency,
      name: "ZERO_CRAFTLABB",
      description: "THE BATMAN CAP / DROP 001",
      order_id: data.orderId,
      prefill: {
        name: customer.name,
        email: customer.email,
        contact: customer.phone
      },
      theme: { color: "#080808" },
      handler: async (payment) => {
        payButton.innerHTML = "VERIFYING PAYMENT...";
        const verifyResponse = await fetch("/api/verify-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            payment,
            orderId: data.orderId,
            customer,
            quantity
          })
        });
        const verifyData = await verifyResponse.json();
        if (!verifyResponse.ok) throw new Error(verifyData.error || "Payment verification failed.");

        message.classList.add("success");
        message.textContent = `Payment successful. Your order ID is ${verifyData.orderId}.`;
        form.reset();
        payButton.innerHTML = "ORDER CONFIRMED ✓";
      }
    };

    const razorpay = new Razorpay(options);
    razorpay.on("payment.failed", (failure) => {
      message.textContent = failure.error?.description || "Payment failed. Please try again.";
      payButton.disabled = false;
      payButton.innerHTML = "CONTINUE TO PAYMENT ↗";
    });
    razorpay.open();
  } catch (error) {
    message.textContent = error.message;
    payButton.disabled = false;
    payButton.innerHTML = "CONTINUE TO PAYMENT ↗";
  }
});

const razorpayScript = document.createElement("script");
razorpayScript.src = "https://checkout.razorpay.com/v1/checkout.js";
document.head.appendChild(razorpayScript);
