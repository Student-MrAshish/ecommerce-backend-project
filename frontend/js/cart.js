const API_BASE_URL = "http://localhost:8080";
const ADMIN_EMAIL = "admin@shop.com";

const navEl = document.getElementById("mainNav");
const statusEl = document.getElementById("statusArea");
const loadingEl = document.getElementById("loading");
const cartItemsEl = document.getElementById("cartItems");
const cartTotalEl = document.getElementById("cartTotal");
const placeOrderBtn = document.getElementById("placeOrderBtn");

function getSession() {
  return {
    userEmail: localStorage.getItem("userEmail"),
    userId: localStorage.getItem("userId")
  };
}

function requireUserPageAccess() {
  const { userEmail, userId } = getSession();
  if (!userEmail || !userId) {
    window.location.href = "index.html";
    return false;
  }
  if (userEmail === ADMIN_EMAIL) {
    window.location.href = "admin.html";
    return false;
  }
  return true;
}

function renderNav() {
  const { userEmail } = getSession();
  if (!navEl || !userEmail) return;

  const links = [
    { key: "home", top: "Go to", label: "Home", href: "products.html" },
    { key: "products", top: "Current", label: "Products", href: "products.html" },
    { key: "cart", top: "Go to", label: "Cart Page", href: "cart.html", cart: true },
    { key: "orders", top: "Track", label: "Orders", href: "orders.html" },
    { key: "logout", top: "Secure", label: "Logout", href: "#" }
  ];

  navEl.innerHTML = links
    .map((link) => {
      const active = document.body.dataset.page === link.key ? "active" : "";
      const cartClass = link.cart ? "cart-link" : "";
      return `
        <a class="nav-link ${active} ${cartClass}" data-page="${link.key}" href="${link.href}">
          <span class="nav-link-top">${link.top || ""}</span>
          <span class="nav-link-bottom">${link.label}</span>
        </a>
      `;
    })
    .join("");

  navEl.querySelector('[data-page="logout"]')?.addEventListener("click", (event) => {
    event.preventDefault();
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userId");
    window.location.href = "index.html";
  });
}

function attachSearch() {
  const searchForm = document.getElementById("navSearchForm");
  const searchInput = document.getElementById("navSearchInput");
  if (!searchForm || !searchInput) return;

  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const q = searchInput.value.trim();
    window.location.href = q ? `products.html?q=${encodeURIComponent(q)}` : "products.html";
  });
}

function showStatus(message, type = "info") {
  if (!statusEl) return;
  statusEl.className = `feedback ${type}`;
  statusEl.textContent = message;
}

function setLoading(isLoading, text = "Loading...") {
  if (!loadingEl) return;
  loadingEl.textContent = text;
  loadingEl.classList.toggle("hidden", !isLoading);
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function apiRequest(path, options = {}) {
  return LocalApi.request(path, options);
}

function lineTotal(item) {
  const meters = toNumber(item.meters ?? item.quantityInMeters ?? 0);
  const price = toNumber(item.pricePerMeter ?? item.product?.pricePerMeter ?? item.price ?? 0);
  return meters * price;
}

function getCartItemId(item) {
  return item.id ?? item.itemId ?? item.cartItemId;
}

function getProductName(item) {
  return item.productName ?? item.product?.name ?? `Product #${item.productId ?? "N/A"}`;
}

function getPrice(item) {
  return toNumber(item.pricePerMeter ?? item.product?.pricePerMeter ?? item.price ?? 0);
}

function getMeters(item) {
  return toNumber(item.meters ?? item.quantityInMeters ?? 0);
}

function renderCart(items) {
  if (!Array.isArray(items) || items.length === 0) {
    cartItemsEl.innerHTML = `<div class="card"><p class="muted">Your cart is empty.</p></div>`;
    cartTotalEl.textContent = "$0.00";
    return;
  }

  const rows = items
    .map((item) => {
      const itemId = getCartItemId(item);
      const meters = getMeters(item);
      const price = getPrice(item);
      const total = lineTotal(item);
      return `
        <tr>
          <td>${itemId ?? "-"}</td>
          <td>${getProductName(item)}</td>
          <td>${meters.toFixed(2)}</td>
          <td>$${price.toFixed(2)}</td>
          <td>$${total.toFixed(2)}</td>
          <td><button class="btn btn-danger remove-item-btn" data-item-id="${itemId}">Remove</button></td>
        </tr>
      `;
    })
    .join("");

  const total = items.reduce((sum, item) => sum + lineTotal(item), 0);

  cartItemsEl.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Item ID</th>
          <th>Product</th>
          <th>Meters</th>
          <th>Price/Meter</th>
          <th>Total</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  cartTotalEl.textContent = `$${total.toFixed(2)}`;

  cartItemsEl.querySelectorAll(".remove-item-btn").forEach((button) => {
    button.addEventListener("click", async (event) => {
      const itemId = event.currentTarget.dataset.itemId;
      await removeCartItem(itemId);
    });
  });
}

async function fetchCart() {
  const { userId } = getSession();
  setLoading(true, "Loading cart...");
  showStatus("");
  try {
    const items = await apiRequest(`/cart/${userId}`);
    renderCart(items);
  } catch (error) {
    showStatus(error.message, "error");
    renderCart([]);
  } finally {
    setLoading(false);
  }
}

async function removeCartItem(itemId) {
  if (!itemId || itemId === "undefined") {
    showStatus("Invalid cart item ID.", "error");
    return;
  }
  try {
    await apiRequest(`/cart/item/${itemId}`, { method: "DELETE" });
    showStatus("Item removed from cart.", "success");
    await fetchCart();
  } catch (error) {
    showStatus(error.message, "error");
  }
}

async function placeOrder() {
  const { userId } = getSession();
  placeOrderBtn?.setAttribute("disabled", "true");
  showStatus("Placing order...", "info");
  try {
    await apiRequest("/orders/place", {
      method: "POST",
      body: JSON.stringify({ userId: toNumber(userId) })
    });
    showStatus("Order placed successfully.", "success");
    await fetchCart();
    setTimeout(() => {
      window.location.href = "orders.html";
    }, 700);
  } catch (error) {
    showStatus(error.message, "error");
  } finally {
    placeOrderBtn?.removeAttribute("disabled");
  }
}

if (requireUserPageAccess()) {
  renderNav();
  attachSearch();
  placeOrderBtn?.addEventListener("click", placeOrder);
  fetchCart();
}
