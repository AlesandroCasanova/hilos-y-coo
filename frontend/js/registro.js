import { mostrarMensaje } from './utils.js';

// Si registrás desde otra PC, cambiá localhost por la IP del backend (p.ej. 192.168.0.10)
const API = 'http://localhost:3000/api';

const form = document.getElementById('registroForm');
const mensaje = document.getElementById('mensaje');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const nombre = document.getElementById('nombre').value.trim();
  const email = document.getElementById('email').value.trim();
  const contraseña = document.getElementById('password').value; // la BD usa 'contraseña'
  const rol = (document.getElementById('rol').value || 'duenio').trim(); // enum en tu BD

  if (!nombre || !email || contraseña.length < 6) {
    mensaje.textContent = 'Completá todos los campos (mínimo 6 caracteres de contraseña).';
    mensaje.style.color = 'red';
    mostrarMensaje('Datos inválidos', 'error');
    return;
  }

  try {
    const resp = await fetch(`${API}/usuarios/registro-duenio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, email, contraseña, rol })
    });

    const ct = resp.headers.get('content-type') || '';
    let data;
    if (ct.includes('application/json')) {
      data = await resp.json();
    } else {
      const text = await resp.text();
      throw new Error(text || `Error HTTP ${resp.status}`);
    }

    if (!resp.ok) {
      const msg = data.mensaje || data.error || 'Error al registrar';
      mensaje.textContent = msg;
      mensaje.style.color = 'red';
      mostrarMensaje(msg, 'error');
      return;
    }

    mensaje.style.color = 'green';
    mensaje.textContent = 'Usuario Dueño creado correctamente. Redirigiendo...';
    mostrarMensaje('Usuario Dueño creado correctamente. Redirigiendo...', 'exito');

    setTimeout(() => { window.location.href = 'login.html'; }, 1500);
  } catch (err) {
    console.error(err);
    mensaje.textContent = 'Error de conexión con el servidor';
    mensaje.style.color = 'red';
    mostrarMensaje('Error de conexión con el servidor', 'error');
  }
});
