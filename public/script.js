const q = (s) => document.querySelector(s);
const container = q('.container');
const registerBtn = q('.register-btn');
const loginBtn = q('.login-btn');
const loaderElement = q('.bookshelf_wrapper');

const showLoader = (direction) => {
  if (!loaderElement) return;
  loaderElement.classList.remove('loader-left', 'loader-right');
  if (direction) loaderElement.classList.add(direction);
  loaderElement.style.display = 'flex';
  setTimeout(() => {
    loaderElement.style.display = 'none';
  }, 1100);
};

registerBtn?.addEventListener('click', () => {
  showLoader('loader-right');
  container?.classList.add('active');
});

loginBtn?.addEventListener('click', () => {
  showLoader('loader-left');
  container?.classList.remove('active');
});

const words = ['Reading', 'begins', 'here'];
const loaderWord = q('#loader-word');

(function runLoader() {
  if (!loaderWord || !q('#loader')) return;
  let index = 0;
  const start = performance.now();
  const duration = 2200;

  function animate(now) {
    const progress = Math.min(1, (now - start) / duration);
    const wordIndex = Math.min(words.length - 1, Math.floor(progress * words.length));

    if (wordIndex !== index) {
      index = wordIndex;
      loaderWord.textContent = words[index];
    }

    if (progress < 1) {
      requestAnimationFrame(animate);
      return;
    }

    const loader = q('#loader');
    loader.style.opacity = '0';
    setTimeout(() => {
      loader.style.display = 'none';
    }, 350);
  }

  requestAnimationFrame(animate);
})();

async function api(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

const roleSwitch = q('#login-role-switch');
const roleHidden = q('#login-role');
roleSwitch?.querySelectorAll('.role-btn').forEach((btn, idx) => {
  btn.onclick = () => {
    roleSwitch.querySelectorAll('.role-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    roleHidden.value = btn.dataset.role;
    roleSwitch.style.setProperty('--pill-x', `${idx * 100}%`);
  };
});

q('#signup-form').onsubmit = async (e) => {
  e.preventDefault();
  const msg = q('#signup-msg');

  try {
    await api('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: q('#signup-name').value.trim(),
        email: q('#signup-email').value.trim(),
        password: q('#signup-password').value,
        role: 'user'
      })
    });

    msg.textContent = 'Signup successful! Please sign in.';
    container?.classList.remove('active');
    q('#login-email').value = q('#signup-email').value.trim();
    q('#login-password').focus();
  } catch (err) {
    msg.textContent = err.message;
  }
};

q('#login-form').onsubmit = async (e) => {
  e.preventDefault();
  const msg = q('#login-msg');

  try {
    const { user } = await api('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: q('#login-email').value.trim(),
        password: q('#login-password').value,
        role: q('#login-role').value
      })
    });

    location.href = user.role === 'admin' ? '/admin.html' : '/user.html';
  } catch (err) {
    msg.textContent = err.message;
  }
};
