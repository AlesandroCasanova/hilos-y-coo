// js/empleados.js
import {
  obtenerToken,
  fetchConToken, // por si se usa más adelante
  mostrarMensaje,
  logout,
  camposVacios,
  esEmailValido
} from './utils.js';

const API = 'http://localhost:3000/api';

// ---- Headers con token fresco
function authHeaders() {
  const token = obtenerToken();
  return {
    'Content-Type': 'application/json',
    Authorization: 'Bearer ' + token
  };
}

// ---- Normalizar rol
function normalizarRol(rol) {
  return String(rol || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim().toLowerCase();
}
const ROLES_PERMITIDOS = new Set(['duenio', 'dueno']); // sumá 'admin' si corresponde

// ---- Validar sesión (alert + redirect si falla)
async function validarSesion() {
  const token = obtenerToken();
  if (!token) {
    alert('Acceso denegado: iniciá sesión para continuar.');
    window.location.href = 'login.html';
    return null;
  }
  try {
    const res = await fetch(`${API}/usuarios/me`, { headers: authHeaders() });
    if (!res.ok) throw new Error('no-auth');
    const data = await res.json();
    return data.usuario;
  } catch (e) {
    try { localStorage.removeItem('token'); localStorage.removeItem('usuario'); } catch {}
    alert('Acceso denegado: tu sesión expiró o es inválida. Volvé a iniciar sesión.');
    window.location.href = 'login.html';
    return null;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const usuario = await validarSesion();
  if (!usuario) return;

  // Topbar: user y logout
  const spanUsuario = document.getElementById('usuario-logueado');
  if (spanUsuario) spanUsuario.textContent = `${usuario.nombre} (${usuario.rol})`;
  const btnLogout = document.getElementById('btn-logout');
  btnLogout?.addEventListener('click', logout);

  // Solo Dueño
  const rolNorm = normalizarRol(usuario.rol);
  if (!ROLES_PERMITIDOS.has(rolNorm)) {
    alert('Acceso denegado: esta sección es solo para el Dueño.');
    window.location.href = 'dashboard.html';
    return;
  }

  const tabla = document.querySelector('#tablaEmpleados tbody');
  const form = document.getElementById('formEmpleado');

  // Cargar empleados existentes
  try {
    const res = await fetch(`${API}/usuarios`, { headers: authHeaders() });
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        alert('Tu sesión no es válida. Iniciá sesión nuevamente.');
        window.location.href = 'login.html';
        return;
      }
      throw new Error('Error al cargar empleados');
    }
    const data = await res.json();
    tabla.innerHTML = '';
    data.forEach(empleado => {
      const fila = document.createElement('tr');
      fila.innerHTML = `
        <td>${empleado.id}</td>
        <td>${empleado.nombre}</td>
        <td>${empleado.email}</td>
        <td>${empleado.rol}</td>
      `;
      tabla.appendChild(fila);
    });
  } catch (error) {
    console.error('Error al cargar empleados:', error);
  }

  // Registrar nuevo empleado
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const fd = new FormData(form);
    const nombre   = (fd.get('nombre') || '').trim();
    const email    = (fd.get('email') || '').trim();

    // Aceptamos cualquiera de los names y consolidamos
    const passField =
      (fd.get('password') || fd.get('contrasena') || fd.get('contraseña') || '').trim();

    if (!nombre || !email || !passField) {
      alert('Completá nombre, email y contraseña.');
      return;
    }
    if (typeof esEmailValido === 'function' && !esEmailValido(email)) {
      alert('Email inválido.');
      return;
    }

    // Payload compatible: mandamos TODAS las variantes de clave
    const payload = {
      nombre,
      email,
      password: passField,        // algunos backends aceptan "password"
      contrasena: passField,      // otros "contrasena" (sin tilde)
      ['contraseña']: passField,  // y otros "contraseña" (con tilde)
      rol: 'empleado'             // en minúsculas
    };

    try {
      const res = await fetch(`${API}/usuarios`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.mensaje || data?.error || 'Todos los campos son obligatorios.');
      }

      alert('Empleado registrado correctamente');
      location.reload();
    } catch (err) {
      console.error(err);
      alert('Error: ' + err.message);
    }
  });
});

// Exponer logout si se usa desde HTML en otras vistas
window.cerrarSesion = logout;
