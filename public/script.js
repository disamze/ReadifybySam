const q = (s) => document.querySelector(s);
const words = ['Reading', 'begins', 'here'];
const loaderWord = q('#loader-word');
const loaderFill = q('#loader-fill');

function runLoader() {
  let index = 0;
  const start = performance.now();
  const duration = 3200;

  function animate(now) {
    const progress = Math.min(1, (now - start) / duration);
    loaderFill.style.width = `${progress * 100}%`;
    const wordIndex = Math.min(words.length - 1, Math.floor(progress * words.length));
    if (wordIndex !== index) {
      index = wordIndex;
      loaderWord.textContent = words[index];
    }
    if (progress < 1) requestAnimationFrame(animate);
    else {
      q('#loader').style.display = 'none';
      q('#auth-screen').classList.remove('hidden');
    }
  }
  requestAnimationFrame(animate);
}
runLoader();

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
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(authValues())
    });
    q('#auth-msg').textContent = 'Signup successful. Please login.';
  } catch (e) {
    q('#auth-msg').textContent = e.message;
  }
};

q('#login-btn').onclick = async () => {
  try {
    const { user } = await api('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(authValues())
    });
    location.href = user.role === 'admin' ? '/admin.html' : '/user.html';
  } catch (e) {
    q('#auth-msg').textContent = e.message;
  }
};
