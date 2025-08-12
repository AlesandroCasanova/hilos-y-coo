import {
  obtenerToken,
  fetchConToken,
  mostrarMensaje,
  logout
} from './utils.js';

const API_URL = 'http://localhost:3000/api';

// ===== Guardia de sesión (solo login, sin roles) =====
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
  } catch (e) {
    try { localStorage.removeItem('token'); localStorage.removeItem('usuario'); } catch {}
    alert('Acceso denegado: tu sesión expiró o es inválida. Volvé a iniciar sesión.');
    window.location.href = 'login.html';
    return null;
  }
}
// ================================================

const token = obtenerToken();

let productosCache = [];
let proveedoresCache = {};

document.addEventListener('DOMContentLoaded', async () => {
  const usuario = await validarSesion();
  if (!usuario) return;

  obtenerCategorias();
  obtenerProveedores();
  cargarProductos();

  document.getElementById('formProducto').addEventListener('submit', crearProducto);
  document.getElementById('formEditarProducto').addEventListener('submit', actualizarProducto);
  document.getElementById('formCategoria').addEventListener('submit', crearCategoria);

  // Escuchar cambios en precio_proveedor para sugerir precio
  document.getElementById('precio_proveedor').addEventListener('input', actualizarSugerido);
  document.getElementById('edit-precio_proveedor').addEventListener('input', actualizarSugeridoEdicion);
});

function actualizarSugerido() {
  const valor = parseFloat(document.getElementById('precio_proveedor').value) || 0;
  const sugerido = valor * 1.75;
  document.getElementById('precio_sugerido').textContent = `Sugerido: $${sugerido.toFixed(2)}`;
}

function actualizarSugeridoEdicion() {
  const valor = parseFloat(document.getElementById('edit-precio_proveedor').value) || 0;
  const sugerido = valor * 1.75;
  document.getElementById('edit-precio_sugerido').textContent = `Sugerido: $${sugerido.toFixed(2)}`;
}

function obtenerCategorias() {
  fetch(`${API_URL}/categorias`, {
    headers: { Authorization: `Bearer ${token}` }
  })
    .then(res => res.json())
    .then(categorias => {
      const selects = ['categoria', 'edit-categoria', 'filtro-categoria'];
      selects.forEach(id => {
        const select = document.getElementById(id);
        if (select) {
          select.innerHTML = `<option value="">Seleccione una categoría</option>`;
          categorias.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.nombre;
            option.textContent = cat.nombre;
            select.appendChild(option);
          });
        }
      });
    });
}

function crearCategoria(e) {
  e.preventDefault();
  const nombre = document.getElementById('nombreCategoria').value;

  fetch(`${API_URL}/categorias`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ nombre })
  })
    .then(res => res.json())
    .then(data => {
      alert(data.mensaje || 'Categoría creada');
      document.getElementById('formCategoria').reset();
      document.getElementById('formCategoria').classList.add('hidden');
      obtenerCategorias();
    });
}

function obtenerProveedores() {
  fetch(`${API_URL}/proveedores`, {
    headers: { Authorization: `Bearer ${token}` }
  })
    .then(res => res.json())
    .then(proveedores => {
      proveedoresCache = {};
      proveedores.forEach(p => proveedoresCache[p.id] = p.nombre);

      const selects = ['proveedor', 'edit-proveedor', 'filtro-proveedor'];
      selects.forEach(id => {
        const select = document.getElementById(id);
        if (select) {
          select.innerHTML = `<option value="">Seleccione un proveedor</option>`;
          proveedores.forEach(prov => {
            const option = document.createElement('option');
            option.value = prov.id;
            option.textContent = prov.nombre;
            select.appendChild(option);
          });
        }
      });
    });
}

function cargarProductos() {
  fetch(`${API_URL}/productos`, {
    headers: { Authorization: `Bearer ${token}` }
  })
    .then(res => res.json())
    .then(data => {
      productosCache = data;
      renderizarProductos(data);
      renderizarTabla(data);
    });
}

function renderizarProductos(productos) {
  const contenedor = document.getElementById('productos');
  contenedor.innerHTML = '';

  productos.forEach(prod => {
    const div = document.createElement('div');
    div.className = 'producto-card';
    div.innerHTML = `
      <img 
        src="${prod.imagen ? 'http://localhost:3000/imagenes_productos/' + prod.imagen : 'https://via.placeholder.com/120x120?text=Sin+Imagen'}"
        alt="${prod.nombre}"
        onerror="this.onerror=null;this.src='https://via.placeholder.com/120x120?text=Sin+Imagen';"
        style="max-width:100%;max-height:120px;border-radius:4px;margin-bottom:0.5rem;"
      />
      <h3>${prod.nombre}</h3>
      <p>${prod.descripcion}</p>
      <p><strong>Precio:</strong> $${prod.precio}</p>
      <p><strong>Proveedor:</strong> ${proveedoresCache[prod.proveedor_id] || 'Sin proveedor'}</p>
      <button onclick="mostrarFormularioEdicion(${prod.id})">Editar</button>
      <button onclick="eliminarProducto(${prod.id})">Eliminar</button>
      <button onclick="irAGestionarVariantes(${prod.id})">Gestionar variantes</button>
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
      <td>$${prod.precio}</td>
      <td>
        <button onclick="mostrarFormularioEdicion(${prod.id})">Editar</button>
        <button onclick="eliminarProducto(${prod.id})">Eliminar</button>
        <button onclick="irAGestionarVariantes(${prod.id})">Gestionar variantes</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function crearProducto(e) {
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

  fetch(`${API_URL}/productos`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData
  })
    .then(res => res.json())
    .then(() => {
      e.target.reset();
      cargarProductos();
    });
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
  actualizarSugeridoEdicion();

  document.getElementById('formulario-edicion').style.display = 'block';
  document.getElementById('formulario-producto').style.display = 'none';
}

function cancelarEdicion() {
  document.getElementById('formulario-edicion').style.display = 'none';
  document.getElementById('formulario-producto').style.display = 'block';
}

function actualizarProducto(e) {
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

  fetch(`${API_URL}/productos/${id}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: formData
  })
    .then(res => res.json())
    .then(() => {
      cancelarEdicion();
      cargarProductos();
    });
}

function eliminarProducto(id) {
  if (!confirm('¿Estás seguro de eliminar este producto?')) return;

  fetch(`${API_URL}/productos/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  })
    .then(res => res.json())
    .then(() => cargarProductos());
}

function aplicarFiltros() {
  const categoria = document.getElementById('filtro-categoria').value;
  const proveedor = document.getElementById('filtro-proveedor').value;

  const filtrados = productosCache.filter(p => {
    const catMatch = !categoria || p.categoria === categoria;
    const provMatch = !proveedor || p.proveedor_id == proveedor;
    return catMatch && provMatch;
  });

  renderizarProductos(filtrados);
  renderizarTabla(filtrados);
}

function limpiarFiltros() {
  document.getElementById('filtro-categoria').value = '';
  document.getElementById('filtro-proveedor').value = '';
  renderizarProductos(productosCache);
  renderizarTabla(productosCache);
}

function cerrarSesion() {
  logout();
}

window.cerrarSesion = cerrarSesion;
window.aplicarFiltros = aplicarFiltros;
window.limpiarFiltros = limpiarFiltros;
window.cancelarEdicion = cancelarEdicion;
window.mostrarFormularioEdicion = mostrarFormularioEdicion;
window.eliminarProducto = eliminarProducto;
window.irAGestionarVariantes = (productoId) => {
  window.location.href = `variantes.html?producto_id=${productoId}`;
};

// Modal categoría
function abrirModalCategoria() {
  document.getElementById('modal-categoria').classList.add('active');
}
function cerrarModalCategoria() {
  document.getElementById('modal-categoria').classList.remove('active');
}

window.abrirModalCategoria = abrirModalCategoria;
window.cerrarModalCategoria = cerrarModalCategoria;
