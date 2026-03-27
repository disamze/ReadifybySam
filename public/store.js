const q = (s) => document.querySelector(s);
q('#year').textContent = new Date().getFullYear();
const hideLoader = () => { const l = q('#page-loader'); if (!l) return; l.style.opacity = '0'; setTimeout(() => (l.style.display = 'none'), 260); };

const CART_KEY = 'readify_cart';
const getCart = () => JSON.parse(localStorage.getItem(CART_KEY) || '[]');
const setCart = (items) => localStorage.setItem(CART_KEY, JSON.stringify(items));

function resolveBookCover(book) {
  const raw = book?.cover_image_path || book?.cover_url || '';
  const cleaned = String(raw).trim().replace(/\\/g, '/');
  if (!cleaned) return '';
  if (cleaned.startsWith('/uploads/')) return cleaned;
  if (/^https?:\/\//i.test(cleaned)) return cleaned;
  if (cleaned.startsWith('uploads/')) return `/${cleaned}`;
  const uploadsStart = cleaned.toLowerCase().indexOf('/uploads/');
  if (uploadsStart >= 0) return cleaned.slice(uploadsStart);
  return cleaned;
}

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
  q('#books-grid').innerHTML = books.map((b) => {
    const id = b.id || b._id;
    const cover = resolveBookCover(b);
    return `
    <article class="book product-card">
      <div class="book-image-wrap">
        ${cover ? `<img src="${cover}" alt="${b.title}" loading="lazy" onerror="this.closest('.book-image-wrap').style.display='none'" />` : ''}
      </div>
      <div class="book-meta">
        <p class="book-tag">Top Pick</p>
        <h4>${b.title}</h4>
        <p class="small byline">by ${b.author || 'Unknown Author'}</p>
        <p class="description">${b.description || 'Handpicked exam-ready content designed for fast revisions.'}</p>
        <div class="book-footer">
          <p class="price">₹${Number(b.price || 0).toFixed(2)}</p>
          <div class="actions-row">
            <button onclick="addToCart('${id}')">Add to cart</button>
            <button class="ghost" onclick="buyNow('${id}')">Buy now</button>
          </div>
        </div>
      </div>
    </article>`;
  }).join('');
}

window.addToCart = (bookId) => { addItem(bookId); location.href = '/cart.html'; };
window.buyNow = (bookId) => { setCart([{ bookId, quantity: 1 }]); location.href = '/cart.html'; };

bootstrap().then(hideLoader).catch(() => location.href = '/');
