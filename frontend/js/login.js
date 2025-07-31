import { mostrarMensaje } from './utils.js';

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();
  const mensajeError = document.getElementById('mensajeError');
  mensajeError.textContent = '';

  try {
    const response = await fetch('http://localhost:3000/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, contraseña: password })
    });

    const data = await response.json();

    if (!response.ok) {
      mensajeError.textContent = data.mensaje || 'Error al iniciar sesión';
      mostrarMensaje(data.mensaje || 'Error al iniciar sesión', 'error');
      return;
    }

    localStorage.setItem('token', data.token);
    localStorage.setItem('usuario', JSON.stringify(data.usuario));
    window.location.href = 'dashboard.html';

  } catch (error) {
    mensajeError.textContent = 'Error al conectar con el servidor';
    mostrarMensaje('Error al conectar con el servidor', 'error');
    console.error(error);
  }
});
