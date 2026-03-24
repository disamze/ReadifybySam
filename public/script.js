const q = (s) => document.querySelector(s);
const words = ['Reading', 'begins', 'here'];
const loaderWord = q('#loader-word');

(function runLoader() {
  let index = 0;
  const start = performance.now();
  const duration = 3000;
  function animate(now) {
    const progress = Math.min(1, (now - start) / duration);
    const wordIndex = Math.min(words.length - 1, Math.floor(progress * words.length));
    if (wordIndex !== index) {
      index = wordIndex;
      loaderWord.textContent = words[index];
    }
    if (progress < 1) requestAnimationFrame(animate);
    else {
      q('#loader').style.opacity = '0';
      setTimeout(() => {
        q('#loader').style.display = 'none';
        q('#auth-screen').classList.remove('hidden');
      }, 350);
    }
  }
  requestAnimationFrame(animate);
})();

async function api(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

const authShell = q('#auth-shell');
q('#show-signup').onclick = () => authShell.classList.add('right-panel-active');
q('#show-signin').onclick = () => authShell.classList.remove('right-panel-active');


const roleSwitch = q('#login-role-switch');
const roleHidden = q('#login-role');
roleSwitch.querySelectorAll('.role-btn').forEach((btn, idx) => {
  btn.onclick = () => {
    roleSwitch.querySelectorAll('.role-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    roleHidden.value = btn.dataset.role;
    roleSwitch.style.setProperty('--pill-x', `${idx * 100}%`);
  };
});

q('#signup-form').onsubmit = async (e) => {
  e.preventDefault();
  try {
    await api('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: q('#signup-name').value,
        email: q('#signup-email').value,
        password: q('#signup-password').value,
        role: 'user'
      })
    });
    q('#signup-msg').textContent = 'Signup successful! Please sign in.';
    authShell.classList.remove('right-panel-active');
  } catch (err) {
    q('#signup-msg').textContent = err.message;
  }
};

q('#login-form').onsubmit = async (e) => {
  e.preventDefault();
  try {
    const { user } = await api('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: q('#login-email').value,
        password: q('#login-password').value,
        role: q('#login-role').value
      })
    });
    location.href = user.role === 'admin' ? '/admin.html' : '/user.html';
  } catch (err) {
    q('#login-msg').textContent = err.message;
  }
};
