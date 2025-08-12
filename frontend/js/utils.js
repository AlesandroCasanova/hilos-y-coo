// frontend/js/utils.js
// Archivo de utilidades centralizadas para Hilos y Coo

export const API = 'http://localhost:3000/api';

//---------------------------------------------
// 1. Storage: token y usuario
//---------------------------------------------
export function guardarToken(token) {
  localStorage.setItem('token', token);
}
export function obtenerToken() {
  return localStorage.getItem('token');
}
export function guardarUsuario(usuario) {
  localStorage.setItem('usuario', JSON.stringify(usuario || {}));
}
export function obtenerUsuario() {
  try {
    const raw = localStorage.getItem('usuario');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
export function limpiarSesion() {
  localStorage.removeItem('token');
  localStorage.removeItem('usuario');
}

//---------------------------------------------
// 2. Fetch con token JWT automáticamente
//---------------------------------------------
export async function fetchConToken(url, options = {}) {
  const token = obtenerToken();
  options.headers = options.headers || {};
  if (token) options.headers['Authorization'] = 'Bearer ' + token;
  return fetch(url, options);
}

//---------------------------------------------
// 3. Verificación de usuario y protección de vistas
//---------------------------------------------
/**
 * Llama a /api/usuarios/me para validar el token y traer el usuario.
 * Si es válido, actualiza localStorage y devuelve el usuario.
 * Si no, limpia la sesión y devuelve null.
 */
export async function verificarUsuario() {
  const token = obtenerToken();
  if (!token) return null;
  try {
    const res = await fetch(`${API}/usuarios/me`, {
      headers: { Authorization: 'Bearer ' + token }
    });
    if (!res.ok) throw new Error('Token inválido o expirado');
    const data = await res.json();
    guardarUsuario(data.usuario);
    return data.usuario;
  } catch (err) {
    limpiarSesion();
    return null;
  }
}

/**
 * Protege una vista: si no hay sesión válida, redirige al login.
 * Retorna el usuario si está autenticado.
 */
export async function protegerVista({ redireccion = 'login.html' } = {}) {
  const usuario = await verificarUsuario();
  if (!usuario) {
    window.location.href = redireccion;
    return null;
  }
  return usuario;
}

//---------------------------------------------
// 4. Mostrar mensajes (éxito/error/info)
export function mostrarMensaje(mensaje, tipo = "info") {
  // Crea o reutiliza un contenedor de mensajes flotante
  let cont = document.getElementById("mensaje-flotante");
  if (!cont) {
    cont = document.createElement("div");
    cont.id = "mensaje-flotante";
    cont.style.position = "fixed";
    cont.style.top = "20px";
    cont.style.right = "20px";
    cont.style.zIndex = "9999";
    cont.style.minWidth = "180px";
    cont.style.padding = "15px 20px";
    cont.style.borderRadius = "8px";
    cont.style.fontWeight = "bold";
    cont.style.color = "#fff";
    cont.style.boxShadow = "0 2px 10px rgba(0,0,0,0.2)";
    document.body.appendChild(cont);
  }
  if (tipo === "exito") cont.style.background = "#43a047";
  else if (tipo === "error") cont.style.background = "#e53935";
  else cont.style.background = "#1e88e5";

  cont.textContent = mensaje;
  cont.style.display = "block";
  setTimeout(() => { cont.style.display = "none"; }, 2400);
}

//---------------------------------------------
// 5. Logout global: chequea estado de caja antes de salir
//---------------------------------------------
export async function logout() {
  const token = obtenerToken();
  try {
    // Consultar estado de caja física
    const res = await fetch(`${API}/caja/estado/fisica`, {
      headers: { Authorization: 'Bearer ' + token }
    });
    const data = await res.json();

    // Si está abierta, NO permite logout
    if (data.abierta) {
      mostrarMensaje("Debés cerrar la caja física antes de salir.", "error");
      return;
    }
    // Si está cerrada, limpia y sale
    limpiarSesion();
    window.location.href = "login.html";
  } catch (err) {
    // Si hay error en el servidor, igual permite salir (opcional)
    limpiarSesion();
    window.location.href = "login.html";
  }
}

//---------------------------------------------
// 6. Validaciones comunes de formulario
//---------------------------------------------
export function camposVacios(obj) {
  for (let key in obj) {
    if (!obj[key] || obj[key].toString().trim() === "") return true;
  }
  return false;
}
export function esEmailValido(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

//---------------------------------------------
// 7. Cargar fragmentos HTML comunes (nav, footer, etc.)
export function cargarFragmento(idElemento, urlFragmento) {
  fetch(urlFragmento)
    .then(r => r.text())
    .then(html => document.getElementById(idElemento).innerHTML = html);
}
