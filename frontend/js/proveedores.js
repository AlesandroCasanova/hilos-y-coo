import {
  obtenerToken,
  fetchConToken,
  mostrarMensaje,
  logout
} from './utils.js';

const API = 'http://localhost:3000/api';
const token = obtenerToken();

// Evento al enviar el formulario
document.getElementById('formProveedor').addEventListener('submit', async function(e) {
  e.preventDefault();
  const id = document.getElementById('idProveedor').value;
  const nombre = document.getElementById('nombreProveedor').value.trim();
  const contacto = document.getElementById('contactoProveedor').value.trim();

  if (!nombre) {
    alert("El nombre del proveedor es obligatorio.");
    return;
  }

  if (id) {
    // Editar proveedor
    await fetch(`${API}/proveedores/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token
      },
      body: JSON.stringify({ nombre, contacto })
    });
    document.getElementById('formProveedor').reset();
    document.getElementById('btnCancelarEdicionProveedor').style.display = 'none';
    document.querySelector('#formProveedor button[type=submit]').textContent = "Agregar";
  } else {
    // Crear proveedor
    await fetch(`${API}/proveedores`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token
      },
      body: JSON.stringify({ nombre, contacto })
    });
    e.target.reset();
  }
  cargarProveedores();
});

// Cargar listado
function cargarProveedores() {
  fetch(`${API}/proveedores`, {
    headers: { Authorization: 'Bearer ' + token }
  })
  .then(res => res.json())
  .then(data => {
    const tbody = document.getElementById('tabla-proveedores');
    tbody.innerHTML = '';
    data.forEach(prov => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${prov.id}</td>
        <td>${prov.nombre}</td>
        <td>${prov.contacto || ''}</td>
        <td>
          <button onclick="editarProveedor(${prov.id}, '${prov.nombre.replace(/'/g, "\\'")}', '${(prov.contacto || '').replace(/'/g, "\\'")}')">Editar</button>
          <button onclick="eliminarProveedor(${prov.id})">Eliminar</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  });
}

// Editar (pre-cargar datos en form)
window.editarProveedor = function(id, nombre, contacto) {
  document.getElementById('idProveedor').value = id;
  document.getElementById('nombreProveedor').value = nombre;
  document.getElementById('contactoProveedor').value = contacto;
  document.querySelector('#formProveedor button[type=submit]').textContent = "Actualizar";
  document.getElementById('btnCancelarEdicionProveedor').style.display = '';
};

// Cancelar edición
document.getElementById('btnCancelarEdicionProveedor').onclick = function() {
  document.getElementById('formProveedor').reset();
  document.querySelector('#formProveedor button[type=submit]').textContent = "Agregar";
  this.style.display = 'none';
};

// Eliminar
window.eliminarProveedor = function(id) {
  if (!confirm('¿Eliminar este proveedor?')) return;
  fetch(`${API}/proveedores/${id}`, {
    method: 'DELETE',
    headers: { Authorization: 'Bearer ' + token }
  }).then(() => cargarProveedores());
};

// Cerrar sesión
function cerrarSesion() {
  logout();
}

// Inicializar
cargarProveedores();

windows.cerrarSesion = cerrarSesion;