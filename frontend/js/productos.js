import {
  obtenerToken,
  logout
} from './utils.js';

const API_URL = 'http://localhost:3000/api';

/* 90% de margen → multiplicador 1.90 */
const MARGEN_SUGERIDO = 1.90;

const token = obtenerToken();
let productosCache = [];
let proveedoresCache = {};

/* ================== Sesión ================== */
async function validarSesion() {
  const tk = obtenerToken();
  if (!tk) {
    alert('Acceso denegado: iniciá sesión para continuar.');
    window.location.href = 'login.html';
    return null;
  }
  try {
    const r = await fetch(`${API_URL}/usuarios/me`, { headers: { Authorization: 'Bearer ' + tk } });
    if (!r.ok) throw new Error('no-auth');
    const data = await r.json();
    window.__USER__ = data?.usuario || data;
    return window.__USER__;
  } catch {
    try { localStorage.removeItem('token'); localStorage.removeItem('usuario'); } catch {}
    alert('Acceso denegado: tu sesión expiró o es inválida. Volvé a iniciar sesión.');
    window.location.href = 'login.html';
    return null;
  }
}

/* ================== Init ================== */
document.addEventListener('DOMContentLoaded', async () => {
  const usuario = await validarSesion();
  if (!usuario) return;

  // Topbar user
  const u = document.getElementById('usuario-logueado');
  if (u) u.textContent = `${usuario.nombre || 'Usuario'} (${usuario.rol || ''})`;

  // Cargas iniciales
  await obtenerCategorias();
  await obtenerProveedores();
  await cargarProductos();

  // Eventos modales
  document.getElementById('btn-nuevo-producto')?.addEventListener('click', abrirModalProducto);
  document.getElementById('close-modal-producto')?.addEventListener('click', cerrarModalProducto);

  // Formularios
  document.getElementById('formProducto')?.addEventListener('submit', crearProducto);
  document.getElementById('formEditarProducto')?.addEventListener('submit', actualizarProducto);
  document.getElementById('formCategoria')?.addEventListener('submit', crearCategoria);
  document.getElementById('formProveedorNuevo')?.addEventListener('submit', crearProveedor);

  // Sugerido 90%
  document.getElementById('precio_proveedor')?.addEventListener('input', actualizarSugerido);
  document.getElementById('edit-precio_proveedor')?.addEventListener('input', actualizarSugeridoEdicion);

  // File names visibles
  const inNuevo = document.getElementById('imagen');
  const lblNuevo = document.getElementById('imagen-nombre');
  inNuevo?.addEventListener('change', () => {
    const f = inNuevo.files?.[0];
    lblNuevo.textContent = f ? f.name : 'Ningún archivo seleccionado';
  });
  const inEdit = document.getElementById('edit-imagen');
  const lblEdit = document.getElementById('edit-imagen-nombre');
  inEdit?.addEventListener('change', () => {
    const f = inEdit.files?.[0];
    lblEdit.textContent = f ? f.name : 'Ningún archivo seleccionado';
  });

  // Buscador y filtros avanzados
  document.getElementById('buscador')?.addEventListener('input', filtrarYRenderizar);
  ['filtro-categoria','filtro-proveedor','filtro-precio-min','filtro-precio-max','filtro-con-imagen','ordenar']
    .forEach(id => document.getElementById(id)?.addEventListener('change', filtrarYRenderizar));
  document.getElementById('btn-aplicar')?.addEventListener('click', filtrarYRenderizar);
  document.getElementById('btn-limpiar')?.addEventListener('click', limpiarFiltros);

  // Topbar acciones
  document.getElementById('btn-salir')?.addEventListener('click', (e) => { e.preventDefault(); logout(); });
});

/* ================== Utiles ================== */
function precioSugeridoDesdeCosto(costo){ return Number(costo || 0) * MARGEN_SUGERIDO; }
function actualizarSugerido() {
  const valor = parseFloat(document.getElementById('precio_proveedor').value) || 0;
  document.getElementById('precio_sugerido').textContent = `Sugerido (90%): $${precioSugeridoDesdeCosto(valor).toFixed(2)}`;
}
function actualizarSugeridoEdicion() {
  const valor = parseFloat(document.getElementById('edit-precio_proveedor').value) || 0;
  document.getElementById('edit-precio_sugerido').textContent = `Sugerido (90%): $${precioSugeridoDesdeCosto(valor).toFixed(2)}`;
}

/* ================== Data ================== */
async function obtenerCategorias() {
  const res = await fetch(`${API_URL}/categorias`, { headers: { Authorization: `Bearer ${token}` } });
  const categorias = await res.json();

  const selects = ['categoria', 'edit-categoria', 'filtro-categoria'];
  selects.forEach(id => {
    const select = document.getElementById(id);
    if (!select) return;
    const base = id.startsWith('filtro') ? 'Todas las categorías' : 'Seleccione una categoría';
    select.innerHTML = `<option value="">${base}</option>`;
    categorias.forEach(cat => {
      const o = document.createElement('option');
      o.value = cat.nombre; o.textContent = cat.nombre;
      select.appendChild(o);
    });
  });
}

async function obtenerProveedores() {
  const res = await fetch(`${API_URL}/proveedores`, { headers: { Authorization: `Bearer ${token}` } });
  const proveedores = await res.json();

  proveedoresCache = {};
  proveedores.forEach(p => proveedoresCache[p.id] = p.nombre);

  const selects = ['proveedor', 'edit-proveedor', 'filtro-proveedor'];
  selects.forEach(id => {
    const select = document.getElementById(id);
    if (!select) return;
    const base = id.startsWith('filtro') ? 'Todos los proveedores' : 'Seleccione un proveedor';
    select.innerHTML = `<option value="">${base}</option>`;
    proveedores.forEach(prov => {
      const o = document.createElement('option');
      o.value = prov.id; o.textContent = prov.nombre;
      select.appendChild(o);
    });
  });
}

async function cargarProductos() {
  const res = await fetch(`${API_URL}/productos`, { headers: { Authorization: `Bearer ${token}` } });
  productosCache = await res.json();
  filtrarYRenderizar(); // render con filtros actuales
}

/* ================== CRUD ================== */
async function crearCategoria(e) {
  e.preventDefault();
  const nombre = document.getElementById('nombreCategoria').value;
  const res = await fetch(`${API_URL}/categorias`, {
    method: 'POST',
    headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ nombre })
  });
  await res.json();
  document.getElementById('formCategoria').reset();
  document.getElementById('modal-categoria').classList.remove('active');
  obtenerCategorias();
}

async function crearProveedor(e){
  e.preventDefault();
  const nombre = document.getElementById('nombreProveedorNuevo').value;
  const res = await fetch(`${API_URL}/proveedores`, {
    method: 'POST',
    headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ nombre })
  });
  await res.json();
  document.getElementById('formProveedorNuevo').reset();
  document.getElementById('modal-proveedor').classList.remove('active');
  obtenerProveedores();
}

async function crearProducto(e) {
  e.preventDefault();
  const formData = new FormData();
  formData.append('nombre', document.getElementById('nombre').value);
  formData.append('descripcion', document.getElementById('descripcion').value);
  formData.append('codigo', document.getElementById('codigo').value);
  formData.append('categoria', document.getElementById('categoria').value);
  formData.append('proveedor_id', document.getElementById('proveedor').value);
  formData.append('precio_proveedor', document.getElementById('precio_proveedor').value);
  formData.append('precio', document.getElementById('precio').value);
  const imagen = document.getElementById('imagen').files[0];
  if (imagen) formData.append('imagen', imagen);

  await fetch(`${API_URL}/productos`, { method:'POST', headers:{ Authorization: `Bearer ${token}` }, body: formData });
  e.target.reset();
  const lbl = document.getElementById('imagen-nombre'); if (lbl) lbl.textContent = 'Ningún archivo seleccionado';
  cerrarModalProducto();
  await cargarProductos();
}

function mostrarFormularioEdicion(id) {
  const producto = productosCache.find(p => p.id === id);
  if (!producto) return;

  document.getElementById('edit-id').value = producto.id;
  document.getElementById('edit-nombre').value = producto.nombre;
  document.getElementById('edit-descripcion').value = producto.descripcion;
  document.getElementById('edit-codigo').value = producto.codigo;
  document.getElementById('edit-categoria').value = producto.categoria;
  document.getElementById('edit-proveedor').value = producto.proveedor_id;
  document.getElementById('edit-precio_proveedor').value = producto.precio_proveedor;
  document.getElementById('edit-precio').value = producto.precio;
  document.getElementById('edit-imagen-nombre').textContent = 'Ningún archivo seleccionado';
  actualizarSugeridoEdicion();

  document.getElementById('formulario-edicion').style.display = 'block';
}

function cancelarEdicion() {
  document.getElementById('formulario-edicion').style.display = 'none';
}

async function actualizarProducto(e) {
  e.preventDefault();
  const id = document.getElementById('edit-id').value;
  const formData = new FormData();
  formData.append('nombre', document.getElementById('edit-nombre').value);
  formData.append('descripcion', document.getElementById('edit-descripcion').value);
  formData.append('codigo', document.getElementById('edit-codigo').value);
  formData.append('categoria', document.getElementById('edit-categoria').value);
  formData.append('proveedor_id', document.getElementById('edit-proveedor').value);
  formData.append('precio_proveedor', document.getElementById('edit-precio_proveedor').value);
  formData.append('precio', document.getElementById('edit-precio').value);
  const imagen = document.getElementById('edit-imagen').files[0];
  if (imagen) formData.append('imagen', imagen);

  await fetch(`${API_URL}/productos/${id}`, { method:'PUT', headers:{ Authorization: `Bearer ${token}` }, body: formData });
  cancelarEdicion();
  await cargarProductos();
}

async function eliminarProducto(id) {
  if (!confirm('¿Estás seguro de eliminar este producto?')) return;
  await fetch(`${API_URL}/productos/${id}`, { method:'DELETE', headers:{ Authorization: `Bearer ${token}` } });
  await cargarProductos();
}

/* ================== Render ================== */
function renderizarProductos(productos) {
  const contenedor = document.getElementById('productos');
  contenedor.innerHTML = '';

  productos.forEach(prod => {
    const div = document.createElement('div');
    div.className = 'producto-card';
    div.innerHTML = `
      <img 
        src="${prod.imagen ? 'http://localhost:3000/imagenes_productos/' + prod.imagen : 'https://via.placeholder.com/240x140?text=Sin+Imagen'}"
        alt="${prod.nombre}"
        onerror="this.onerror=null;this.src='https://via.placeholder.com/240x140?text=Sin+Imagen';"
      />
      <h3>${prod.nombre}</h3>
      <p>${prod.descripcion}</p>
      <p><strong>Precio:</strong> $${Number(prod.precio).toFixed(2)}</p>
      <p><strong>Proveedor:</strong> ${proveedoresCache[prod.proveedor_id] || 'Sin proveedor'}</p>
      <button class="btn ghost" onclick="mostrarFormularioEdicion(${prod.id})">Editar</button>
      <button class="btn warn" onclick="eliminarProducto(${prod.id})">Eliminar</button>
      <button class="btn primary" onclick="irAGestionarVariantes(${prod.id})">Gestionar variantes</button>
    `;
    contenedor.appendChild(div);
  });
}

function renderizarTabla(productos) {
  const tbody = document.getElementById('tabla-body');
  tbody.innerHTML = '';
  productos.forEach(prod => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${prod.id}</td>
      <td>${prod.nombre}</td>
      <td>${prod.codigo}</td>
      <td>${prod.categoria}</td>
      <td>${proveedoresCache[prod.proveedor_id] || 'Sin proveedor'}</td>
      <td>$${Number(prod.precio).toFixed(2)}</td>
      <td>
        <button class="btn ghost sm" onclick="mostrarFormularioEdicion(${prod.id})">Editar</button>
        <button class="btn warn  sm" onclick="eliminarProducto(${prod.id})">Eliminar</button>
        <button class="btn primary sm" onclick="irAGestionarVariantes(${prod.id})">Variantes</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/* ================== Filtros avanzados ================== */
function filtrarYRenderizar(){
  const q = (document.getElementById('buscador')?.value || '').toLowerCase().trim();
  const cat = document.getElementById('filtro-categoria')?.value || '';
  const prov = document.getElementById('filtro-proveedor')?.value || '';
  const pmin = parseFloat(document.getElementById('filtro-precio-min')?.value) || null;
  const pmax = parseFloat(document.getElementById('filtro-precio-max')?.value) || null;
  const conImg = document.getElementById('filtro-con-imagen')?.checked || false;
  const ordenar = document.getElementById('ordenar')?.value || 'nombre_asc';

  let lista = productosCache.filter(p => {
    const texto = `${p.nombre} ${p.descripcion} ${p.codigo}`.toLowerCase();
    const okQ = !q || texto.includes(q);
    const okCat = !cat || p.categoria === cat;
    const okProv = !prov || String(p.proveedor_id) === String(prov);
    const precio = Number(p.precio);
    const okMin = pmin === null || precio >= pmin;
    const okMax = pmax === null || precio <= pmax;
    const okImg = !conImg || !!p.imagen;
    return okQ && okCat && okProv && okMin && okMax && okImg;
  });

  // Orden
  lista.sort((a,b) => {
    switch(ordenar){
      case 'precio_asc': return Number(a.precio) - Number(b.precio);
      case 'precio_desc': return Number(b.precio) - Number(a.precio);
      case 'nombre_desc': return a.nombre.localeCompare(b.nombre) * -1;
      default: return a.nombre.localeCompare(b.nombre); // nombre_asc
    }
  });

  renderizarProductos(lista);
  renderizarTabla(lista);
}

function limpiarFiltros(){
  ['buscador','filtro-categoria','filtro-proveedor','filtro-precio-min','filtro-precio-max','ordenar']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const chk = document.getElementById('filtro-con-imagen'); if (chk) chk.checked = false;
  filtrarYRenderizar();
}

/* ================== Modales ================== */
function abrirModalProducto(){ document.getElementById('modal-producto')?.classList.add('active'); }
function cerrarModalProducto(){ document.getElementById('modal-producto')?.classList.remove('active'); }
function abrirModalCategoria(){ document.getElementById('modal-categoria')?.classList.add('active'); }
function cerrarModalCategoria(){ document.getElementById('modal-categoria')?.classList.remove('active'); }
function abrirModalProveedor(){ document.getElementById('modal-proveedor')?.classList.add('active'); }
function cerrarModalProveedor(){ document.getElementById('modal-proveedor')?.classList.remove('active'); }

/* ================== Expose ================== */
window.cerrarSesion = () => logout();
window.aplicarFiltros = filtrarYRenderizar;
window.limpiarFiltros = limpiarFiltros;
window.cancelarEdicion = cancelarEdicion;
window.mostrarFormularioEdicion = mostrarFormularioEdicion;
window.eliminarProducto = eliminarProducto;
window.irAGestionarVariantes = (productoId) => { window.location.href = `variantes.html?producto_id=${productoId}`; };
window.abrirModalCategoria = abrirModalCategoria;
window.cerrarModalCategoria = cerrarModalCategoria;
window.abrirModalProveedor = abrirModalProveedor;
window.cerrarModalProveedor = cerrarModalProveedor;
