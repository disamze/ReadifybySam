const q = (s) => document.querySelector(s);
q('#year').textContent = new Date().getFullYear();
const hideLoader = () => { const l = q('#page-loader'); if (!l) return; l.style.opacity = '0'; setTimeout(() => (l.style.display = 'none'), 260); };

const CART_KEY = 'readify_cart';
const getCart = () => JSON.parse(localStorage.getItem(CART_KEY) || '[]');
const setCart = (items) => localStorage.setItem(CART_KEY, JSON.stringify(items));

async function api(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function addItem(bookId) {
  const cart = getCart();
  const item = cart.find((i) => i.bookId === bookId);
  if (item) item.quantity += 1;
  else cart.push({ bookId, quantity: 1 });
  setCart(cart);
}

async function bootstrap() {
  const { user } = await api('/api/auth/me');
  if (!user) return (location.href = '/');
  if (user.role !== 'user') return (location.href = '/admin.html');
  q('#welcome').textContent = user.name;
  q('#logout-btn').onclick = async () => { await api('/api/auth/logout', { method: 'POST' }); location.href = '/'; };

  const books = await api('/api/books');
  q('#books-grid').innerHTML = books.map((b) => `
    <article class="book">
      ${b.cover_image_path ? `<img src="${b.cover_image_path}" style="width:100%;max-height:180px;object-fit:cover;border-radius:10px"/>` : ""}<h4>${b.title}</h4>
      <p class="small">${b.author}</p>
      <p>${b.description || ''}</p>
      <p><b>₹${b.price}</b></p>
      <div class="actions-row">
        <button onclick="addToCart('${b.id || b._id}')">Add to cart</button>
        <button class="ghost" onclick="buyNow('${b.id || b._id}')">Buy now</button>
      </div>
    </article>`).join('');
}

window.addToCart = (bookId) => { addItem(bookId); location.href = '/cart.html'; };
window.buyNow = (bookId) => { setCart([{ bookId, quantity: 1 }]); location.href = '/cart.html'; };

bootstrap().then(hideLoader).catch(() => location.href = '/');
