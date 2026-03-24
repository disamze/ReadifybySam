const q = (s) => document.querySelector(s);
const cart = new Map();
q('#year').textContent = new Date().getFullYear();

async function api(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

async function bootstrap() {
  try {
    const { user } = await api('/api/auth/me');
    if (!user) return (location.href = '/');
    if (user.role !== 'user') return (location.href = '/admin.html');
    q('#welcome').textContent = `${user.name}`;
    await renderUser();
  } catch {
    location.href = '/';
  }
}

q('#logout-btn').onclick = async () => {
  await api('/api/auth/logout', { method: 'POST' });
  location.href = '/';
};

async function renderUser() {
  const data = await api('/api/public-data');
  const library = await api('/api/my-library').catch(() => []);

  q('#stats').innerHTML = `
    <div class="panel"><h3>${data.books.length}</h3><p>Books Available</p></div>
    <div class="panel"><h3>${data.purchased}</h3><p>Student Purchases</p></div>
    <div class="panel"><h3>${data.testimonials.length}</h3><p>Testimonials</p></div>
  `;

  q('#books').innerHTML = `<h3>Books Store</h3><div class="grid">${data.books.map((b) => `
      <article class="book">
        <h4>${b.title}</h4><p class="small">${b.author}</p><p>${b.description || ''}</p><p><b>₹${b.price}</b></p>
        <button onclick="addToCart(${b.id})">Add to Cart</button>
      </article>`).join('') || '<p>No books listed yet.</p>'}</div>`;

  q('#cart').innerHTML = `
    <h3>Cart & Checkout</h3>
    ${data.settings.upi_qr_path ? `<img src="${data.settings.upi_qr_path}" style="max-width:210px;border-radius:12px"/>` : '<p>No UPI QR configured.</p>'}
    <p>UPI ID: <b>${data.settings.upi_id || 'Not configured'}</b></p>
    <div id="cart-list" class="panel"></div>
    <input id="payment-proof" type="file" accept="image/*" />
    <button onclick="checkout()">Submit Payment Request</button>
  `;

  q('#library').innerHTML = `<h3>My Approved Library</h3><div class="grid">${library.map((b) => `<div class="panel"><b>${b.title}</b><p>${b.author}</p><a href="${b.pdf_path}" target="_blank">Download PDF</a></div>`).join('') || '<p>No approved books yet.</p>'}</div>`;

  q('#testimonials').innerHTML = `<h3>Testimonials</h3><div class="grid">${data.testimonials.map((t) => `<div class="panel"><b>${t.name}</b><p>${t.content}</p><small>${'⭐'.repeat(t.rating)}</small></div>`).join('')}</div>`;

  renderCart(data.books);
}

window.addToCart = async (bookId) => {
  cart.set(bookId, (cart.get(bookId) || 0) + 1);
  const books = await api('/api/books');
  renderCart(books);
};

function renderCart(books) {
  const wrap = q('#cart-list');
  if (!wrap) return;
  const entries = [...cart.entries()];
  if (!entries.length) return (wrap.innerHTML = '<p>Cart is empty.</p>');
  let total = 0;
  wrap.innerHTML = entries
    .map(([id, qty]) => {
      const b = books.find((x) => x.id === id) || { title: 'Book', price: 0 };
      total += b.price * qty;
      return `<p>${b.title} × ${qty} = ₹${(b.price * qty).toFixed(2)}</p>`;
    })
    .join('') + `<h4>Total: ₹${total.toFixed(2)}</h4>`;
}

window.checkout = async () => {
  const fd = new FormData();
  fd.append('items', JSON.stringify([...cart.entries()].map(([bookId, quantity]) => ({ bookId, quantity }))));
  const file = q('#payment-proof')?.files?.[0];
  if (file) fd.append('payment_screenshot', file);
  try {
    await api('/api/orders', { method: 'POST', body: fd });
    alert('Order placed. Waiting for admin approval.');
    cart.clear();
    await renderUser();
  } catch (e) {
    alert(e.message);
  }
};

q('#contact-form').onsubmit = async (e) => {
  e.preventDefault();
  try {
    await api('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: q('#cname').value, email: q('#cemail').value, message: q('#cmessage').value })
    });
    q('#contact-msg').textContent = 'Message sent successfully.';
    e.target.reset();
  } catch (err) {
    q('#contact-msg').textContent = err.message;
  }
};

bootstrap();
