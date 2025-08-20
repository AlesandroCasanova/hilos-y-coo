// Login | Hilos y Coo — versión "como registro" (card visual + form)
const API = 'http://localhost:3000/api';

const form        = document.getElementById('loginForm');
const msg         = document.getElementById('mensaje');
const btn         = document.getElementById('btn-login');
const inputEmail  = document.getElementById('email');
const inputPass   = document.getElementById('password');
const toggleBtn   = document.getElementById('btn-toggle-pass');

function showMessage(type, text){
  if (!msg) return;
  msg.className = 'msg ' + (type || '');
  msg.textContent = text || '';
}

function setLoading(state){
  if (!btn) return;
  if (state) { btn.classList.add('loading'); btn.disabled = true; }
  else { btn.classList.remove('loading'); btn.disabled = false; }
}

function showSuccessOverlay(){
  const overlay = document.getElementById('successOverlay');
  overlay?.classList.add('show');
}

// Mostrar / ocultar contraseña
toggleBtn?.addEventListener('click', () => {
  const isPass = inputPass.type === 'password';
  inputPass.type = isPass ? 'text' : 'password';
  toggleBtn.setAttribute('aria-pressed', String(isPass));
  toggleBtn.textContent = isPass ? 'Ocultar' : 'Mostrar';
  inputPass.focus();
});

// Submit
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  showMessage('', '');

  const email = (inputEmail?.value || '').trim();
  const contraseña = (inputPass?.value || '').trim();

  if (!email || !contraseña) {
    showMessage('error', 'Completá email y contraseña.');
    return;
  }

  try {
    setLoading(true);

    const res = await fetch(`${API}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, contraseña })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      showMessage('error', data?.mensaje || 'Credenciales inválidas.');
      setLoading(false);
      return;
    }

    if (data?.token)   localStorage.setItem('token', data.token);
    if (data?.usuario) localStorage.setItem('usuario', JSON.stringify(data.usuario));

    showMessage('ok', '¡Bienvenido! Redirigiendo…');
    showSuccessOverlay();
    setTimeout(() => { window.location.href = 'dashboard.html'; }, 900);

  } catch (err) {
    console.error(err);
    showMessage('error', 'Error de conexión con el servidor.');
  } finally {
    setTimeout(() => setLoading(false), 1000);
  }
});

// Autofocus
window.addEventListener('DOMContentLoaded', () => {
  inputEmail?.focus();
});
