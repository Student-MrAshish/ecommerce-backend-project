const API_BASE_URL = "http://localhost:8080";
const ADMIN_EMAIL = "admin@shop.com";

const navEl = document.getElementById("mainNav");
const statusEl = document.getElementById("statusArea");
const loadingEl = document.getElementById("loading");
const ordersListEl = document.getElementById("ordersList");

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
    { key: "products", top: "Shop", label: "Products", href: "products.html" },
    { key: "cart", top: "Go to", label: "Cart Page", href: "cart.html", cart: true },
    { key: "orders", top: "Current", label: "Orders", href: "orders.html" },
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

async function apiRequest(path, options = {}) {
  return LocalApi.request(path, options);
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatDate(value) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function getOrderId(order) {
  return order.id ?? order.orderId ?? "N/A";
}

function getOrderItems(order) {
  return order.items || order.orderItems || [];
}

function lineTotal(item) {
  const meters = toNumber(item.meters ?? item.quantityInMeters ?? 0);
  const price = toNumber(item.pricePerMeter ?? item.price ?? item.product?.pricePerMeter ?? 0);
  return meters * price;
}

function orderTotal(order) {
  if (order.totalAmount !== undefined && order.totalAmount !== null) {
    return toNumber(order.totalAmount);
  }
  return getOrderItems(order).reduce((sum, item) => sum + lineTotal(item), 0);
}

function renderOrders(orders) {
  if (!Array.isArray(orders) || orders.length === 0) {
    ordersListEl.innerHTML = `<article class="card"><p class="muted">No orders found.</p></article>`;
    return;
  }

  ordersListEl.innerHTML = orders
    .map((order) => {
      const itemsHtml = getOrderItems(order)
        .map((item) => {
          const name = item.productName ?? item.product?.name ?? `Product #${item.productId ?? "N/A"}`;
          const meters = toNumber(item.meters ?? item.quantityInMeters ?? 0).toFixed(2);
          const price = toNumber(item.pricePerMeter ?? item.price ?? item.product?.pricePerMeter ?? 0).toFixed(2);
          return `<li>${name}: ${meters}m x $${price}</li>`;
        })
        .join("");

      return `
        <article class="card order-card">
          <h3>Order #${getOrderId(order)}</h3>
          <p><strong>Date:</strong> ${formatDate(order.createdAt ?? order.orderDate)}</p>
          <p><strong>Total:</strong> $${orderTotal(order).toFixed(2)}</p>
          <p><strong>Items:</strong></p>
          <ul>${itemsHtml || "<li>No item details returned</li>"}</ul>
        </article>
      `;
    })
    .join("");
}

async function fetchOrders() {
  const { userId } = getSession();
  setLoading(true, "Loading orders...");
  showStatus("");
  try {
    const orders = await apiRequest(`/orders/user/${userId}`);
    renderOrders(orders);
  } catch (error) {
    showStatus(error.message, "error");
    renderOrders([]);
  } finally {
    setLoading(false);
  }
}

if (requireUserPageAccess()) {
  renderNav();
  attachSearch();
  fetchOrders();
}
