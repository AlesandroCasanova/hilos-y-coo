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

  const inputBusqueda = document.getElementById('busquedaTexto');
  const selectCategoria = document.getElementById('filtroCategoria');
  const btnLimpiar = document.getElementById('btn-limpiar');

  inputBusqueda.addEventListener('input', filtrarCatalogo);
  selectCategoria.addEventListener('change', filtrarCatalogo);
  btnLimpiar.addEventListener('click', limpiarFiltrosCatalogo);

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
    })
    .catch(() => {});
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
    })
    .catch(() => {});
}

// Renderizar catálogo
function renderizarCatalogo(productos) {
  const grid = document.getElementById('gridCatalogo');
  grid.innerHTML = '';
  if (!productos.length) {
    grid.innerHTML = `<div class="empty-grid">No hay productos que coincidan.</div>`;
    return;
  }

  const frag = document.createDocumentFragment();

  productos.forEach(prod => {
    const variantes = inventarioPorProducto[prod.id] || [];

    // Header de tarjeta
    const imgSrc = prod.imagen
      ? `http://localhost:3000/imagenes_productos/${prod.imagen}`
      : 'https://via.placeholder.com/120x120?text=Sin+Imagen';

    const header = `
      <div class="card-header">
        <img src="${imgSrc}" alt="${escapeHtml(prod.nombre || 'Producto')}" />
        <div class="card-title">
          <b>${escapeHtml(prod.nombre)}</b>
          <div class="meta">
            <span>Código: <b>${escapeHtml(prod.codigo || '-')}</b></span>
            <span>Categoría: <b>${escapeHtml(prod.categoria_nombre || prod.categoria || '-')}</b></span>
            <span>Proveedor: <b>${escapeHtml(prod.proveedor_nombre || String(prod.proveedor_id || '-'))}</b></span>
          </div>
        </div>
      </div>
    `;

    // Cuerpo
    const descripcion = prod.descripcion ? `<div class="desc">${escapeHtml(prod.descripcion)}</div>` : '';
    const precio = `<div class="price">$${Number(prod.precio).toLocaleString('es-AR', {minimumFractionDigits: 2})}</div>`;

    // Variantes
    let variantesHTML = '';
    variantes.forEach(v => {
      const yaEnCarrito = carrito.find(item => item.variante_id == v.id);
      const disabled = v.stock == 0 ? 'disabled' : '';
      const stockHtml = v.stock == 0
        ? `<span class="badge-warn">Sin stock</span>`
        : `<span class="var-stock">Stock: ${Number(v.stock)}</span>`;

      variantesHTML += `
        <div class="variante-row">
          <div class="var-attrs">
            <b>Talle:</b> ${escapeHtml(v.talle || '-')}
          </div>
          <div class="var-attrs">
            <b>Color:</b> ${escapeHtml(v.color || '-')}
          </div>
          ${stockHtml}
          <div class="control">
            <input class="cant-input" type="number" id="cant-${v.id}" min="1" max="${Number(v.stock)}" placeholder="Cant." ${disabled}>
          </div>
          <button class="btn ${v.stock == 0 ? 'outline' : ''}" onclick="agregarAlCarrito(${prod.id}, ${v.id}, '${escapeAttr(prod.nombre)}', '${escapeAttr(v.talle)}', '${escapeAttr(v.color)}', ${Number(prod.precio)}, ${Number(v.stock)})" ${disabled}>
            ${yaEnCarrito ? "Agregado" : "Agregar"}
          </button>
        </div>
      `;
    });

    const variantesBlock = `
      <div class="var-block">
        <div class="var-title">Variantes</div>
        <div class="var-list">
          ${variantesHTML || `<span class="text-muted">Sin variantes cargadas</span>`}
        </div>
      </div>
    `;

    const card = document.createElement('article');
    card.className = 'catalogo-card';
    card.innerHTML = header + `<div class="card-body">${precio}${descripcion}${variantesBlock}</div>`;
    frag.appendChild(card);
  });

  grid.appendChild(frag);
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
      (prod.codigo && String(prod.codigo).toLowerCase().includes(texto))
    );
  }
  if (categoria) filtrados = filtrados.filter(prod => (prod.categoria === categoria) || (prod.categoria_nombre === categoria));

  renderizarCatalogo(filtrados);
}

function limpiarFiltrosCatalogo() {
  document.getElementById('busquedaTexto').value = '';
  document.getElementById('filtroCategoria').value = '';
  renderizarCatalogo(productosCatalogo);
}

// Agregar al carrito
window.agregarAlCarrito = function(producto_id, variante_id, nombre, talle, color, precio, stock) {
  const inp = document.getElementById('cant-' + variante_id);
  const cantidad = parseInt(inp?.value);
  if (!cantidad || cantidad < 1 || cantidad > Number(stock)) {
    alert("Cantidad inválida");
    return;
  }
  if (carrito.some(item => item.variante_id == variante_id)) {
    alert("Esa variante ya está en el carrito");
    return;
  }
  carrito.push({ producto_id, variante_id, nombre, talle, color, cantidad, precio });
  localStorage.setItem('carritoVenta', JSON.stringify(carrito));
  actualizarCarritoIcono();
  renderizarCatalogo(productosCatalogo); // Actualiza los botones
};

function actualizarCarritoIcono() {
  const el = document.getElementById('carrito-cantidad');
  if (el) el.textContent = carrito.length;
}

window.irAlCarrito = function() {
  window.location.href = "carrito.html";
};

function cerrarSesion() {
  logout();
}

// Utils
function escapeHtml(str=''){
  return String(str)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#39;');
}
function escapeAttr(str=''){
  return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
