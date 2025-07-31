import {
  obtenerToken,
  fetchConToken,
  mostrarMensaje,
  logout,
  camposVacios,
  esEmailValido
} from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
  const token = obtenerToken();
  const tabla = document.querySelector('#tablaEmpleados tbody');
  const form = document.getElementById('formEmpleado');

  // Cargar empleados existentes
  fetch('http://localhost:3000/api/usuarios', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
    .then(res => res.json())
    .then(data => {
      data.forEach(empleado => {
        const fila = document.createElement('tr');
        fila.innerHTML = `
          <td>${empleado.id}</td>
          <td>${empleado.nombre}</td>
          <td>${empleado.email}</td>
          <td>${empleado.rol}</td>
        `;
        tabla.appendChild(fila);
      });
    })
    .catch(error => {
      console.error('Error al cargar empleados:', error);
    });

  // Registrar nuevo empleado
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(form);
    const empleado = {
      nombre: formData.get('nombre'),
      email: formData.get('email'),
      contraseña: formData.get('contraseña'),
      rol: 'Empleado'
    };

    try {
      const res = await fetch('http://localhost:3000/api/usuarios', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(empleado)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.mensaje || 'Error al registrar empleado');

      alert('Empleado registrado correctamente');
      location.reload();
    } catch (err) {
      console.error(err);
      alert('Error: ' + err.message);
    }
  });
});
