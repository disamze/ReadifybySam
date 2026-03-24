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

  const data = await api('/api/public-data');
  q('#stats').innerHTML = `
    <div class="panel"><h3>${data.books.length}</h3><p>Books Available</p></div>
    <div class="panel"><h3>${data.purchased}</h3><p>Student Purchases</p></div>
    <div class="panel"><h3>${data.testimonials.length}</h3><p>Testimonials</p></div>
  `;

  q('#testimonials').innerHTML = `<h3>Testimonials</h3><div class="grid">${data.testimonials.map((t) => `<div class="panel"><b>${t.name}</b><p>${t.content}</p><small>${'⭐'.repeat(t.rating)}</small></div>`).join('')}</div>`;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) q('#book-anim').classList.add('open'); });
  }, { threshold: 0.35 });
  observer.observe(q('#book-anim'));
}

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

bootstrap().catch(() => location.href = '/');
