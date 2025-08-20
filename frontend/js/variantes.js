// js/variantes.js
import {
  obtenerToken,
  logout,
  mostrarMensaje
} from './utils.js';

const API = 'http://localhost:3000/api';
const token = obtenerToken();
let productoActual = null;

/* ===== Sesión mínima ===== */
async function validarSesion() {
  if (!token) {
    alert('Acceso denegado: iniciá sesión para continuar.');
    window.location.href = 'login.html';
    return null;
  }
  try {
    const r = await fetch(`${API}/usuarios/me`, { headers: { Authorization: 'Bearer ' + token } });
    if (!r.ok) throw new Error('no-auth');
    const data = await r.json();
    return data?.usuario || data;
  } catch {
    try { localStorage.removeItem('token'); localStorage.removeItem('usuario'); } catch {}
    alert('Tu sesión expiró o es inválida. Volvé a iniciar sesión.');
    window.location.href = 'login.html';
    return null;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const usr = await validarSesion();
  if (!usr) return;

  // Usuario en topbar (si querés mostrarlo)
  const u = document.getElementById('usuario-logueado');
  if (u) u.textContent = `${usr.nombre || 'Usuario'} (${usr.rol || ''})`;

  // Param producto_id para abrir directo
  const params = new URLSearchParams(window.location.search);
  const producto_id = params.get('producto_id');
  if (producto_id) {
    buscarYMostrarProductoPorId(producto_id);
  } else {
    toggleSeleccion(false);
  }

  // Listeners
  document.getElementById('buscarProductoForm')?.addEventListener('submit', onBuscar);
  document.getElementById('formVariante')?.addEventListener('submit', onAgregarVariante);
  document.getElementById('btn-salir')?.addEventListener('click', (e)=>{ e.preventDefault(); logout(); });
});

/* ===== Búsqueda ===== */
async function onBuscar(e){
  e.preventDefault();
  const id = document.getElementById('buscarId').value.trim();
  const nombre = document.getElementById('buscarNombre').value.trim().toLowerCase();

  try {
    const res = await fetch(`${API}/productos`, { headers: { Authorization: 'Bearer ' + token } });
    let productos = await res.json();

    if (id) productos = productos.filter(p => String(p.id) === id);
    if (nombre) productos = productos.filter(p => (p.nombre || '').toLowerCase().includes(nombre));

    renderResultados(productos);
    if (productos.length === 1) {
      mostrarProductoSeleccionado(productos[0]);
    } else if (productos.length === 0) {
      mostrarMensaje?.('Producto no encontrado', 'error');
    } else {
      mostrarMensaje?.('Se encontraron varios resultados. Elegí uno.', 'info');
    }
  } catch (err) {
    console.error(err);
    mostrarMensaje?.('Error al buscar productos', 'error');
  }
}

function renderResultados(productos){
  const box = document.getElementById('resultados');
  if (!box) return;
  box.innerHTML = '';
  if (!productos || productos.length <= 1) { box.classList.add('hidden'); return; }

  box.classList.remove('hidden');
  const list = document.createElement('div');
  list.className = 'resultados-list';

  productos.forEach(p => {
    const item = document.createElement('div');
    item.className = 'resultado-item';
    const prov = p.proveedor_nombre || p.proveedor_id || '-';
    item.innerHTML = `
      <div>
        <strong>#${p.id}</strong> — ${p.nombre}
        <div class="meta">Código: ${p.codigo || '-'} · Cat: ${p.categoria || '-'} · Prov: ${prov}</div>
      </div>
      <button class="btn ghost sm">Seleccionar</button>
    `;
    item.addEventListener('click', () => mostrarProductoSeleccionado(p));
    list.appendChild(item);
  });

  box.appendChild(list);
}

/* ===== Cargar por ID directo ===== */
async function buscarYMostrarProductoPorId(id) {
  try {
    const res = await fetch(`${API}/productos/${id}`, { headers: { Authorization: 'Bearer ' + token } });
    const prod = await res.json();
    if (prod && prod.id) {
      mostrarProductoSeleccionado(prod);
    } else {
      mostrarMensaje?.('Producto no encontrado', 'error');
      volverABuscar();
    }
  } catch (err) {
    console.error(err);
    mostrarMensaje?.('Error al cargar producto', 'error');
  }
}

/* ===== UI de selección ===== */
function toggleSeleccion(mostrar){
  document.getElementById('producto-seleccionado').style.display = mostrar ? '' : 'none';
  document.getElementById('buscarProductoForm').style.display = mostrar ? 'none' : '';
  if (!mostrar) {
    const box = document.getElementById('resultados'); 
    if (box) { box.innerHTML = ''; box.classList.add('hidden'); }
  }
}

function mostrarProductoSeleccionado(producto) {
  productoActual = producto;
  toggleSeleccion(true);

  const imagenUrl = producto.imagen
    ? `http://localhost:3000/imagenes_productos/${producto.imagen}`
    : 'https://via.placeholder.com/80x80?text=Sin+Imagen';

  document.getElementById('infoProducto').innerHTML = `
    <div class="info-producto-variante">
      <img src="${imagenUrl}" alt="${producto.nombre}">
      <div>
        <b>Nombre:</b> ${producto.nombre}<br>
        <b>Categoría:</b> ${producto.categoria_nombre || producto.categoria || '-'}<br>
        <b>Proveedor:</b> ${producto.proveedor_nombre || producto.proveedor_id || '-'}<br>
        <b>Código interno:</b> ${producto.codigo || '-'}<br>
        <b>Precio:</b> $${Number(producto.precio).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
      </div>
    </div>
  `;
  document.getElementById('productoIdVariante').value = producto.id;
  cargarVariantes(producto.id);
}

function volverABuscar() {
  toggleSeleccion(false);
  productoActual = null;
  document.getElementById('tabla-variantes').innerHTML = '';
}
window.volverABuscar = volverABuscar;

/* ===== Variantes ===== */
function cargarVariantes(productoId) {
  fetch(`${API}/variantes/${productoId}`, { headers: { Authorization: 'Bearer ' + token } })
    .then(res => res.json())
    .then(variantes => {
      const tbody = document.getElementById('tabla-variantes');
      tbody.innerHTML = '';
      variantes.forEach(v => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${v.id}</td>
          <td>${v.talle || '-'}</td>
          <td>${v.color || '-'}</td>
          <td>
            <input class="inline-number" type="number" min="0" value="${v.stock}" 
              onchange="editarStockVariante(${v.id}, this.value, ${productoId})">
          </td>
          <td class="actions">
            <button class="btn ghost sm" onclick="editarStockVariante(${v.id}, document.querySelector('[onchange^=\\'editarStockVariante(${v.id}\\']').value, ${productoId})">Guardar</button>
            <button class="btn warn sm" onclick="eliminarVariante(${v.id}, ${productoId})">Eliminar</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    })
    .catch(() => mostrarMensaje?.('Error al cargar variantes', 'error'));
}

async function onAgregarVariante(e){
  e.preventDefault();
  const producto_id = document.getElementById('productoIdVariante').value;
  const talle = document.getElementById('talle').value.trim();
  const color = document.getElementById('color').value.trim();
  const stock = document.getElementById('stock').value;

  try {
    await fetch(`${API}/variantes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ producto_id, talle, color, stock })
    });
    mostrarMensaje?.('Variante agregada', 'exito');
    e.target.reset();
    cargarVariantes(producto_id);
  } catch (err) {
    console.error(err);
    mostrarMensaje?.('Error al agregar variante', 'error');
  }
}

// Editar stock directamente
window.editarStockVariante = function(idVariante, nuevoStock, productoId) {
  fetch(`${API}/variantes/${idVariante}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ stock: Number(nuevoStock) })
  })
    .then(() => { mostrarMensaje?.('Stock actualizado', 'exito'); cargarVariantes(productoId); })
    .catch(() => mostrarMensaje?.('No se pudo actualizar el stock', 'error'));
};

window.eliminarVariante = function(idVariante, productoId) {
  if (!confirm('¿Eliminar variante?')) return;
  fetch(`${API}/variantes/${idVariante}`, {
    method: 'DELETE',
    headers: { Authorization: 'Bearer ' + token }
  })
    .then(() => { mostrarMensaje?.('Variante eliminada', 'exito'); cargarVariantes(productoId); })
    .catch(() => mostrarMensaje?.('No se pudo eliminar la variante', 'error'));
};

/* ===== Header ===== */
function cerrarSesion() { logout(); }
window.cerrarSesion = cerrarSesion;
