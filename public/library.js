const q = (s) => document.querySelector(s);
q('#year').textContent = new Date().getFullYear();

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

  const books = await api('/api/my-library');
  q('#library-grid').innerHTML = books.map((b) => `<div class="panel"><h4>${b.title}</h4><p>${b.author}</p><a href="${b.pdf_path}" target="_blank">Open PDF</a></div>`).join('') || '<p>No approved books yet.</p>';
}

bootstrap().catch(() => location.href = '/');
