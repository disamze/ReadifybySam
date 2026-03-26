const q = (s) => document.querySelector(s);
q('#year').textContent = new Date().getFullYear();
const toastContainer = q('#toast-container');

function showToast(message, type = 'success') {
  if (!toastContainer) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-6px)';
    setTimeout(() => toast.remove(), 220);
  }, 4500);
}

function hideLoader() {
  const loader = q('#page-loader');
  if (!loader) return;
  loader.style.opacity = '0';
  setTimeout(() => (loader.style.display = 'none'), 300);
}

async function api(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function renderTestimonials(list) {
  q('#testimonials').innerHTML = `<h3>Testimonials</h3><div class="grid">${list
    .map((t) => `<div class="panel"><b>${t.name}</b><p>${t.content}</p><small>${'⭐'.repeat(t.rating)}</small></div>`)
    .join('')}</div>`;
}

function startTicker(events) {
  const ticker = q('#purchase-ticker');
  if (!events.length) {
    ticker.textContent = 'No approved purchases yet.';
    return;
  }
  let i = 0;
  const show = () => {
    const e = events[i % events.length];
    ticker.style.opacity = '0';
    setTimeout(() => {
      ticker.textContent = `${e.buyer} purchased “${e.title}”`;
      ticker.style.opacity = '1';
    }, 200);
    i += 1;
  };
  show();
  setInterval(show, 1000);
}

function renderBookSlider(books) {
  const track = q('#book-slider');
  if (!books.length) {
    track.innerHTML = '<div class="slide-card">Books will appear here soon.</div>';
    return;
  }

  const items = books.slice(0, 10);
  const doubled = [...items, ...items];
  track.innerHTML = doubled
    .map(
      (b) => `
      <article class="slide-card">
        ${b.cover_image_path ? `<img src="${b.cover_image_path}" alt="${b.title}" />` : ''}
        <h4>${b.title}</h4>
        <p>${b.author || ''}</p>
        <strong>₹${b.price}</strong>
      </article>`
    )
    .join('');
}

async function bootstrap() {
  const { user } = await api('/api/auth/me');
  if (!user) return (location.href = '/');
  if (user.role !== 'user') return (location.href = '/admin.html');
  q('#welcome').textContent = user.name;
  q('#logout-btn').onclick = async () => {
    await api('/api/auth/logout', { method: 'POST' });
    location.href = '/';
  };

  const [data, purchases] = await Promise.all([api('/api/public-data'), api('/api/recent-purchases').catch(() => [])]);

  q('#stats').innerHTML = `
    <div class="panel"><h3>${data.books.length}</h3><p>Books Available</p></div>
    <div class="panel"><h3>${data.purchased}</h3><p>Student Purchases</p></div>
    <div class="panel"><h3>${data.testimonials.length}</h3><p>Testimonials</p></div>
  `;

  renderTestimonials(data.testimonials || []);
  renderBookSlider(data.books || []);
  startTicker(purchases || []);

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) q('#book-anim').classList.add('open');
      });
    },
    { threshold: 0.35 }
  );
  observer.observe(q('#book-anim'));

  hideLoader();
}

q('#review-form').onsubmit = async (e) => {
  e.preventDefault();
  try {
    const resp = await api('/api/user/testimonials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: q('#review-content').value, rating: q('#review-rating').value })
    });
    q('#review-msg').textContent = resp.message;
    e.target.reset();

    const fresh = await api('/api/public-data');
    renderTestimonials(fresh.testimonials || []);
  } catch (err) {
    q('#review-msg').textContent = err.message;
  }
};

q('#contact-form').onsubmit = async (e) => {
  e.preventDefault();
  try {
    const resp = await api('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: q('#cname').value.trim(),
        email: q('#cemail').value.trim(),
        message: q('#cmessage').value.trim()
      })
    });
    showToast(resp.message || 'Message sent successfully.', 'success');
    e.target.reset();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

bootstrap().catch(() => (location.href = '/'));
