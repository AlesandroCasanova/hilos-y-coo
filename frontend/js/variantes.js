import {
  obtenerToken,
  fetchConToken,
  mostrarMensaje,
  logout
} from './utils.js';

const API = 'http://localhost:3000/api';
const token = obtenerToken();
let productoActual = null;

window.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  let producto_id = params.get('producto_id');
  if (producto_id) {
    buscarYMostrarProductoPorId(producto_id);
  } else {
    document.getElementById('producto-seleccionado').style.display = 'none';
    document.getElementById('buscarProductoForm').style.display = '';
  }
});

// Buscador de productos
document.getElementById('buscarProductoForm').onsubmit = async function(e) {
  e.preventDefault();
  const id = document.getElementById('buscarId').value.trim();
  const nombre = document.getElementById('buscarNombre').value.trim().toLowerCase();

  let url = `${API}/productos`;
  const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
  let productos = await res.json();

  if (id) productos = productos.filter(p => String(p.id) === id);
  if (nombre) productos = productos.filter(p => p.nombre && p.nombre.toLowerCase().includes(nombre));

  if (productos.length === 1) {
    mostrarProductoSeleccionado(productos[0]);
  } else if (productos.length > 1) {
    alert('Se encontraron varios productos, refiná la búsqueda.');
  } else {
    alert('Producto no encontrado.');
  }
};

async function buscarYMostrarProductoPorId(id) {
  if (!id) return;
  const res = await fetch(`${API}/productos/${id}`, { headers: { Authorization: 'Bearer ' + token } });
  const prod = await res.json();
  if (prod && prod.id) {
    mostrarProductoSeleccionado(prod);
  } else {
    alert('Producto no encontrado');
    volverABuscar();
  }
}

// Muestra el formulario de variantes para el producto y carga variantes
function mostrarProductoSeleccionado(producto) {
  productoActual = producto;
  document.getElementById('producto-seleccionado').style.display = '';
  document.getElementById('buscarProductoForm').style.display = 'none';

  // USAR LA RUTA CORRECTA PARA IMAGENES
  const imagenUrl = producto.imagen
    ? `http://localhost:3000/imagenes_productos/${producto.imagen}`
    : 'https://via.placeholder.com/80x80?text=Sin+Imagen';

  document.getElementById('infoProducto').innerHTML = `
    <div class="info-producto-variante">
      <img src="${imagenUrl}" alt="${producto.nombre}" style="max-width:80px;max-height:80px;border-radius:4px;margin-right:12px;">
      <div>
        <b>Nombre:</b> ${producto.nombre}<br>
        <b>Categoría:</b> ${producto.categoria_nombre || producto.categoria || '-'}<br>
        <b>Proveedor:</b> ${producto.proveedor_nombre || producto.proveedor_id || '-'}<br>
        <b>Código interno:</b> ${producto.codigo}<br>
        <b>Precio:</b> $${Number(producto.precio).toLocaleString('es-AR', { minimumFractionDigits: 2 })}<br>
        <b>Descripción:</b> ${producto.descripcion}
      </div>
    </div>
  `;
  document.getElementById('productoIdVariante').value = producto.id;

  cargarVariantes(producto.id);
}

// Vuelve al buscador de productos
function volverABuscar() {
  document.getElementById('producto-seleccionado').style.display = 'none';
  document.getElementById('buscarProductoForm').style.display = '';
  productoActual = null;
  document.getElementById('tabla-variantes').innerHTML = '';
}

// Cargar variantes del producto seleccionado
function cargarVariantes(productoId) {
  fetch(`${API}/variantes/${productoId}`, { headers: { Authorization: 'Bearer ' + token } })
    .then(res => res.json())
    .then(variantes => {
      const tbody = document.getElementById('tabla-variantes');
      tbody.innerHTML = '';
      variantes.forEach(v => {
        tbody.innerHTML += `
          <tr>
            <td>${v.id}</td>
            <td>${v.talle}</td>
            <td>${v.color}</td>
            <td>
              <input type="number" min="0" value="${v.stock}" style="width: 60px;" onchange="editarStockVariante(${v.id}, this.value, ${productoId})">
            </td>
            <td>
              <button onclick="eliminarVariante(${v.id}, ${productoId})">Eliminar</button>
            </td>
          </tr>
        `;
      });
    });
}

// Agregar variante
document.getElementById('formVariante').onsubmit = async function(e) {
  e.preventDefault();
  const producto_id = document.getElementById('productoIdVariante').value;
  const talle = document.getElementById('talle').value;
  const color = document.getElementById('color').value;
  const stock = document.getElementById('stock').value;

  await fetch(`${API}/variantes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token
    },
    body: JSON.stringify({ producto_id, talle, color, stock })
  });
  document.getElementById('formVariante').reset();
  cargarVariantes(producto_id);
};

// Editar stock directamente
window.editarStockVariante = function(idVariante, nuevoStock, productoId) {
  fetch(`${API}/variantes/${idVariante}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token
    },
    body: JSON.stringify({ stock: nuevoStock })
  })
    .then(() => cargarVariantes(productoId));
};

window.eliminarVariante = function(idVariante, productoId) {
  if (!confirm('¿Eliminar variante?')) return;
  fetch(`${API}/variantes/${idVariante}`, {
    method: 'DELETE',
    headers: { Authorization: 'Bearer ' + token }
  }).then(() => cargarVariantes(productoId));
};

function cerrarSesion() {
  logout();
}
windows.cerrarSesion = cerrarSesion;
