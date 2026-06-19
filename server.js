const http = require("http");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const os = require("os");

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const DATA_DIR = path.join(os.tmpdir(), "auto-grocery-store");
const DATA_FILE = path.join(DATA_DIR, "store.json");
const SEED_FILE = path.join(__dirname, "data", "store.json");
const PUBLIC_DIR = path.join(__dirname, "public");

const initialProducts = [
  {
    id: "p-berries",
    name: "Organic Berry Basket",
    category: "Fruits",
    price: 349,
    unit: "500 g",
    stock: 42,
    rating: 4.8,
    tags: ["organic", "fresh", "antioxidant"],
    image: "https://images.unsplash.com/photo-1498557850523-fd3d118b962e?auto=format&fit=crop&w=900&q=80"
  },
  {
    id: "p-avocado",
    name: "Hass Avocados",
    category: "Fruits",
    price: 229,
    unit: "pack of 2",
    stock: 35,
    rating: 4.7,
    tags: ["keto", "creamy", "breakfast"],
    image: "https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?auto=format&fit=crop&w=900&q=80"
  },
  {
    id: "p-broccoli",
    name: "Hydroponic Broccoli",
    category: "Vegetables",
    price: 119,
    unit: "1 head",
    stock: 56,
    rating: 4.6,
    tags: ["green", "fiber", "farm"],
    image: "https://images.unsplash.com/photo-1459411621453-7b03977f4bfc?auto=format&fit=crop&w=900&q=80"
  },
  {
    id: "p-milk",
    name: "A2 Farm Milk",
    category: "Dairy",
    price: 88,
    unit: "1 L",
    stock: 80,
    rating: 4.9,
    tags: ["daily", "protein", "chilled"],
    image: "https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&w=900&q=80"
  },
  {
    id: "p-bread",
    name: "Sourdough Country Loaf",
    category: "Bakery",
    price: 189,
    unit: "450 g",
    stock: 24,
    rating: 4.7,
    tags: ["artisan", "breakfast", "fresh-baked"],
    image: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=900&q=80"
  },
  {
    id: "p-eggs",
    name: "Free Range Eggs",
    category: "Dairy",
    price: 165,
    unit: "12 pcs",
    stock: 38,
    rating: 4.8,
    tags: ["protein", "breakfast", "free-range"],
    image: "https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?auto=format&fit=crop&w=900&q=80"
  },
  {
    id: "p-almonds",
    name: "California Almonds",
    category: "Pantry",
    price: 499,
    unit: "500 g",
    stock: 30,
    rating: 4.9,
    tags: ["snack", "protein", "premium"],
    image: "https://images.unsplash.com/photo-1508061253366-f7da158b6d46?auto=format&fit=crop&w=900&q=80"
  },
  {
    id: "p-juice",
    name: "Cold Pressed Citrus",
    category: "Beverages",
    price: 145,
    unit: "300 ml",
    stock: 45,
    rating: 4.5,
    tags: ["vitamin-c", "chilled", "no-sugar"],
    image: "https://images.unsplash.com/photo-1600271886742-f049cd451bba?auto=format&fit=crop&w=900&q=80"
  }
];

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml"
};

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    const seed = await fs.readFile(SEED_FILE, "utf8").catch(() => "");
    const data = seed
      ? JSON.parse(seed)
      : {
          users: [
            {
              id: "u-admin",
              name: "Store Admin",
              email: "admin@grocer.local",
              passwordHash: hashPassword("admin123"),
              role: "admin",
              createdAt: new Date().toISOString()
            }
          ],
          products: initialProducts,
          carts: {},
          orders: []
        };
    await saveStore(data);
  }
}

async function readStore() {
  await ensureStore();
  return JSON.parse(await fs.readFile(DATA_FILE, "utf8"));
}

async function saveStore(data) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

function id(prefix = "id") {
  return `${prefix}-${crypto.randomUUID()}`;
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 32, "sha256").toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, passwordHash) {
  const [salt, stored] = passwordHash.split(":");
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 32, "sha256").toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(stored, "hex"));
}

function base64url(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function signUser(user) {
  const payload = { id: user.id, role: user.role, name: user.name, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 };
  const body = `${base64url({ alg: "HS256", typ: "JWT" })}.${base64url(payload)}`;
  const signature = crypto.createHmac("sha256", JWT_SECRET).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function verifyToken(token) {
  const [header, payload, signature] = token.split(".");
  if (!header || !payload || !signature) return null;
  const expected = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${payload}`).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  const user = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  if (user.exp < Date.now()) return null;
  return user;
}

function sanitizeUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

function buildCart(data, userId) {
  const cart = data.carts[userId] || [];
  const items = cart
    .map((line) => {
      const product = data.products.find((item) => item.id === line.productId);
      if (!product) return null;
      return {
        productId: product.id,
        name: product.name,
        price: product.price,
        image: product.image,
        unit: product.unit,
        stock: product.stock,
        quantity: Math.min(line.quantity, product.stock)
      };
    })
    .filter(Boolean);
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const delivery = subtotal > 999 || subtotal === 0 ? 0 : 49;
  const tax = Math.round(subtotal * 0.05);
  return { items, subtotal, delivery, tax, total: subtotal + delivery + tax };
}

function enrichOrder(data, order) {
  const customer = data.users.find((user) => user.id === order.userId);
  return {
    ...order,
    customer: customer ? sanitizeUser(customer) : { id: order.userId, name: "Guest customer", email: "Unknown", role: "customer" }
  };
}

function buildAdminDashboard(data) {
  const enrichedOrders = data.orders.map((order) => enrichOrder(data, order));
  const revenue = enrichedOrders.reduce((sum, order) => sum + order.total, 0);
  const itemsSold = enrichedOrders.reduce(
    (sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
    0
  );
  const lowStock = data.products.filter((product) => product.stock <= 10);
  const inventoryValue = data.products.reduce((sum, product) => sum + product.price * product.stock, 0);
  const statusCounts = enrichedOrders.reduce((counts, order) => {
    counts[order.status] = (counts[order.status] || 0) + 1;
    return counts;
  }, {});

  return {
    summary: {
      orders: enrichedOrders.length,
      revenue,
      itemsSold,
      customers: data.users.filter((user) => user.role !== "admin").length,
      products: data.products.length,
      lowStock: lowStock.length,
      inventoryValue,
      statusCounts
    },
    orders: enrichedOrders,
    products: data.products,
    lowStock
  };
}

function send(res, status, payload, headers = {}) {
  const body = typeof payload === "string" ? payload : JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": typeof payload === "string" ? "text/plain; charset=utf-8" : "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    ...headers
  });
  res.end(body);
}

async function parseBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function getAuth(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  return token ? verifyToken(token) : null;
}

function requireUser(req, res) {
  const user = getAuth(req);
  if (!user) {
    send(res, 401, { message: "Authentication required" });
    return null;
  }
  return user;
}

function routeKey(req, pathname) {
  return `${req.method} ${pathname}`;
}

async function handleApi(req, res, url) {
  if (req.method === "OPTIONS") {
    return send(res, 204, "", {
      "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    });
  }

  const key = routeKey(req, url.pathname);

  if (key === "GET /api/health") {
    const data = await readStore();
    return send(res, 200, { ok: true, products: data.products.length, orders: data.orders.length });
  }

  if (key === "POST /api/auth/register") {
    const { name, email, password } = await parseBody(req);
    if (!name || !email || !password || password.length < 6) {
      return send(res, 400, { message: "Name, valid email, and 6+ character password are required" });
    }
    const data = await readStore();
    if (data.users.some((user) => user.email.toLowerCase() === email.toLowerCase())) {
      return send(res, 409, { message: "Email is already registered" });
    }
    const user = {
      id: id("u"),
      name,
      email: email.toLowerCase(),
      passwordHash: hashPassword(password),
      role: "customer",
      createdAt: new Date().toISOString()
    };
    data.users.push(user);
    data.carts[user.id] = [];
    await saveStore(data);
    return send(res, 201, { user: sanitizeUser(user), token: signUser(user) });
  }

  if (key === "POST /api/auth/login") {
    const { email, password } = await parseBody(req);
    const data = await readStore();
    const user = data.users.find((item) => item.email.toLowerCase() === String(email || "").toLowerCase());
    if (!user || !verifyPassword(password || "", user.passwordHash)) {
      return send(res, 401, { message: "Invalid email or password" });
    }
    return send(res, 200, { user: sanitizeUser(user), token: signUser(user) });
  }

  if (key === "GET /api/products") {
    const q = (url.searchParams.get("q") || "").toLowerCase();
    const category = url.searchParams.get("category") || "All";
    const sort = url.searchParams.get("sort") || "featured";
    const data = await readStore();
    let products = data.products.filter((product) => {
      const matchesQuery =
        product.name.toLowerCase().includes(q) ||
        product.category.toLowerCase().includes(q) ||
        product.tags.some((tag) => tag.toLowerCase().includes(q));
      const matchesCategory = category === "All" || product.category === category;
      return matchesQuery && matchesCategory;
    });
    if (sort === "price-asc") products = products.sort((a, b) => a.price - b.price);
    if (sort === "price-desc") products = products.sort((a, b) => b.price - a.price);
    if (sort === "rating") products = products.sort((a, b) => b.rating - a.rating);
    return send(res, 200, { products, categories: ["All", ...new Set(data.products.map((product) => product.category))] });
  }

  if (key === "POST /api/products") {
    const user = requireUser(req, res);
    if (!user) return;
    if (user.role !== "admin") return send(res, 403, { message: "Admin access required" });
    const product = { id: id("p"), rating: 4.5, tags: [], ...(await parseBody(req)) };
    if (!product.name || !product.category || !product.price || !product.unit) {
      return send(res, 400, { message: "Name, category, price, and unit are required" });
    }
    const data = await readStore();
    data.products.push(product);
    await saveStore(data);
    return send(res, 201, { product });
  }

  const productPatch = url.pathname.match(/^\/api\/products\/([^/]+)$/);
  if (req.method === "PATCH" && productPatch) {
    const user = requireUser(req, res);
    if (!user) return;
    if (user.role !== "admin") return send(res, 403, { message: "Admin access required" });
    const data = await readStore();
    const product = data.products.find((item) => item.id === productPatch[1]);
    if (!product) return send(res, 404, { message: "Product not found" });
    Object.assign(product, await parseBody(req), { id: product.id });
    await saveStore(data);
    return send(res, 200, { product });
  }

  if (key === "GET /api/cart") {
    const user = requireUser(req, res);
    if (!user) return;
    const data = await readStore();
    return send(res, 200, buildCart(data, user.id));
  }

  if (key === "POST /api/cart") {
    const user = requireUser(req, res);
    if (!user) return;
    const { productId, quantity = 1 } = await parseBody(req);
    const data = await readStore();
    const product = data.products.find((item) => item.id === productId);
    if (!product) return send(res, 404, { message: "Product not found" });
    const cart = data.carts[user.id] || [];
    const existing = cart.find((item) => item.productId === productId);
    const nextQuantity = Math.min(product.stock, Math.max(1, Number(quantity)));
    if (existing) existing.quantity = Math.min(product.stock, existing.quantity + nextQuantity);
    else cart.push({ productId, quantity: nextQuantity });
    data.carts[user.id] = cart;
    await saveStore(data);
    return send(res, 200, buildCart(data, user.id));
  }

  const cartItem = url.pathname.match(/^\/api\/cart\/([^/]+)$/);
  if ((req.method === "PATCH" || req.method === "DELETE") && cartItem) {
    const user = requireUser(req, res);
    if (!user) return;
    const data = await readStore();
    const cart = data.carts[user.id] || [];
    const existing = cart.find((item) => item.productId === cartItem[1]);
    if (req.method === "DELETE") {
      data.carts[user.id] = cart.filter((item) => item.productId !== cartItem[1]);
      await saveStore(data);
      return send(res, 200, buildCart(data, user.id));
    }
    const product = data.products.find((item) => item.id === cartItem[1]);
    if (!product || !existing) return send(res, 404, { message: "Cart item not found" });
    existing.quantity = Math.min(product.stock, Math.max(1, Number((await parseBody(req)).quantity)));
    await saveStore(data);
    return send(res, 200, buildCart(data, user.id));
  }

  if (key === "POST /api/checkout") {
    const user = requireUser(req, res);
    if (!user) return;
    const { address, paymentMethod = "UPI AutoPay" } = await parseBody(req);
    if (!address?.trim()) return send(res, 400, { message: "Delivery address is required" });
    const data = await readStore();
    const cart = buildCart(data, user.id);
    if (!cart.items.length) return send(res, 400, { message: "Cart is empty" });
    for (const item of cart.items) {
      const product = data.products.find((entry) => entry.id === item.productId);
      if (!product || product.stock < item.quantity) return send(res, 409, { message: `${item.name} does not have enough stock` });
    }
    cart.items.forEach((item) => {
      const product = data.products.find((entry) => entry.id === item.productId);
      product.stock -= item.quantity;
    });
    const order = {
      id: `ORD-${Date.now()}`,
      userId: user.id,
      items: cart.items,
      subtotal: cart.subtotal,
      delivery: cart.delivery,
      tax: cart.tax,
      total: cart.total,
      address,
      paymentMethod,
      status: "Auto-confirmed",
      etaMinutes: 28,
      createdAt: new Date().toISOString()
    };
    data.orders.unshift(order);
    data.carts[user.id] = [];
    await saveStore(data);
    return send(res, 201, { order });
  }

  if (key === "GET /api/orders") {
    const user = requireUser(req, res);
    if (!user) return;
    const data = await readStore();
    const orders =
      user.role === "admin"
        ? data.orders.map((order) => enrichOrder(data, order))
        : data.orders.filter((order) => order.userId === user.id);
    return send(res, 200, { orders });
  }

  if (key === "GET /api/admin/dashboard") {
    const user = requireUser(req, res);
    if (!user) return;
    if (user.role !== "admin") return send(res, 403, { message: "Admin access required" });
    const data = await readStore();
    return send(res, 200, buildAdminDashboard(data));
  }

  const orderStatus = url.pathname.match(/^\/api\/orders\/([^/]+)\/status$/);
  if (req.method === "PATCH" && orderStatus) {
    const user = requireUser(req, res);
    if (!user) return;
    if (user.role !== "admin") return send(res, 403, { message: "Admin access required" });
    const data = await readStore();
    const order = data.orders.find((item) => item.id === orderStatus[1]);
    if (!order) return send(res, 404, { message: "Order not found" });
    order.status = (await parseBody(req)).status || order.status;
    await saveStore(data);
    return send(res, 200, { order });
  }

  return send(res, 404, { message: "API route not found" });
}

async function serveStatic(req, res, url) {
  const requested = url.pathname === "/" ? "/index.html" : url.pathname;
  const target = path.normalize(path.join(PUBLIC_DIR, requested));
  if (!target.startsWith(PUBLIC_DIR)) return send(res, 403, "Forbidden");
  try {
    const data = await fs.readFile(target);
    res.writeHead(200, { "Content-Type": mimeTypes[path.extname(target)] || "application/octet-stream" });
    res.end(data);
  } catch {
    const data = await fs.readFile(path.join(PUBLIC_DIR, "index.html"));
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(data);
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith("/api/")) await handleApi(req, res, url);
    else await serveStatic(req, res, url);
  } catch (error) {
    console.error(error);
    send(res, 500, { message: "Server error" });
  }
});

ensureStore().then(() => {
  if (process.argv.includes("--seed-only")) {
    console.log(`Seed ready at ${DATA_FILE}`);
    return;
  }
  server.listen(PORT, () => console.log(`Auto Grocery Store running at http://localhost:${PORT}`));
});
