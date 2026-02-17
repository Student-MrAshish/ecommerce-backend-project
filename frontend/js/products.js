const API_BASE_URL = "http://localhost:8080";
const ADMIN_EMAIL = "admin@shop.com";

const navEl = document.getElementById("mainNav");
const statusEl = document.getElementById("statusArea");
const loadingEl = document.getElementById("loading");
const productsGridEl = document.getElementById("productsGrid");
const categoryFilterEl = document.getElementById("categoryFilter");

let allProducts = [];

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

  if (userEmail === ADMIN_EMAIL) {
    links.push({ key: "admin", top: "Store", label: "Admin Panel", href: "admin.html" });
  }

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

  const params = new URLSearchParams(window.location.search);
  const q = params.get("q") || "";
  searchInput.value = q;

  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = searchInput.value.trim();
    const params = new URLSearchParams(window.location.search);
    if (value) {
      params.set("q", value);
    } else {
      params.delete("q");
    }
    const query = params.toString();
    window.location.href = query ? `products.html?${query}` : "products.html";
  });
}

function attachCategoryFilter() {
  if (!categoryFilterEl) return;
  const params = new URLSearchParams(window.location.search);
  const category = (params.get("category") || "").trim().toLowerCase();
  categoryFilterEl.value = category;

  categoryFilterEl.addEventListener("change", () => {
    const next = categoryFilterEl.value.trim();
    const nextParams = new URLSearchParams(window.location.search);
    if (next) {
      nextParams.set("category", next);
    } else {
      nextParams.delete("category");
    }
    const query = nextParams.toString();
    window.location.href = query ? `products.html?${query}` : "products.html";
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

function getProductStock(product) {
  return toNumber(product.quantityInMeters ?? product.stockInMeters ?? product.stock ?? 0);
}

function getProductPrice(product) {
  return toNumber(product.pricePerMeter ?? product.price ?? 0);
}

function renderProducts(products) {
  if (!productsGridEl) return;
  if (!Array.isArray(products) || products.length === 0) {
    productsGridEl.innerHTML = `<article class="card"><p class="muted">No products available.</p></article>`;
    return;
  }

  productsGridEl.innerHTML = products
    .map((product) => {
      const productId = product.id ?? product.productId;
      const stock = getProductStock(product);
      const price = getProductPrice(product);
      const stockClass = stock <= 10 ? "stock-low" : "stock-ok";
      const stockText = stock <= 10 ? "Low stock" : "In stock";

      return `
        <article class="product-card">
          <h3>${product.name || "Unnamed Product"}</h3>
          <p class="muted">${product.description || "No description available."}</p>
          <p><strong>Category:</strong> ${product.category || "Uncategorized"}</p>
          <span class="price-tag">$${price.toFixed(2)} / meter</span>
          <p class="${stockClass}">${stockText} (${stock.toFixed(2)}m)</p>
          <form class="form-stack add-cart-form" data-product-id="${productId}">
            <label for="meters-${productId}">Meters</label>
            <input id="meters-${productId}" name="meters" type="number" min="0.1" step="0.1" required />
            <button class="btn btn-primary" type="submit">Add to Cart</button>
          </form>
        </article>
      `;
    })
    .join("");

  productsGridEl.querySelectorAll(".add-cart-form").forEach((form) => {
    form.addEventListener("submit", handleAddToCart);
  });
}

async function fetchProducts() {
  setLoading(true, "Loading products...");
  showStatus("");
  try {
    allProducts = await apiRequest("/products");
    const params = new URLSearchParams(window.location.search);
    const q = (params.get("q") || "").trim().toLowerCase();
    const category = (params.get("category") || "").trim().toLowerCase();
    const filtered = allProducts.filter((product) => {
      const haystack = [product.name, product.category, product.description]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const productCategory = String(product.category || "").trim().toLowerCase();
      const matchesSearch = !q || haystack.includes(q);
      const matchesCategory = !category || productCategory === category;
      return matchesSearch && matchesCategory;
    });

    renderProducts(filtered);
    if (q && category) {
      showStatus(`Showing results for "${q}" in "${category}".`, "info");
    } else if (q) {
      showStatus(`Showing results for "${q}".`, "info");
    } else if (category) {
      showStatus(`Showing category "${category}".`, "info");
    }
  } catch (error) {
    showStatus(error.message, "error");
    renderProducts([]);
  } finally {
    setLoading(false);
  }
}

async function handleAddToCart(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const productId = toNumber(form.dataset.productId, -1);
  const meters = toNumber(new FormData(form).get("meters"), 0);
  const { userId } = getSession();

  if (productId < 0 || meters <= 0) {
    showStatus("Please enter a valid meter quantity.", "error");
    return;
  }

  const payload = {
    userId: toNumber(userId),
    productId,
    meters
  };

  try {
    form.querySelector("button")?.setAttribute("disabled", "true");
    await apiRequest("/cart/add", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    showStatus("Item added to cart.", "success");
    form.reset();
  } catch (error) {
    showStatus(error.message, "error");
  } finally {
    form.querySelector("button")?.removeAttribute("disabled");
  }
}

if (requireUserPageAccess()) {
  renderNav();
  attachSearch();
  attachCategoryFilter();
  fetchProducts();
}
