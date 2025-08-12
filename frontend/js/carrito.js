import {
  obtenerToken,
  fetchConToken,
  mostrarMensaje,
  logout
} from './utils.js';

const API = 'http://localhost:3000/api';

// ===== Guardia de sesión (solo login, sin roles) =====
async function validarSesion() {
  const tk = obtenerToken();
  if (!tk) {
    alert('Acceso denegado: iniciá sesión para continuar.');
    window.location.href = 'login.html';
    return null;
  }
  try {
    const r = await fetch(`${API}/usuarios/me`, { headers: { Authorization: 'Bearer ' + tk } });
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
let carrito = JSON.parse(localStorage.getItem('carritoVenta')) || [];

document.addEventListener('DOMContentLoaded', async () => {
  const usuario = await validarSesion();
  if (!usuario) return;

  renderizarCarrito();

  // Mostrar campos para montos si se eligen más de 1 método
  document.querySelectorAll('input[name="metodo"]').forEach(input => {
    input.addEventListener('change', () => {
      const seleccionados = Array.from(document.querySelectorAll('input[name="metodo"]:checked'));
      const contenedor = document.getElementById('inputs-montos');
      contenedor.innerHTML = '';

      if (seleccionados.length > 1) {
        contenedor.classList.remove('oculto');
        seleccionados.forEach(sel => {
          const label = document.createElement('label');
          label.innerHTML = `${sel.value}: <input type="number" min="0" step="0.01" name="monto-${sel.value}">`;
          contenedor.appendChild(label);
        });
      } else {
        contenedor.classList.add('oculto');
      }
    });
  });

  const formPago = document.getElementById('form-pago');
  formPago?.addEventListener('submit', async function (e) {
    e.preventDefault();

    const metodos = Array.from(document.querySelectorAll('input[name="metodo"]:checked')).map(input => input.value);
    const totalVenta = carrito.reduce((acc, item) => acc + item.precio * item.cantidad, 0);

    if (metodos.length === 0) {
      alert("Seleccioná al menos un método de pago.");
      return;
    }

    let pagos = [];

    if (metodos.length === 1) {
      pagos.push({ metodo: metodos[0], monto: totalVenta });
    } else {
      let suma = 0;
      pagos = metodos.map(metodo => {
        const input = document.querySelector(`input[name="monto-${metodo}"]`);
        const monto = parseFloat(input?.value || 0);
        suma += monto;
        return { metodo, monto };
      });

      if (Math.round(suma) !== Math.round(totalVenta)) {
        alert("La suma de los montos no coincide con el total.");
        return;
      }
    }

    const venta = {
      items: carrito.map(i => ({
        producto_id: i.producto_id,
        variante_id: i.variante_id,
        cantidad: i.cantidad,
        precio: i.precio
      })),
      pagos
    };

    const res = await fetch(`${API}/ventas/carrito`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify(venta)
    });

    const data = await res.json();
    if (res.ok) {
      alert("¡Venta registrada!");
      localStorage.removeItem('carritoVenta');
      window.location.href = "ventas.html";
    } else {
      alert(data.mensaje || "Error al registrar la venta");
    }
  });
});

function renderizarCarrito() {
  const tbody = document.getElementById('tabla-carrito');
  tbody.innerHTML = '';
  let total = 0;
  carrito.forEach((item, idx) => {
    const subtotal = item.precio * item.cantidad;
    total += subtotal;
    tbody.innerHTML += `
      <tr>
        <td>${item.nombre}</td>
        <td>Talle: ${item.talle} | Color: ${item.color}</td>
        <td>$${Number(item.precio).toLocaleString('es-AR', {minimumFractionDigits:2})}</td>
        <td>
          <input type="number" min="1" max="999" value="${item.cantidad}" onchange="cambiarCantidad(${idx}, this.value)">
        </td>
        <td>$${Number(subtotal).toLocaleString('es-AR', {minimumFractionDigits:2})}</td>
        <td class="acciones-carrito">
          <button onclick="eliminarDelCarrito(${idx})">Eliminar</button>
        </td>
      </tr>
    `;
  });
  document.getElementById('carrito-totales').textContent = `Total: $${Number(total).toLocaleString('es-AR', {minimumFractionDigits:2})}`;
}

window.cambiarCantidad = function(idx, nuevaCantidad) {
  nuevaCantidad = parseInt(nuevaCantidad);
  if (!nuevaCantidad || nuevaCantidad < 1) return;
  carrito[idx].cantidad = nuevaCantidad;
  localStorage.setItem('carritoVenta', JSON.stringify(carrito));
  renderizarCarrito();
};

window.eliminarDelCarrito = function(idx) {
  carrito.splice(idx, 1);
  localStorage.setItem('carritoVenta', JSON.stringify(carrito));
  renderizarCarrito();
};

window.abrirModalPago = function () {
  if (!carrito.length) {
    alert("El carrito está vacío");
    return;
  }
  document.getElementById('modal-pago').style.display = 'flex';
};

window.cerrarModal = function () {
  document.getElementById('modal-pago').style.display = 'none';
};

function volverCatalogo() {
  window.location.href = "catalogo.html";
}

function cerrarSesion() {
  logout();
}
