const API_BASE_URL = "http://localhost:8080";
const ADMIN_EMAIL = "admin@shop.com";

const navEl = document.getElementById("mainNav");
const feedbackEl = document.getElementById("feedback");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");

/**
 * Standardized API response parsing with clear errors.
 */
async function apiRequest(path, options = {}) {
  return LocalApi.request(path, options);
}

function showFeedback(message, type = "info") {
  if (!feedbackEl) return;
  feedbackEl.className = `feedback ${type}`;
  feedbackEl.textContent = message;
}

function saveSession(user) {
  const email = user.email || user.userEmail;
  const userId = user.id || user.userId;

  if (!email || userId === undefined || userId === null) {
    throw new Error("Login succeeded but response is missing email or userId.");
  }

  localStorage.setItem("userEmail", String(email));
  localStorage.setItem("userId", String(userId));
}

function redirectAfterLogin(email) {
  if (email === ADMIN_EMAIL) {
    window.location.href = "admin.html";
    return;
  }
  window.location.href = "products.html";
}

function clearSession() {
  localStorage.removeItem("userEmail");
  localStorage.removeItem("userId");
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

function renderNav() {
  if (!navEl) return;

  const userEmail = localStorage.getItem("userEmail");
  const loggedInLinks = [
    { key: "home", top: "Go to", label: "Home", href: "products.html" },
    { key: "products", top: "Shop", label: "Products", href: "products.html" },
    { key: "cart", top: "Go to", label: "Cart Page", href: "cart.html", cart: true },
    { key: "orders", top: "Track", label: "Orders", href: "orders.html" }
  ];

  if (userEmail === ADMIN_EMAIL) {
    loggedInLinks.push({ key: "admin", top: "Store", label: "Admin Panel", href: "admin.html" });
  }

  const guestLinks = [
    { key: "home", top: "Welcome", label: "Home", href: "index.html" },
    { key: "login", top: "Account", label: "Sign In", href: "index.html" },
    { key: "register", top: "New Here?", label: "Register", href: "register.html" }
  ];

  const links = userEmail ? [...loggedInLinks, { key: "logout", top: "Secure", label: "Logout", href: "#" }] : guestLinks;

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
    clearSession();
    renderNav();
    window.location.href = "index.html";
  });
}

renderNav();
attachSearch();

if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    showFeedback("Signing in...", "info");

    const formData = new FormData(loginForm);
    const payload = {
      email: String(formData.get("email") || "").trim(),
      password: String(formData.get("password") || "")
    };

    try {
      const user = await apiRequest("/users/login", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      saveSession(user);
      showFeedback("Login successful. Redirecting...", "success");
      redirectAfterLogin(payload.email);
    } catch (error) {
      showFeedback(error.message, "error");
    }
  });
}

if (registerForm) {
  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    showFeedback("Creating account...", "info");

    const formData = new FormData(registerForm);
    const payload = {
      name: String(formData.get("name") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      password: String(formData.get("password") || ""),
      address: String(formData.get("address") || "").trim()
    };

    try {
      await apiRequest("/users/register", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      showFeedback("Registration successful. You can login now.", "success");
      registerForm.reset();
      setTimeout(() => {
        window.location.href = "index.html";
      }, 900);
    } catch (error) {
      showFeedback(error.message, "error");
    }
  });
}
