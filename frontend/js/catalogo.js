import {
  obtenerToken,
  fetchConToken,
  mostrarMensaje,
  logout
} from './utils.js';

const API = 'http://localhost:3000/api';
const token = obtenerToken();

// ===== Guardia de sesión (solo login, sin roles) =====
async function validarSesion() {
  const tk = obtenerToken();
  if (!tk) {
    alert('Acceso denegado: iniciá sesión para continuar.');
    window.location.href = 'login.html';
    return null;
  }
  try {
    const r = await fetch(`${API}/usuarios/me`, { headers: { Authorization: 'Bearer ' + tk } });
    if (!r.ok) throw new Error('no-auth');
    const data = await r.json();
    window.__USER__ = data?.usuario || data;
    return window.__USER__;
  } catch (e) {
    try { localStorage.removeItem('token'); localStorage.removeItem('usuario'); } catch {}
    alert('Acceso denegado: tu sesión expiró o es inválida. Volvé a iniciar sesión.');
    window.location.href = 'login.html';
    return null;
  }
}
// ================================================

let productosCatalogo = [];
let inventarioPorProducto = {};
let carrito = JSON.parse(localStorage.getItem('carritoVenta')) || [];

// Inicialización
document.addEventListener('DOMContentLoaded', async () => {
  const usuario = await validarSesion();
  if (!usuario) return;

  cargarCategoriasCatalogo();
  cargarCatalogo();
  document.getElementById('busquedaTexto').addEventListener('input', filtrarCatalogo);
  document.getElementById('filtroCategoria').addEventListener('change', filtrarCatalogo);
  actualizarCarritoIcono();
});

// Cargar categorías
function cargarCategoriasCatalogo() {
  fetch(`${API}/categorias`, { headers: { Authorization: `Bearer ${token}` } })
    .then(res => res.json())
    .then(categorias => {
      const select = document.getElementById('filtroCategoria');
      categorias.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.nombre;
        option.textContent = cat.nombre;
        select.appendChild(option);
      });
    });
}

// Cargar productos (y variantes para stock/talles/colores)
function cargarCatalogo() {
  fetch(`${API}/productos`, { headers: { Authorization: `Bearer ${token}` } })
    .then(res => res.json())
    .then(async productos => {
      productosCatalogo = productos;
      inventarioPorProducto = {};
      await Promise.all(productos.map(async prod => {
        const res = await fetch(`${API}/variantes/${prod.id}`, { headers: { Authorization: `Bearer ${token}` } });
        inventarioPorProducto[prod.id] = await res.json();
      }));
      renderizarCatalogo(productosCatalogo);
    });
}

// Renderizar catálogo
function renderizarCatalogo(productos) {
  const grid = document.getElementById('gridCatalogo');
  grid.innerHTML = '';
  if (!productos.length) {
    grid.innerHTML = '<div style="grid-column:1/-1;color:#888;padding:2em;">No hay productos que coincidan.</div>';
    return;
  }
  productos.forEach(prod => {
    const variantes = inventarioPorProducto[prod.id] || [];
    let variantesHTML = '';
    variantes.forEach(v => {
      const yaEnCarrito = carrito.find(item => item.variante_id == v.id);
      variantesHTML += `
        <div class="variante-row">
          <b>Talle:</b> ${v.talle} &nbsp;
          <b>Color:</b> ${v.color} &nbsp;
          <b>Stock:</b> ${v.stock} &nbsp;
          <input type="number" id="cant-${v.id}" min="1" max="${v.stock}" placeholder="Cant." style="width:55px" ${v.stock == 0 ? "disabled" : ""}>
          <button onclick="agregarAlCarrito(${prod.id}, ${v.id}, '${prod.nombre.replace(/'/g, "\\'")}', '${v.talle}', '${v.color}', ${prod.precio}, ${v.stock})" ${v.stock == 0 ? "disabled" : ""}>
            ${yaEnCarrito ? "Agregado" : "Agregar"}
          </button>
        </div>
      `;
    });
    grid.innerHTML += `
      <div class="catalogo-card">
        <img src="${prod.imagen ? 'http://localhost:3000/imagenes_productos/' + prod.imagen : 'https://via.placeholder.com/120x120?text=Sin+Imagen'}" alt="${prod.nombre}" />
        <div><b>${prod.nombre}</b></div>
        <div><small>Código:</small> <b>${prod.codigo}</b></div>
        <div><small>Categoría:</small> <b>${prod.categoria_nombre || prod.categoria || '-'}</b></div>
        <div><small>Proveedor:</small> <b>${prod.proveedor_nombre || prod.proveedor_id || '-'}</b></div>
        <div><small>Precio:</small> <b>$${Number(prod.precio).toLocaleString('es-AR', {minimumFractionDigits: 2})}</b></div>
        <div><small>Descripción:</small> <span style="color:#333">${prod.descripcion}</span></div>
        <div><b>Variantes:</b></div>
        ${variantesHTML || '<span style="color:#a33">Sin variantes cargadas</span>'}
      </div>
    `;
  });
}

// Filtros rápidos
function filtrarCatalogo() {
  const texto = document.getElementById('busquedaTexto').value.trim().toLowerCase();
  const categoria = document.getElementById('filtroCategoria').value;
  let filtrados = productosCatalogo;
  if (texto) {
    filtrados = filtrados.filter(prod =>
      (prod.nombre && prod.nombre.toLowerCase().includes(texto)) ||
      (prod.descripcion && prod.descripcion.toLowerCase().includes(texto)) ||
      (prod.codigo && prod.codigo.toLowerCase().includes(texto))
    );
  }
  if (categoria) filtrados = filtrados.filter(prod => prod.categoria === categoria);
  renderizarCatalogo(filtrados);
}

function limpiarFiltrosCatalogo() {
  document.getElementById('busquedaTexto').value = '';
  document.getElementById('filtroCategoria').value = '';
  renderizarCatalogo(productosCatalogo);
}

// Agregar al carrito
window.agregarAlCarrito = function(producto_id, variante_id, nombre, talle, color, precio, stock) {
  const cantidad = parseInt(document.getElementById('cant-' + variante_id).value);
  if (!cantidad || cantidad < 1 || cantidad > stock) {
    alert("Cantidad inválida");
    return;
  }
  if (carrito.some(item => item.variante_id == variante_id)) {
    alert("Esa variante ya está en el carrito");
    return;
  }
  carrito.push({
    producto_id, variante_id, nombre, talle, color, cantidad, precio
  });
  localStorage.setItem('carritoVenta', JSON.stringify(carrito));
  actualizarCarritoIcono();
  renderizarCatalogo(productosCatalogo); // Actualiza los botones
}

function actualizarCarritoIcono() {
  document.getElementById('carrito-cantidad').textContent = carrito.length;
}

window.irAlCarrito = function() {
  window.location.href = "carrito.html";
}

function cerrarSesion() {
  logout();
}
