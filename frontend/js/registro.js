import { mostrarMensaje } from './utils.js';

// API base (ajustar a IP si registrás desde otra PC)
const API = 'http://localhost:3000/api';

const form = document.getElementById('registroForm');
const mensaje = document.getElementById('mensaje');
const btn = document.getElementById('btn-registrar');

// Preferencias del dispositivo (para confetti/animaciones)
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches; // móvil/tablet en general

// ====== Confetti optimizado ======
function confetti(durationMs = 1400) {
  if (prefersReducedMotion) return;

  const canvas = document.createElement('canvas');
  canvas.id = 'confetti-canvas';
  const ctx = canvas.getContext('2d');
  document.body.appendChild(canvas);

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize(); window.addEventListener('resize', resize, { passive: true });

  const colors = ['#8f78e0','#a990f2','#7863c3','#5f4fa0','#cbbcff','#efeaff','#e1d6ff'];
  const N = isCoarsePointer ? 70 : 160; // menos partículas en mobile
  const particles = Array.from({length: N}).map(() => ({
    x: Math.random() * canvas.width,
    y: -20 - Math.random() * canvas.height * .3,
    r: 3 + Math.random() * 4,
    c: colors[Math.floor(Math.random() * colors.length)],
    vx: -2 + Math.random() * 4,
    vy: 2 + Math.random() * 3,
    a: Math.random() * Math.PI * 2,
    va: -0.1 + Math.random() * 0.2
  }));

  const start = performance.now();
  function loop(t) {
    const dt = t - start;
    ctx.clearRect(0,0,canvas.width,canvas.height);

    for (let i=0; i<particles.length; i++){
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.a += p.va;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.a);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.r, -p.r, p.r*2, p.r*2);
      ctx.restore();

      if (p.y > canvas.height + 20) { p.y = -20; p.x = Math.random() * canvas.width; }
    }

    if (dt < durationMs) requestAnimationFrame(loop);
    else {
      window.removeEventListener('resize', resize);
      canvas.remove();
    }
  }
  requestAnimationFrame(loop);
}

function setLoading(state){
  if (!btn) return;
  if (state) { btn.classList.add('loading'); btn.disabled = true; }
  else { btn.classList.remove('loading'); btn.disabled = false; }
}

function showSuccessOverlay(){
  const overlay = document.getElementById('successOverlay');
  overlay?.classList.add('show');
  confetti(isCoarsePointer ? 1100 : 1400);
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const nombre = document.getElementById('nombre').value.trim();
  const email = document.getElementById('email').value.trim();
  const contraseña = document.getElementById('password').value; // la BD usa 'contraseña'
  const rol = (document.getElementById('rol').value || 'duenio').trim();

  if (!nombre || !email || contraseña.length < 6) {
    mensaje.textContent = 'Completá todos los campos (mínimo 6 caracteres de contraseña).';
    mensaje.className = 'msg error';
    mostrarMensaje?.('Datos inválidos', 'error');
    return;
  }

  try {
    setLoading(true);

    const resp = await fetch(`${API}/usuarios/registro-duenio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, email, contraseña, rol })
    });

    const ct = resp.headers.get('content-type') || '';
    let data;
    if (ct.includes('application/json')) data = await resp.json();
    else { const text = await resp.text(); throw new Error(text || `Error HTTP ${resp.status}`); }

    if (!resp.ok) {
      const msg = data.mensaje || data.error || 'Error al registrar';
      mensaje.textContent = msg;
      mensaje.className = 'msg error';
      mostrarMensaje?.(msg, 'error');
      setLoading(false);
      return;
    }

    // ÉXITO
    mensaje.textContent = 'Usuario Dueño creado. Redirigiendo...';
    mensaje.className = 'msg ok';
    mostrarMensaje?.('Usuario Dueño creado correctamente. Redirigiendo...', 'exito');

    showSuccessOverlay();
    setTimeout(() => { window.location.href = 'login.html'; }, isCoarsePointer ? 1100 : 1400);
  } catch (err) {
    console.error(err);
    mensaje.textContent = 'Error de conexión con el servidor';
    mensaje.className = 'msg error';
    mostrarMensaje?.('Error de conexión con el servidor', 'error');
  } finally {
    // mantenemos loading hasta que termine overlay/redirect
    setTimeout(() => setLoading(false), isCoarsePointer ? 1200 : 1500);
  }
});
