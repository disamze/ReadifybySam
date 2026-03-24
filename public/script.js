const q = (s) => document.querySelector(s);
const loaderWord = q('#loader-word');
const loader = q('#loader');
const words = ['Reading', 'begins', 'here'];
let i = 0;
const wi = setInterval(() => {
  i = (i + 1) % words.length;
  loaderWord.textContent = words[i];
}, 1400);
setTimeout(() => {
  clearInterval(wi);
  loader.classList.add('hidden');
  q('#auth-screen').classList.remove('hidden');
}, 4500);

q('#year').textContent = new Date().getFullYear();
const cart = new Map();

async function api(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function authValues() {
  return {
    name: q('#name').value,
    email: q('#email').value,
    password: q('#password').value,
    role: document.querySelector('input[name="role"]:checked').value
  };
}

q('#signup-btn').onclick = async () => {
  try {
    await api('/api/auth/signup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(authValues())
    });
    q('#auth-msg').textContent = 'Signup done. Login now.';
  } catch (e) { q('#auth-msg').textContent = e.message; }
};

q('#login-btn').onclick = async () => {
  try {
    const { user } = await api('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(authValues())
    });
    q('#auth-screen').classList.add('hidden');
    q('#app').classList.remove('hidden');
    q('#welcome').textContent = `Hi, ${user.name} (${user.role})`;
    user.role === 'admin' ? renderAdmin() : renderUser();
  } catch (e) { q('#auth-msg').textContent = e.message; }
};

q('#logout-btn').onclick = async () => {
  await api('/api/auth/logout', { method: 'POST' });
  location.reload();
};

async function renderUser() {
  q('#admin-view').classList.add('hidden');
  const el = q('#user-view');
  el.classList.remove('hidden');
  const data = await api('/api/public-data');
  const library = await api('/api/my-library').catch(() => []);

  el.innerHTML = `
    <section class="section">
      <h3>Books</h3>
      <div class="grid">
        ${data.books.map((b) => `
          <article class="book">
            <h4>${b.title}</h4>
            <p class="small">${b.author}</p>
            <p>${b.description || ''}</p>
            <p><b>₹${b.price}</b></p>
            <button onclick="addToCart(${b.id})">Add to cart</button>
          </article>
        `).join('')}
      </div>
    </section>
    <section class="section panel">
      <h3>Cart & UPI checkout</h3>
      ${data.settings.upi_qr_path ? `<img src="${data.settings.upi_qr_path}" alt="UPI QR" style="max-width:180px;border-radius:10px"/>` : '<p>No QR uploaded by admin.</p>'}
      <p>UPI ID: ${data.settings.upi_id || 'Not set'}</p>
      <div id="cart-list"></div>
      <input id="payment-proof" type="file" accept="image/*" />
      <button onclick="checkout()">Place order (Pending admin approval)</button>
    </section>
    <section class="section">
      <h3>Purchased by students: ${data.purchased}</h3>
      <h3>Testimonials</h3>
      <div class="grid">${data.testimonials.map(t => `<div class="panel"><b>${t.name}</b><p>${t.content}</p><small>${'⭐'.repeat(t.rating)}</small></div>`).join('')}</div>
    </section>
    <section class="section">
      <h3>My Approved Library</h3>
      <div class="grid">${library.map(b => `<div class="panel"><b>${b.title}</b><p>${b.author}</p><a href="${b.pdf_path}" target="_blank">Open PDF</a></div>`).join('') || '<p>No approved books yet.</p>'}</div>
    </section>
  `;
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
  if (!entries.length) return (wrap.innerHTML = '<p>Cart empty</p>');
  let total = 0;
  wrap.innerHTML = entries.map(([id, qty]) => {
    const b = books.find(x => x.id === id) || { title: 'Book', price: 0 };
    total += b.price * qty;
    return `<p>${b.title} × ${qty} = ₹${(b.price * qty).toFixed(2)}</p>`;
  }).join('') + `<h4>Total: ₹${total.toFixed(2)}</h4>`;
}

window.checkout = async () => {
  const fd = new FormData();
  fd.append('items', JSON.stringify([...cart.entries()].map(([bookId, quantity]) => ({ bookId, quantity }))));
  const file = q('#payment-proof').files[0];
  if (file) fd.append('payment_screenshot', file);
  try {
    await api('/api/orders', { method: 'POST', body: fd });
    alert('Order submitted. Wait for admin approval.');
    cart.clear();
    renderUser();
  } catch (e) { alert(e.message); }
};

async function renderAdmin() {
  q('#user-view').classList.add('hidden');
  const el = q('#admin-view');
  el.classList.remove('hidden');
  const data = await api('/api/admin/dashboard');
  el.innerHTML = `
    <section class="section grid">
      <div class="panel"><h3>Users</h3>${data.users.map(u => `<p>${u.name} (${u.role}) <button onclick="toggleRole(${u.id}, '${u.role === 'admin' ? 'user' : 'admin'}')">Make ${u.role === 'admin' ? 'user' : 'admin'}</button></p>`).join('')}</div>
      <div class="panel"><h3>Orders</h3>${data.orders.map(o => `<p>#${o.id} ${o.user_name} ₹${o.total} [${o.status}] ${o.payment_screenshot ? `<a href="${o.payment_screenshot}" target="_blank">proof</a>` : ''} <button onclick="setOrder(${o.id}, 'approved')">Approve</button> <button onclick="setOrder(${o.id}, 'rejected')">Reject</button></p>`).join('')}</div>
    </section>
    <section class="section panel">
      <h3>Add Book (PDF upload)</h3>
      <form id="book-form">
        <input name="title" placeholder="Title" required />
        <input name="author" placeholder="Author" required />
        <input name="description" placeholder="Description" />
        <input name="price" type="number" step="0.01" placeholder="Price" required />
        <input name="cover_url" placeholder="Cover image URL" />
        <input name="pdf" type="file" accept="application/pdf" required />
        <button>Add Book</button>
      </form>
      <h4>Manage Books</h4>
      ${data.books.map(b => `<p>${b.title} ₹${b.price} <button onclick="delBook(${b.id})">Delete</button></p>`).join('')}
    </section>
    <section class="section panel">
      <h3>UPI QR Settings</h3>
      ${data.settings.upi_qr_path ? `<img src="${data.settings.upi_qr_path}" style="max-width:180px;border-radius:10px" />` : ''}
      <form id="qr-form">
        <input name="upi_id" value="${data.settings.upi_id || ''}" placeholder="UPI ID" />
        <input name="qr" type="file" accept="image/*" />
        <button>Update UPI</button>
      </form>
    </section>
    <section class="section panel">
      <h3>Testimonials</h3>
      <form id="test-form">
        <input name="name" placeholder="Name" required />
        <input name="content" placeholder="Testimonial" required />
        <input name="rating" type="number" min="1" max="5" value="5" />
        <button>Add Testimonial</button>
      </form>
      ${data.testimonials.map(t => `<p>${t.name}: ${t.content} (${t.rating}) <button onclick="delTest(${t.id})">Delete</button></p>`).join('')}
    </section>
  `;

  q('#book-form').onsubmit = async (e) => {
    e.preventDefault();
    await api('/api/admin/books', { method: 'POST', body: new FormData(e.target) });
    renderAdmin();
  };
  q('#qr-form').onsubmit = async (e) => {
    e.preventDefault();
    await api('/api/admin/settings/qr', { method: 'POST', body: new FormData(e.target) });
    renderAdmin();
  };
  q('#test-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await api('/api/admin/testimonials', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: fd.get('name'), content: fd.get('content'), rating: fd.get('rating') })
    });
    renderAdmin();
  };
}

window.delBook = async (id) => { await api(`/api/admin/books/${id}`, { method: 'DELETE' }); renderAdmin(); };
window.setOrder = async (id, status) => { await api(`/api/admin/orders/${id}/status`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) }); renderAdmin(); };
window.toggleRole = async (id, role) => { await api(`/api/admin/users/${id}/role`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }) }); renderAdmin(); };
window.delTest = async (id) => { await api(`/api/admin/testimonials/${id}`, { method: 'DELETE' }); renderAdmin(); };

q('#contact-form').onsubmit = async (e) => {
  e.preventDefault();
  try {
    await api('/api/contact', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: q('#cname').value, email: q('#cemail').value, message: q('#cmessage').value })
    });
    q('#contact-msg').textContent = 'Message sent to disamaze@gmail.com';
    e.target.reset();
  } catch (err) { q('#contact-msg').textContent = err.message; }
};
