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
  const { user } = await api('/api/auth/me');
  if (!user) return (location.href = '/');
  if (user.role !== 'user') return (location.href = '/admin.html');
  q('#welcome').textContent = user.name;
  q('#logout-btn').onclick = async () => { await api('/api/auth/logout', { method: 'POST' }); location.href = '/'; };

  const books = await api('/api/my-library');
  q('#library-grid').innerHTML = books
    .map((b) => `<div class="panel"><h4>${b.title}</h4><p>${b.author}</p><a href="${b.download_path || b.pdf_path}" target="_blank" rel="noopener">Open PDF</a></div>`)
    .join('') || '<p>No approved books yet.</p>';
}

bootstrap().then(hideLoader).catch(() => location.href = '/');
