import {
  obtenerToken,
  fetchConToken,
  mostrarMensaje,
  logout
} from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('formularioImpuesto');
  const tablaBody = document.querySelector('#tablaImpuestos tbody');
  const token = obtenerToken();

  // Función para mostrar impuestos existentes
  async function cargarImpuestos() {
    try {
      const response = await fetch('http://localhost:3000/api/impuestos', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      // Limpiar la tabla
      tablaBody.innerHTML = '';

      if (!response.ok) {
        console.error(data.error || 'Error al obtener impuestos');
        return;
      }

      data.forEach((imp) => {
        const fila = document.createElement('tr');
        fila.innerHTML = `
          <td>${imp.id}</td>
          <td>${imp.tipo}</td>
          <td>$${parseFloat(imp.monto).toFixed(2)}</td>
          <td>${new Date(imp.fecha).toLocaleDateString()}</td>
          <td>${imp.descripcion}</td>
        `;
        tablaBody.appendChild(fila);
      });
    } catch (err) {
      console.error('Error al obtener impuestos:', err);
    }
  }

  // Envío del formulario
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const tipo = document.getElementById('tipo').value.trim();
    const monto = document.getElementById('monto').value.trim();
    const descripcion = document.getElementById('descripcion').value.trim();

    try {
      const response = await fetch('http://localhost:3000/api/impuestos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ tipo, monto, descripcion })
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || 'Error al registrar impuesto');
        return;
      }

      alert('Impuesto registrado correctamente');
      form.reset();
      cargarImpuestos();
    } catch (err) {
      console.error('Error al registrar impuesto:', err);
    }
  });

  // Cargar al iniciar
  cargarImpuestos();
});
