const API = 'http://localhost:3000/api';
const form = document.getElementById('loginForm');
const mensajeDiv = document.getElementById('mensaje');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('email').value.trim();
  const contraseña = document.getElementById('password').value.trim();

  try {
    const res = await fetch(`${API}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, contraseña })
    });

    const data = await res.json();

    if (!res.ok) {
      mensajeDiv.textContent = data.mensaje || 'Error al iniciar sesión';
      mensajeDiv.style.color = 'red';
      return;
    }

    // Guardar token y usuario
    localStorage.setItem('token', data.token);
    localStorage.setItem('usuario', JSON.stringify(data.usuario));

    mensajeDiv.textContent = 'Inicio de sesión exitoso. Redirigiendo...';
    mensajeDiv.style.color = 'green';

    setTimeout(() => {
      window.location.href = 'dashboard.html';
    }, 1000);

  } catch (error) {
    console.error('Error al iniciar sesión:', error);
    mensajeDiv.textContent = 'Error de conexión';
    mensajeDiv.style.color = 'red';
  }
});
