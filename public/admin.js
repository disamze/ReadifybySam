const q = (s) => document.querySelector(s);
q('#year').textContent = new Date().getFullYear();
const hideLoader = () => { const l = q('#page-loader'); if (!l) return; l.style.opacity = '0'; setTimeout(() => (l.style.display = 'none'), 260); };

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
    if (user.role !== 'admin') return (location.href = '/user.html');
    q('#welcome').textContent = user.name;
    await renderAdmin();
    hideLoader();
  } catch {
    location.href = '/';
  }
}

q('#logout-btn').onclick = async () => {
  await api('/api/auth/logout', { method: 'POST' });
  location.href = '/';
};

async function renderAdmin() {
  const data = await api('/api/admin/dashboard');
  const settings = data.settings || { upi_qr_path: '', upi_id: '' };

  q('#overview').innerHTML = `
    <div class="panel"><h3>${data.users.length}</h3><p>Total Users</p></div>
    <div class="panel"><h3>${data.books.length}</h3><p>Total Books</p></div>
    <div class="panel"><h3>${data.orders.length}</h3><p>Total Orders</p></div>
    <div class="panel"><h3>${data.orders.filter((o) => o.status === 'pending').length}</h3><p>Pending Orders</p></div>
  `;

  q('#orders').innerHTML = `<h3>Manage Orders</h3>${data.orders.map((o) => `<p>#${o.id} ${o.user_name} ₹${o.total} [${o.status}] ${o.payment_screenshot ? `<a href="${o.payment_screenshot}" target="_blank">proof</a>` : ''} <button onclick="setOrder('${o.id}', 'approved')">Approve</button> <button onclick="setOrder('${o.id}', 'rejected')">Reject</button></p>`).join('') || '<p>No orders yet.</p>'}`;

  q('#books').innerHTML = `
    <h3>Books Management</h3>
    <form id="book-form">
      <input name="title" placeholder="Title" required />
      <input name="author" placeholder="Author" required />
      <input name="description" placeholder="Description" />
      <input name="price" type="number" step="0.01" placeholder="Price" required />
      <label>Book Thumbnail / Cover Image</label>
      <input name="cover_image" type="file" accept="image/*" required />
      <label>Preview Pages (optional, multiple images)</label>
      <input name="preview_pages" type="file" accept="image/*" multiple />
      <label>Main Book PDF</label>
      <input name="pdf" type="file" accept="application/pdf" required />
      <button type="submit">Add Book</button>
    </form>
    <h4>Existing Books</h4>
    ${data.books.map((b) => `<div class="panel"><p>${b.title} ₹${b.price}</p>${b.cover_image_path ? `<img src="${b.cover_image_path}" style="max-width:90px;border-radius:8px"/>` : ''}<p>Preview pages: ${(b.preview_pages || []).length}</p><button onclick="delBook('${b.id || b._id}')">Delete</button></div>`).join('') || '<p>No books yet.</p>'}
  `;

  q('#users').innerHTML = `<h3>Users Management</h3>${data.users.map((u) => `<p>${u.name} (${u.email}) role:${u.role} <button onclick="toggleRole('${u.id}', '${u.role === 'admin' ? 'user' : 'admin'}')">Make ${u.role === 'admin' ? 'user' : 'admin'}</button></p>`).join('')}`;

  q('#testimonials').innerHTML = `
    <h3>Testimonials</h3>
    <form id="test-form">
      <input name="name" placeholder="Name" required />
      <input name="content" placeholder="Testimonial" required />
      <input name="rating" type="number" min="1" max="5" value="5" />
      <button type="submit">Add Testimonial</button>
    </form>
    ${data.testimonials.map((t) => `<p>${t.name}: ${t.content} (${t.rating}) <button onclick="delTest('${t.id || t._id}')">Delete</button></p>`).join('')}
  `;

  q('#settings').innerHTML = `
    <h3>UPI Settings</h3>
    ${settings.upi_qr_path ? `<img src="${settings.upi_qr_path}" style="max-width:200px;border-radius:12px"/>` : '<p>No QR uploaded</p>'}
    <form id="qr-form">
      <input name="upi_id" value="${settings.upi_id || ''}" placeholder="UPI ID" />
      <input name="qr" type="file" accept="image/*" />
      <button type="submit">Update UPI</button>
    </form>
  `;

  q('#book-form').onsubmit = async (e) => {
    e.preventDefault();
    await api('/api/admin/books', { method: 'POST', body: new FormData(e.target) });
    renderAdmin();
  };

  q('#test-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await api('/api/admin/testimonials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: fd.get('name'), content: fd.get('content'), rating: fd.get('rating') })
    });
    renderAdmin();
  };

  q('#qr-form').onsubmit = async (e) => {
    e.preventDefault();
    await api('/api/admin/settings/qr', { method: 'POST', body: new FormData(e.target) });
    renderAdmin();
  };
}

window.delBook = async (id) => { await api(`/api/admin/books/${id}`, { method: 'DELETE' }); renderAdmin(); };
window.setOrder = async (id, status) => { await api(`/api/admin/orders/${id}/status`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) }); renderAdmin(); };
window.toggleRole = async (id, role) => { await api(`/api/admin/users/${id}/role`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }) }); renderAdmin(); };
window.delTest = async (id) => { await api(`/api/admin/testimonials/${id}`, { method: 'DELETE' }); renderAdmin(); };

bootstrap();
