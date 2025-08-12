// js/empleados.js
import {
  obtenerToken,
  fetchConToken, // si lo usás en otro lado, lo dejamos importado
  mostrarMensaje,
  logout,
  camposVacios,
  esEmailValido
} from './utils.js';

const API = 'http://localhost:3000/api';

// --- Headers con token fresco
function authHeaders() {
  const token = obtenerToken();
  return {
    'Content-Type': 'application/json',
    Authorization: 'Bearer ' + token
  };
}

// --- Normalizar rol
function normalizarRol(rol) {
  return String(rol || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim().toLowerCase();
}
const ROLES_PERMITIDOS = new Set(['duenio', 'dueno']); // sumá 'admin' si corresponde

// --- Validar sesión con alert
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

    const formData = new FormData(form);
    const empleado = {
      nombre: formData.get('nombre'),
      email: formData.get('email'),
      contraseña: formData.get('contraseña'),
      rol: 'Empleado'
    };

    try {
      const res = await fetch(`${API}/usuarios`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(empleado)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.mensaje || 'Error al registrar empleado');

      alert('Empleado registrado correctamente');
      location.reload();
    } catch (err) {
      console.error(err);
      alert('Error: ' + err.message);
    }
  });
});

// Exponer logout si lo usás desde HTML
window.cerrarSesion = logout;
