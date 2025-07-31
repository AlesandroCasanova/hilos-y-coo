import {
  obtenerToken,
  fetchConToken,
  mostrarMensaje,
  logout
} from './utils.js';

const API = 'http://localhost:3000/api';
const token = obtenerToken();

// Evento al enviar el formulario
document.getElementById('formCategoria').addEventListener('submit', async function(e) {
  e.preventDefault();
  const id = document.getElementById('idCategoria').value;
  const nombre = document.getElementById('nombreCategoria').value;

  if (id) {
    // Editar categoría
    await fetch(`${API}/categorias/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token
      },
      body: JSON.stringify({ nombre })
    });
    document.getElementById('formCategoria').reset();
    document.getElementById('btnCancelarEdicion').style.display = 'none';
    document.querySelector('#formCategoria button[type=submit]').textContent = "Agregar";
  } else {
    // Crear categoría
    await fetch(`${API}/categorias`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token
      },
      body: JSON.stringify({ nombre })
    });
    e.target.reset();
  }
  cargarCategorias();
});

// Cargar listado
function cargarCategorias() {
  fetch(`${API}/categorias`, {
    headers: { Authorization: 'Bearer ' + token }
  })
  .then(res => res.json())
  .then(data => {
    const tbody = document.getElementById('tabla-categorias');
    tbody.innerHTML = '';
    data.forEach(cat => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${cat.id}</td>
        <td>${cat.nombre}</td>
        <td>
          <button onclick="editarCategoria(${cat.id}, '${cat.nombre.replace(/'/g, "\\'")}')">Editar</button>
          <button onclick="eliminarCategoria(${cat.id})">Eliminar</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  });
}

// Editar (pre-cargar datos en form)
window.editarCategoria = function(id, nombre) {
  document.getElementById('idCategoria').value = id;
  document.getElementById('nombreCategoria').value = nombre;
  document.querySelector('#formCategoria button[type=submit]').textContent = "Actualizar";
  document.getElementById('btnCancelarEdicion').style.display = '';
};

// Cancelar edición
document.getElementById('btnCancelarEdicion').onclick = function() {
  document.getElementById('formCategoria').reset();
  document.querySelector('#formCategoria button[type=submit]').textContent = "Agregar";
  this.style.display = 'none';
};

// Eliminar
window.eliminarCategoria = function(id) {
  if (!confirm('¿Eliminar esta categoría?')) return;
  fetch(`${API}/categorias/${id}`, {
    method: 'DELETE',
    headers: { Authorization: 'Bearer ' + token }
  }).then(() => cargarCategorias());
};

// Cerrar sesión
function cerrarSesion() {
  logout();
}

// Inicializar
cargarCategorias();
