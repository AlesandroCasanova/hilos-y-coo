import { mostrarMensaje } from './utils.js';

document.getElementById('registroForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const nombre = document.getElementById('nombre').value.trim();
  const email = document.getElementById('email').value.trim();
  const contraseña = document.getElementById('password').value.trim();
  const rol = document.getElementById('rol').value; // ahora está presente

  const mensaje = document.getElementById('mensaje');

  try {
    const response = await fetch('http://localhost:3000/api/registro-duenio', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ nombre, email, contraseña, rol }) // rol incluido
    });

    const data = await response.json();

    if (!response.ok) {
      mensaje.textContent = data.error || 'Error al registrar';
      mensaje.style.color = 'red';
      mostrarMensaje(data.error || 'Error al registrar', "error");
      return;
    }

    mensaje.style.color = 'green';
    mensaje.textContent = 'Usuario Dueño creado correctamente. Redirigiendo...';
    mostrarMensaje('Usuario Dueño creado correctamente. Redirigiendo...', "exito");
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 1500);
  } catch (error) {
    mensaje.textContent = 'Error de conexión con el servidor';
    mensaje.style.color = 'red';
    mostrarMensaje('Error de conexión con el servidor', "error");
    console.error(error);
  }
});
