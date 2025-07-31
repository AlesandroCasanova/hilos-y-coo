import { obtenerToken, logout } from './utils.js';

const token = obtenerToken();
const API = 'http://localhost:3000/api';

document.addEventListener('DOMContentLoaded', () => {
  cargarInventario();
});

async function cargarInventario() {
  try {
    const res = await fetch(`${API}/inventario`, {
      headers: { Authorization: 'Bearer ' + token }
    });
    const inventario = await res.json();
    mostrarInventario(inventario);
  } catch (error) {
    console.error('Error al cargar inventario:', error);
  }
}

function mostrarInventario(inventario) {
  const tabla = document.querySelector('tbody');
  tabla.innerHTML = '';

  inventario.forEach(item => {
    const fila = document.createElement('tr');

    fila.innerHTML = `
      <td><img src="http://localhost:3000/imagenes_productos/${item.imagen}" alt="Imagen" width="60"></td>
      <td>${item.nombre_producto}</td>
      <td>${item.talle}</td>
      <td>${item.color}</td>
      <td><input type="number" value="${item.stock}" min="0" id="stock-${item.id}" /></td>
      <td><button class="guardar-btn" data-id="${item.id}">Guardar</button></td>
    `;

    tabla.appendChild(fila);
  });

  const botonesGuardar = document.querySelectorAll('.guardar-btn');
  botonesGuardar.forEach(boton => {
    boton.addEventListener('click', async () => {
      const id = boton.dataset.id;
      const inputStock = document.getElementById(`stock-${id}`);
      const nuevoStock = parseInt(inputStock.value);

      if (isNaN(nuevoStock)) {
        alert('El stock ingresado no es válido.');
        return;
      }

      if (nuevoStock < 0) {
        alert('El stock no puede ser negativo.');
        return;
      }

      try {
        const res = await fetch(`${API}/actualizarStock/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + token
          },
          body: JSON.stringify({ stock: nuevoStock })
        });

        if (res.ok) {
          mostrarNotificacion('Stock actualizado correctamente');
        } else {
          mostrarNotificacion('Error al actualizar el stock', true);
        }
      } catch (error) {
        console.error('Error al actualizar stock:', error);
        mostrarNotificacion('Error al actualizar el stock', true);
      }
    });
  });
}

function mostrarNotificacion(mensaje, error = false) {
  const noti = document.createElement('div');
  noti.textContent = mensaje;
  noti.className = 'notificacion';
  noti.style.backgroundColor = error ? '#e74c3c' : '#27ae60';
  noti.style.color = 'white';
  noti.style.padding = '10px 20px';
  noti.style.position = 'fixed';
  noti.style.top = '20px';
  noti.style.right = '20px';
  noti.style.borderRadius = '5px';
  noti.style.boxShadow = '0 2px 6px rgba(0,0,0,0.2)';
  document.body.appendChild(noti);

  setTimeout(() => {
    noti.remove();
  }, 3000);
}
