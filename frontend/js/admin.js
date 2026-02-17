const API_BASE_URL = "http://localhost:8080";
const ADMIN_EMAIL = "admin@shop.com";

const navEl = document.getElementById("mainNav");
const tabButtons = document.querySelectorAll(".admin-tab");
const tabSections = {
  products: document.getElementById("productsTab"),
  users: document.getElementById("usersTab"),
  orders: document.getElementById("ordersTab"),
  lowStock: document.getElementById("lowStockTab")
};

const statusEl = document.getElementById("statusArea");
const loadingEl = document.getElementById("loading");
const logoutBtn = document.getElementById("logoutBtn");

const addProductForm = document.getElementById("addProductForm");
const updatePriceForm = document.getElementById("updatePriceForm");
const updateStockForm = document.getElementById("updateStockForm");
const deleteProductForm = document.getElementById("deleteProductForm");

const adminProductsTableEl = document.getElementById("adminProductsTable");
const usersTableEl = document.getElementById("usersTable");
const ordersTableEl = document.getElementById("ordersTable");
const lowStockTableEl = document.getElementById("lowStockTable");

function getSession() {
  return {
    userEmail: localStorage.getItem("userEmail"),
    userId: localStorage.getItem("userId")
  };
}

function requireAdminAccess() {
  const { userEmail, userId } = getSession();
  if (!userEmail || !userId) {
    window.location.href = "index.html";
    return false;
  }
  if (userEmail !== ADMIN_EMAIL) {
    window.location.href = "products.html";
    return false;
  }
  return true;
}

function renderNav() {
  if (!navEl) return;
  const links = [
    { key: "home", top: "Go to", label: "Home", href: "products.html" },
    { key: "products", top: "Shop", label: "Products", href: "products.html" },
    { key: "cart", top: "Go to", label: "Cart Page", href: "cart.html", cart: true },
    { key: "orders", top: "Track", label: "Orders", href: "orders.html" },
    { key: "admin", top: "Current", label: "Admin Panel", href: "admin.html" },
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
  statusEl.className = `feedback ${type}`;
  statusEl.textContent = message;
}

function setLoading(isLoading, text = "Loading...") {
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

function setActiveTab(tabKey) {
  tabButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tabKey);
  });

  Object.entries(tabSections).forEach(([key, section]) => {
    section.classList.toggle("hidden", key !== tabKey);
  });
}

function formatDate(value) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function renderTable(container, columns, rows) {
  if (!rows || rows.length === 0) {
    container.innerHTML = `<div class="card"><p class="muted">No records found.</p></div>`;
    return;
  }

  const headerHtml = columns.map((column) => `<th>${column.label}</th>`).join("");
  const rowHtml = rows
    .map((row) => {
      const cells = columns.map((column) => `<td>${column.render(row)}</td>`).join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  container.innerHTML = `
    <table>
      <thead><tr>${headerHtml}</tr></thead>
      <tbody>${rowHtml}</tbody>
    </table>
  `;
}

async function loadProducts() {
  const products = await apiRequest("/products");
  renderTable(
    adminProductsTableEl,
    [
      { label: "ID", render: (p) => p.id ?? p.productId ?? "-" },
      { label: "Name", render: (p) => p.name || "-" },
      { label: "Category", render: (p) => p.category || "-" },
      { label: "Price/Meter", render: (p) => `$${toNumber(p.pricePerMeter ?? p.price ?? 0).toFixed(2)}` },
      { label: "Stock (m)", render: (p) => toNumber(p.quantityInMeters ?? p.stock ?? 0).toFixed(2) }
    ],
    products
  );
}

async function loadUsers() {
  const users = await apiRequest(`/admin/users?email=${encodeURIComponent(ADMIN_EMAIL)}`);
  renderTable(
    usersTableEl,
    [
      { label: "ID", render: (u) => u.id ?? u.userId ?? "-" },
      { label: "Name", render: (u) => u.name || "-" },
      { label: "Email", render: (u) => u.email || "-" },
      { label: "Address", render: (u) => u.address || "-" }
    ],
    users
  );
}

async function loadOrders() {
  const orders = await apiRequest(`/admin/orders?email=${encodeURIComponent(ADMIN_EMAIL)}`);
  renderTable(
    ordersTableEl,
    [
      { label: "Order ID", render: (o) => o.id ?? o.orderId ?? "-" },
      { label: "User ID", render: (o) => o.userId ?? o.user?.id ?? "-" },
      { label: "Date", render: (o) => formatDate(o.createdAt ?? o.orderDate) },
      { label: "Total", render: (o) => `$${toNumber(o.totalAmount ?? 0).toFixed(2)}` }
    ],
    orders
  );
}

async function loadLowStock() {
  const products = await apiRequest(`/admin/products/low-stock?email=${encodeURIComponent(ADMIN_EMAIL)}`);
  renderTable(
    lowStockTableEl,
    [
      { label: "ID", render: (p) => p.id ?? p.productId ?? "-" },
      { label: "Name", render: (p) => p.name || "-" },
      { label: "Category", render: (p) => p.category || "-" },
      {
        label: "Stock",
        render: (p) => {
          const stock = toNumber(p.quantityInMeters ?? p.stock ?? 0).toFixed(2);
          return `<span class="pill warning">${stock}m</span>`;
        }
      }
    ],
    products
  );
}

async function refreshAdminData() {
  setLoading(true, "Refreshing admin data...");
  showStatus("");
  try {
    await Promise.all([loadProducts(), loadUsers(), loadOrders(), loadLowStock()]);
  } catch (error) {
    showStatus(error.message, "error");
  } finally {
    setLoading(false);
  }
}

async function handleAddProduct(event) {
  event.preventDefault();
  const formData = new FormData(addProductForm);

  const payload = {
    name: String(formData.get("name") || "").trim(),
    category: String(formData.get("category") || "").trim(),
    description: String(formData.get("description") || "").trim(),
    pricePerMeter: toNumber(formData.get("pricePerMeter")),
    quantityInMeters: toNumber(formData.get("quantityInMeters"))
  };

  try {
    showStatus("Adding product...", "info");
    await apiRequest(`/products?email=${encodeURIComponent(ADMIN_EMAIL)}`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    showStatus("Product added successfully.", "success");
    addProductForm.reset();
    await Promise.all([loadProducts(), loadLowStock()]);
  } catch (error) {
    showStatus(error.message, "error");
  }
}

async function handleUpdatePrice(event) {
  event.preventDefault();
  const formData = new FormData(updatePriceForm);
  const id = toNumber(formData.get("id"), -1);
  const pricePerMeter = toNumber(formData.get("pricePerMeter"), -1);

  if (id <= 0 || pricePerMeter < 0) {
    showStatus("Invalid product ID or price.", "error");
    return;
  }

  try {
    showStatus("Updating price...", "info");
    await apiRequest(`/products/${id}?email=${encodeURIComponent(ADMIN_EMAIL)}`, {
      method: "PUT",
      body: JSON.stringify({ pricePerMeter })
    });
    showStatus("Product price updated.", "success");
    updatePriceForm.reset();
    await loadProducts();
  } catch (error) {
    showStatus(error.message, "error");
  }
}

async function handleUpdateStock(event) {
  event.preventDefault();
  const formData = new FormData(updateStockForm);
  const id = toNumber(formData.get("id"), -1);
  const quantityInMeters = toNumber(formData.get("quantityInMeters"), -1);

  if (id <= 0 || quantityInMeters < 0) {
    showStatus("Invalid product ID or stock quantity.", "error");
    return;
  }

  try {
    showStatus("Updating stock...", "info");
    await apiRequest(`/admin/products/${id}/stock?email=${encodeURIComponent(ADMIN_EMAIL)}`, {
      method: "PUT",
      body: JSON.stringify({ quantityInMeters })
    });
    showStatus("Stock updated successfully.", "success");
    updateStockForm.reset();
    await Promise.all([loadProducts(), loadLowStock()]);
  } catch (error) {
    showStatus(error.message, "error");
  }
}

async function handleDeleteProduct(event) {
  event.preventDefault();
  const formData = new FormData(deleteProductForm);
  const id = toNumber(formData.get("id"), -1);

  if (id <= 0) {
    showStatus("Invalid product ID.", "error");
    return;
  }

  try {
    showStatus("Deleting product...", "info");
    await apiRequest(`/products/${id}?email=${encodeURIComponent(ADMIN_EMAIL)}`, {
      method: "DELETE"
    });
    showStatus("Product deleted successfully.", "success");
    deleteProductForm.reset();
    await Promise.all([loadProducts(), loadLowStock()]);
  } catch (error) {
    showStatus(error.message, "error");
  }
}

function registerEventHandlers() {
  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setActiveTab(button.dataset.tab);
    });
  });

  addProductForm?.addEventListener("submit", handleAddProduct);
  updatePriceForm?.addEventListener("submit", handleUpdatePrice);
  updateStockForm?.addEventListener("submit", handleUpdateStock);
  deleteProductForm?.addEventListener("submit", handleDeleteProduct);

  logoutBtn?.addEventListener("click", () => {
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userId");
    window.location.href = "index.html";
  });
}

if (requireAdminAccess()) {
  renderNav();
  attachSearch();
  registerEventHandlers();
  setActiveTab("products");
  refreshAdminData();
}
