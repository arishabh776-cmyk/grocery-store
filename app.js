const state = {
  products: [],
  categories: [],
  cart: { items: [], subtotal: 0, delivery: 0, tax: 0, total: 0 },
  user: JSON.parse(localStorage.getItem("glasUser") || "null"),
  token: localStorage.getItem("glasToken"),
  authMode: "login"
};

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const els = {
  productGrid: document.querySelector("#productGrid"),
  categorySelect: document.querySelector("#categorySelect"),
  sortSelect: document.querySelector("#sortSelect"),
  searchInput: document.querySelector("#searchInput"),
  cartBtn: document.querySelector("#cartBtn"),
  cartDrawer: document.querySelector("#cartDrawer"),
  cartItems: document.querySelector("#cartItems"),
  cartCount: document.querySelector("#cartCount"),
  totals: document.querySelector("#totals"),
  checkoutBtn: document.querySelector("#checkoutBtn"),
  addressInput: document.querySelector("#addressInput"),
  authBtn: document.querySelector("#authBtn"),
  authDialog: document.querySelector("#authDialog"),
  authForm: document.querySelector("#authForm"),
  authTitle: document.querySelector("#authTitle"),
  toggleAuth: document.querySelector("#toggleAuth"),
  nameInput: document.querySelector("#nameInput"),
  emailInput: document.querySelector("#emailInput"),
  passwordInput: document.querySelector("#passwordInput"),
  ordersBtn: document.querySelector("#ordersBtn"),
  ordersDialog: document.querySelector("#ordersDialog"),
  ordersList: document.querySelector("#ordersList"),
  adminBtn: document.querySelector("#adminBtn"),
  adminDialog: document.querySelector("#adminDialog"),
  adminStats: document.querySelector("#adminStats"),
  adminOrderCount: document.querySelector("#adminOrderCount"),
  adminOrders: document.querySelector("#adminOrders"),
  productForm: document.querySelector("#productForm"),
  adminProducts: document.querySelector("#adminProducts"),
  toast: document.querySelector("#toast")
};

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const response = await fetch(path, { ...options, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || "Something went wrong");
  return payload;
}

function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => els.toast.classList.remove("show"), 2600);
}

function requireLogin() {
  if (state.token) return true;
  els.authDialog.showModal();
  return false;
}

function setSession(payload) {
  state.user = payload.user;
  state.token = payload.token;
  localStorage.setItem("glasUser", JSON.stringify(payload.user));
  localStorage.setItem("glasToken", payload.token);
  renderSession();
}

function clearSession() {
  state.user = null;
  state.token = null;
  state.cart = { items: [], subtotal: 0, delivery: 0, tax: 0, total: 0 };
  localStorage.removeItem("glasUser");
  localStorage.removeItem("glasToken");
  renderSession();
  renderCart();
}

function renderSession() {
  els.authBtn.textContent = state.user ? `Hi, ${state.user.name.split(" ")[0]}` : "Sign in";
  els.adminBtn.style.display = state.user?.role === "admin" ? "inline-grid" : "none";
}

async function loadProducts() {
  const params = new URLSearchParams({
    q: els.searchInput.value.trim(),
    category: els.categorySelect.value || "All",
    sort: els.sortSelect.value
  });
  const data = await api(`/api/products?${params}`);
  state.products = data.products;
  state.categories = data.categories;
  renderCategories();
  renderProducts();
  renderAdmin();
}

function renderCategories() {
  const current = els.categorySelect.value || "All";
  els.categorySelect.innerHTML = state.categories
    .map((category) => `<option value="${category}">${category}</option>`)
    .join("");
  els.categorySelect.value = state.categories.includes(current) ? current : "All";
}

function renderProducts() {
  if (!state.products.length) {
    els.productGrid.innerHTML = `<div class="checkout-card">No products found. Try a different search.</div>`;
    return;
  }
  els.productGrid.innerHTML = state.products
    .map(
      (product) => `
      <article class="product-card">
        <div class="product-image" style="background-image:url('${product.image}')"></div>
        <div class="product-body">
          <div class="product-meta">
            <span>${product.category}</span>
            <span>${product.rating} stars</span>
          </div>
          <h3>${product.name}</h3>
          <p>${product.tags.slice(0, 3).join(" / ")} / ${product.stock} left</p>
          <div class="price-row">
            <div>
              <span class="price">${money.format(product.price)}</span>
              <span class="hint"> ${product.unit}</span>
            </div>
            <button class="add-btn" data-add="${product.id}" ${product.stock < 1 ? "disabled" : ""}>Add</button>
          </div>
        </div>
      </article>`
    )
    .join("");
}

async function loadCart() {
  if (!state.token) return renderCart();
  state.cart = await api("/api/cart");
  renderCart();
}

function renderCart() {
  const cart = state.cart;
  els.cartCount.textContent = cart.items.reduce((sum, item) => sum + item.quantity, 0);
  els.cartItems.innerHTML = cart.items.length
    ? cart.items
        .map(
          (item) => `
        <div class="cart-line">
          <img src="${item.image}" alt="${item.name}">
          <div class="cart-main">
            <strong>${item.name}</strong>
            <span>${money.format(item.price)} / ${item.unit}</span>
          </div>
          <div class="qty-controls">
            <button class="qty-btn" data-qty="${item.productId}" data-next="${item.quantity - 1}">-</button>
            <strong>${item.quantity}</strong>
            <button class="qty-btn" data-qty="${item.productId}" data-next="${item.quantity + 1}">+</button>
          </div>
        </div>`
        )
        .join("")
    : `<div class="checkout-card">Your cart is waiting for something fresh.</div>`;

  els.totals.innerHTML = `
    <div><span>Subtotal</span><strong>${money.format(cart.subtotal)}</strong></div>
    <div><span>Delivery</span><strong>${cart.delivery ? money.format(cart.delivery) : "Free"}</strong></div>
    <div><span>Tax</span><strong>${money.format(cart.tax)}</strong></div>
    <div><span>Total</span><strong>${money.format(cart.total)}</strong></div>`;
}

function renderOrders(orders) {
  els.ordersList.innerHTML = orders.length
    ? orders
        .map(
          (order) => `
      <div class="order-card">
        <div>
          <strong>${order.id}</strong>
          <p class="hint">${order.items.length} items / ${order.status} / ETA ${order.etaMinutes} min${order.customer ? ` / ${order.customer.name}` : ""}</p>
        </div>
        <strong>${money.format(order.total)}</strong>
      </div>`
        )
        .join("")
    : `<div class="checkout-card">No orders yet.</div>`;
}

function renderAdminDashboard(dashboard) {
  const { summary, orders, products, lowStock } = dashboard;
  els.adminStats.innerHTML = [
    ["Revenue", money.format(summary.revenue)],
    ["Orders", summary.orders],
    ["Items sold", summary.itemsSold],
    ["Customers", summary.customers],
    ["Products", summary.products],
    ["Low stock", summary.lowStock],
    ["Inventory value", money.format(summary.inventoryValue)]
  ]
    .map(
      ([label, value]) => `
      <div class="stat-card">
        <span>${label}</span>
        <strong>${value}</strong>
      </div>`
    )
    .join("");

  els.adminOrderCount.textContent = `${orders.length} total`;
  els.adminOrders.innerHTML = orders.length
    ? orders
        .map(
          (order) => `
      <article class="manager-order-card">
        <div class="order-topline">
          <div>
            <strong>${order.id}</strong>
            <span>${new Date(order.createdAt).toLocaleString()}</span>
          </div>
          <div class="status-pill">${order.status}</div>
        </div>
        <div class="order-grid">
          <div>
            <span>Customer</span>
            <strong>${order.customer?.name || "Customer"}</strong>
            <small>${order.customer?.email || "No email"}</small>
          </div>
          <div>
            <span>Delivery address</span>
            <strong>${order.address}</strong>
            <small>ETA ${order.etaMinutes} min</small>
          </div>
          <div>
            <span>Payment</span>
            <strong>${order.paymentMethod}</strong>
            <small>${money.format(order.total)} total</small>
          </div>
        </div>
        <div class="order-items">
          ${order.items
            .map(
              (item) => `
            <div>
              <span>${item.name} x ${item.quantity}</span>
              <strong>${money.format(item.price * item.quantity)}</strong>
            </div>`
            )
            .join("")}
        </div>
        <div class="order-total-line">
          <span>Subtotal ${money.format(order.subtotal)} / Delivery ${order.delivery ? money.format(order.delivery) : "Free"} / Tax ${money.format(order.tax)}</span>
          <strong>${money.format(order.total)}</strong>
        </div>
      </article>`
        )
        .join("")
    : `<div class="checkout-card">No received orders yet. New checkouts will appear here automatically.</div>`;

  els.adminProducts.innerHTML = products
    .map(
      (product) => `
      <div class="admin-row ${lowStock.some((item) => item.id === product.id) ? "low-stock-row" : ""}">
        <div>
          <strong>${product.name}</strong>
          <span>${product.category} / ${money.format(product.price)} / ${product.unit}</span>
        </div>
        <div class="stock-control">
          <span>${product.stock <= 10 ? "Low" : "Stock"}</span>
          <input data-stock="${product.id}" type="number" value="${product.stock}" min="0" aria-label="${product.name} stock" />
        </div>
      </div>`
    )
    .join("");
}

function renderAdmin() {
  if (state.user?.role !== "admin") return;
  els.adminProducts.innerHTML = state.products
    .map(
      (product) => `
      <div class="admin-row">
        <div>
          <strong>${product.name}</strong>
          <span>${product.category} / ${money.format(product.price)} / stock ${product.stock}</span>
        </div>
        <input data-stock="${product.id}" type="number" value="${product.stock}" min="0" aria-label="${product.name} stock" />
      </div>`
    )
    .join("");
}

async function loadAdminDashboard() {
  const dashboard = await api("/api/admin/dashboard");
  renderAdminDashboard(dashboard);
}

async function addToCart(productId) {
  if (!requireLogin()) return;
  state.cart = await api("/api/cart", {
    method: "POST",
    body: JSON.stringify({ productId, quantity: 1 })
  });
  renderCart();
  toast("Added to cart");
}

async function setQuantity(productId, quantity) {
  if (quantity <= 0) {
    state.cart = await api(`/api/cart/${productId}`, { method: "DELETE" });
  } else {
    state.cart = await api(`/api/cart/${productId}`, {
      method: "PATCH",
      body: JSON.stringify({ quantity })
    });
  }
  renderCart();
}

els.productGrid.addEventListener("click", (event) => {
  const id = event.target.dataset.add;
  if (id) addToCart(id).catch((error) => toast(error.message));
});

els.cartItems.addEventListener("click", (event) => {
  const id = event.target.dataset.qty;
  if (id) setQuantity(id, Number(event.target.dataset.next)).catch((error) => toast(error.message));
});

els.cartBtn.addEventListener("click", () => {
  if (!requireLogin()) return;
  els.cartDrawer.classList.add("open");
  els.cartDrawer.setAttribute("aria-hidden", "false");
  loadCart().catch((error) => toast(error.message));
});

document.querySelectorAll("[data-close]").forEach((button) => {
  button.addEventListener("click", () => {
    const drawer = document.querySelector(`#${button.dataset.close}`);
    drawer.classList.remove("open");
    drawer.setAttribute("aria-hidden", "true");
  });
});

document.querySelectorAll("[data-dialog-close]").forEach((button) => {
  button.addEventListener("click", () => document.querySelector(`#${button.dataset.dialogClose}`).close());
});

els.checkoutBtn.addEventListener("click", async () => {
  if (!requireLogin()) return;
  try {
    const { order } = await api("/api/checkout", {
      method: "POST",
      body: JSON.stringify({ address: els.addressInput.value })
    });
    toast(`${order.id} confirmed automatically`);
    els.addressInput.value = "";
    await Promise.all([loadCart(), loadProducts()]);
  } catch (error) {
    toast(error.message);
  }
});

els.authBtn.addEventListener("click", () => {
  if (state.user) {
    clearSession();
    toast("Signed out");
  } else {
    els.authDialog.showModal();
  }
});

els.toggleAuth.addEventListener("click", () => {
  state.authMode = state.authMode === "login" ? "register" : "login";
  const isRegister = state.authMode === "register";
  els.authTitle.textContent = isRegister ? "Create account" : "Sign in";
  els.nameInput.classList.toggle("hidden", !isRegister);
  els.nameInput.required = isRegister;
  els.toggleAuth.textContent = isRegister ? "I already have an account" : "Create a new account";
});

els.authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const path = state.authMode === "register" ? "/api/auth/register" : "/api/auth/login";
    const payload = {
      name: els.nameInput.value,
      email: els.emailInput.value,
      password: els.passwordInput.value
    };
    setSession(await api(path, { method: "POST", body: JSON.stringify(payload) }));
    els.authDialog.close();
    els.authForm.reset();
    await loadCart();
    toast("Welcome to GlasMart");
  } catch (error) {
    toast(error.message);
  }
});

els.ordersBtn.addEventListener("click", async () => {
  if (!requireLogin()) return;
  try {
    const { orders } = await api("/api/orders");
    renderOrders(orders);
    els.ordersDialog.showModal();
  } catch (error) {
    toast(error.message);
  }
});

els.adminBtn.addEventListener("click", async () => {
  if (state.user?.role !== "admin") return toast("Admin login required");
  try {
    await loadAdminDashboard();
    els.adminDialog.showModal();
  } catch (error) {
    toast(error.message);
  }
});

els.productForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(els.productForm);
  const product = Object.fromEntries(form.entries());
  product.price = Number(product.price);
  product.stock = Number(product.stock);
  product.tags = [product.category.toLowerCase(), "new"];
  product.image =
    product.image ||
    "https://images.unsplash.com/photo-1543168256-418811576931?auto=format&fit=crop&w=900&q=80";
  try {
    await api("/api/products", { method: "POST", body: JSON.stringify(product) });
    els.productForm.reset();
    await loadProducts();
    await loadAdminDashboard();
    toast("Product added");
  } catch (error) {
    toast(error.message);
  }
});

els.adminProducts.addEventListener("change", async (event) => {
  const id = event.target.dataset.stock;
  if (!id) return;
  try {
    await api(`/api/products/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ stock: Number(event.target.value) })
    });
    await loadProducts();
    await loadAdminDashboard();
    toast("Stock updated");
  } catch (error) {
    toast(error.message);
  }
});

let productTimer;
[els.searchInput, els.categorySelect, els.sortSelect].forEach((input) => {
  input.addEventListener("input", () => {
    clearTimeout(productTimer);
    productTimer = setTimeout(() => loadProducts().catch((error) => toast(error.message)), 180);
  });
});

renderSession();
loadProducts().catch((error) => toast(error.message));
loadCart().catch(() => clearSession());
