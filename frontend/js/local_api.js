const LocalApi = (() => {
  const ADMIN_EMAIL = "admin@shop.com";
  const DB_KEY = "spc_db";

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function toNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function normalizeCategory(value) {
    return String(value || "").trim();
  }

  function seedDb() {
    const seeded = {
      users: [
        {
          id: 1,
          name: "Admin",
          email: ADMIN_EMAIL,
          password: "admin123",
          address: "Main Store"
        }
      ],
      products: [
        {
          id: 1,
          name: "Premium Rubia Voile",
          category: "rubia voile",
          description: "Soft breathable voile for daily pagari use.",
          pricePerMeter: 7.5,
          quantityInMeters: 120
        },
        {
          id: 2,
          name: "Classic Full Voile",
          category: "full voile",
          description: "Traditional full voile fabric with smooth finish.",
          pricePerMeter: 8.25,
          quantityInMeters: 95
        },
        {
          id: 3,
          name: "Pagari Accessories Set",
          category: "accessories",
          description: "Essential accessories for turban styling.",
          pricePerMeter: 4.0,
          quantityInMeters: 30
        },
        {
          id: 4,
          name: "Kurta Pajama Premium Cotton",
          category: "kurta pajama",
          description: "Comfort cotton fabric suitable for kurta pajama.",
          pricePerMeter: 6.75,
          quantityInMeters: 80
        }
      ],
      carts: {},
      orders: [],
      seq: {
        user: 2,
        product: 5,
        cartItem: 1,
        order: 1
      }
    };

    localStorage.setItem(DB_KEY, JSON.stringify(seeded));
    return seeded;
  }

  function readDb() {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return seedDb();
    try {
      return JSON.parse(raw);
    } catch {
      return seedDb();
    }
  }

  function writeDb(db) {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  }

  function parseBody(options) {
    if (!options || options.body === undefined || options.body === null) return {};
    if (typeof options.body === "string") {
      try {
        return JSON.parse(options.body);
      } catch {
        return {};
      }
    }
    return options.body;
  }

  function requireAdminByQuery(urlObj) {
    const email = urlObj.searchParams.get("email");
    if (email !== ADMIN_EMAIL) throw new Error("Admin access denied.");
  }

  function getPath(path) {
    const urlObj = new URL(path, "http://local");
    return { urlObj, pathname: urlObj.pathname };
  }

  async function request(path, options = {}) {
    const method = String(options.method || "GET").toUpperCase();
    const body = parseBody(options);
    const { pathname, urlObj } = getPath(path);
    const db = readDb();

    if (pathname === "/users/register" && method === "POST") {
      const email = String(body.email || "").trim().toLowerCase();
      if (!email || !body.password || !body.name || !body.address) {
        throw new Error("Please fill all registration fields.");
      }
      if (db.users.some((u) => String(u.email).toLowerCase() === email)) {
        throw new Error("Email already registered.");
      }
      const user = {
        id: db.seq.user++,
        name: String(body.name).trim(),
        email,
        password: String(body.password),
        address: String(body.address).trim()
      };
      db.users.push(user);
      writeDb(db);
      return deepClone({ id: user.id, email: user.email, name: user.name, address: user.address });
    }

    if (pathname === "/users/login" && method === "POST") {
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      const user = db.users.find((u) => String(u.email).toLowerCase() === email && u.password === password);
      if (!user) throw new Error("Invalid email or password.");
      return deepClone({ id: user.id, email: user.email, name: user.name, address: user.address });
    }

    if (pathname === "/products" && method === "GET") {
      return deepClone(db.products);
    }

    if (pathname === "/products" && method === "POST") {
      requireAdminByQuery(urlObj);
      const product = {
        id: db.seq.product++,
        name: String(body.name || "").trim(),
        category: normalizeCategory(body.category).toLowerCase(),
        description: String(body.description || "").trim(),
        pricePerMeter: toNumber(body.pricePerMeter),
        quantityInMeters: toNumber(body.quantityInMeters)
      };
      if (!product.name || !product.category) throw new Error("Product name and category are required.");
      db.products.push(product);
      writeDb(db);
      return deepClone(product);
    }

    if (/^\/products\/\d+$/.test(pathname) && method === "PUT") {
      requireAdminByQuery(urlObj);
      const id = toNumber(pathname.split("/")[2], -1);
      const product = db.products.find((p) => p.id === id);
      if (!product) throw new Error("Product not found.");
      if (body.name !== undefined) product.name = String(body.name).trim();
      if (body.category !== undefined) product.category = normalizeCategory(body.category).toLowerCase();
      if (body.description !== undefined) product.description = String(body.description).trim();
      if (body.pricePerMeter !== undefined) product.pricePerMeter = toNumber(body.pricePerMeter);
      if (body.quantityInMeters !== undefined) product.quantityInMeters = toNumber(body.quantityInMeters);
      writeDb(db);
      return deepClone(product);
    }

    if (/^\/products\/\d+$/.test(pathname) && method === "DELETE") {
      requireAdminByQuery(urlObj);
      const id = toNumber(pathname.split("/")[2], -1);
      db.products = db.products.filter((p) => p.id !== id);
      Object.keys(db.carts).forEach((userId) => {
        db.carts[userId] = (db.carts[userId] || []).filter((item) => item.productId !== id);
      });
      writeDb(db);
      return { success: true };
    }

    if (pathname === "/cart/add" && method === "POST") {
      const userId = toNumber(body.userId, -1);
      const productId = toNumber(body.productId, -1);
      const meters = toNumber(body.meters, 0);
      if (userId < 1 || productId < 1 || meters <= 0) throw new Error("Invalid cart payload.");

      const user = db.users.find((u) => u.id === userId);
      if (!user) throw new Error("User not found.");
      const product = db.products.find((p) => p.id === productId);
      if (!product) throw new Error("Product not found.");
      if (meters > toNumber(product.quantityInMeters)) throw new Error("Requested meters exceed available stock.");

      if (!db.carts[String(userId)]) db.carts[String(userId)] = [];
      const existing = db.carts[String(userId)].find((item) => item.productId === productId);
      if (existing) {
        const updatedMeters = toNumber(existing.meters) + meters;
        if (updatedMeters > toNumber(product.quantityInMeters)) {
          throw new Error("Total requested meters exceed available stock.");
        }
        existing.meters = updatedMeters;
      } else {
        db.carts[String(userId)].push({
          id: db.seq.cartItem++,
          userId,
          productId,
          productName: product.name,
          pricePerMeter: toNumber(product.pricePerMeter),
          meters
        });
      }
      writeDb(db);
      return { success: true };
    }

    if (/^\/cart\/\d+$/.test(pathname) && method === "GET") {
      const userId = String(toNumber(pathname.split("/")[2], -1));
      return deepClone(db.carts[userId] || []);
    }

    if (/^\/cart\/item\/\d+$/.test(pathname) && method === "DELETE") {
      const itemId = toNumber(pathname.split("/")[3], -1);
      Object.keys(db.carts).forEach((userId) => {
        db.carts[userId] = (db.carts[userId] || []).filter((item) => item.id !== itemId);
      });
      writeDb(db);
      return { success: true };
    }

    if (pathname === "/orders/place" && method === "POST") {
      const userId = toNumber(body.userId, -1);
      if (userId < 1) throw new Error("Invalid user ID.");
      const cartItems = db.carts[String(userId)] || [];
      if (cartItems.length === 0) throw new Error("Cart is empty.");

      for (const item of cartItems) {
        const product = db.products.find((p) => p.id === item.productId);
        if (!product) throw new Error(`Product ${item.productId} not found.`);
        if (toNumber(item.meters) > toNumber(product.quantityInMeters)) {
          throw new Error(`Insufficient stock for ${product.name}.`);
        }
      }

      const items = cartItems.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        pricePerMeter: toNumber(item.pricePerMeter),
        meters: toNumber(item.meters)
      }));

      items.forEach((item) => {
        const product = db.products.find((p) => p.id === item.productId);
        if (product) product.quantityInMeters = toNumber(product.quantityInMeters) - toNumber(item.meters);
      });

      const totalAmount = items.reduce((sum, item) => sum + toNumber(item.meters) * toNumber(item.pricePerMeter), 0);
      const order = {
        id: db.seq.order++,
        userId,
        createdAt: new Date().toISOString(),
        totalAmount,
        items
      };
      db.orders.push(order);
      db.carts[String(userId)] = [];
      writeDb(db);
      return deepClone(order);
    }

    if (/^\/orders\/user\/\d+$/.test(pathname) && method === "GET") {
      const userId = toNumber(pathname.split("/")[3], -1);
      return deepClone(db.orders.filter((order) => order.userId === userId));
    }

    if (/^\/admin\/products\/\d+\/stock$/.test(pathname) && method === "PUT") {
      requireAdminByQuery(urlObj);
      const id = toNumber(pathname.split("/")[3], -1);
      const product = db.products.find((p) => p.id === id);
      if (!product) throw new Error("Product not found.");
      product.quantityInMeters = toNumber(body.quantityInMeters, -1);
      if (product.quantityInMeters < 0) throw new Error("Stock cannot be negative.");
      writeDb(db);
      return deepClone(product);
    }

    if (pathname === "/admin/users" && method === "GET") {
      requireAdminByQuery(urlObj);
      return deepClone(db.users.map((u) => ({ id: u.id, name: u.name, email: u.email, address: u.address })));
    }

    if (pathname === "/admin/orders" && method === "GET") {
      requireAdminByQuery(urlObj);
      return deepClone(db.orders);
    }

    if (pathname === "/admin/products/low-stock" && method === "GET") {
      requireAdminByQuery(urlObj);
      return deepClone(db.products.filter((p) => toNumber(p.quantityInMeters) <= 10));
    }

    throw new Error(`Unsupported local endpoint: ${method} ${pathname}`);
  }

  return { request };
})();
