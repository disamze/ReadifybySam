const q = (s) => document.querySelector(s);
q('#year').textContent = new Date().getFullYear();

const CART_KEY = 'readify_cart';
const getCart = () => JSON.parse(localStorage.getItem(CART_KEY) || '[]');
const setCart = (items) => localStorage.setItem(CART_KEY, JSON.stringify(items));

async function api(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

async function bootstrap() {
  const { user } = await api('/api/auth/me');
  if (!user) return (location.href = '/');
  if (user.role !== 'user') return (location.href = '/admin.html');
  q('#welcome').textContent = user.name;
  q('#logout-btn').onclick = async () => { await api('/api/auth/logout', { method: 'POST' }); location.href = '/'; };

  const [books, pdata] = await Promise.all([api('/api/books'), api('/api/public-data')]);
  const cart = getCart();

  if (!cart.length) q('#cart-list').innerHTML = '<p>Your cart is empty. Visit Books page.</p>';
  else {
    let total = 0;
    q('#cart-list').innerHTML = cart.map((item, idx) => {
      const b = books.find((x) => x.id === item.bookId) || { title: 'Book', price: 0 };
      total += b.price * item.quantity;
      return `<p>${b.title} × ${item.quantity} = ₹${(b.price * item.quantity).toFixed(2)} <button onclick="removeItem(${idx})">Remove</button></p>`;
    }).join('') + `<h4>Total: ₹${total.toFixed(2)}</h4>`;
  }

  q('#upi-box').innerHTML = `${pdata.settings.upi_qr_path ? `<img src="${pdata.settings.upi_qr_path}" style="max-width:220px;border-radius:12px"/>` : '<p>No UPI QR configured.</p>'}<p>UPI ID: <b>${pdata.settings.upi_id || 'Not configured'}</b></p>`;

  q('#checkout-btn').onclick = async () => {
    const items = getCart();
    if (!items.length) return alert('Cart empty');
    const fd = new FormData();
    fd.append('items', JSON.stringify(items));
    const file = q('#payment-proof').files[0];
    if (file) fd.append('payment_screenshot', file);
    await api('/api/orders', { method: 'POST', body: fd });
    setCart([]);
    alert('Order submitted successfully. Wait for admin approval.');
    location.href = '/library.html';
  };
}

window.removeItem = (idx) => {
  const cart = getCart();
  cart.splice(idx, 1);
  setCart(cart);
  location.reload();
};

bootstrap().catch(() => location.href = '/');
