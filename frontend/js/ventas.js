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
let usuario = null;

document.addEventListener('DOMContentLoaded', async () => {
  const authUser = await validarSesion();
  if (!authUser) return;
  usuario = authUser; // usamos el usuario validado del backend

  cargarCarrito();
  cargarHistorialVentas();
  document.getElementById('btnConfirmarVenta').onclick = confirmarVenta;
});

function cargarCarrito() {
  fetch(`${API}/carrito/${usuario.id}`, {
    headers: { Authorization: "Bearer " + token }
  })
    .then(res => res.json())
    .then(carrito => {
      renderizarCarrito(carrito);
    });
}

function renderizarCarrito(carrito) {
  const tbody = document.querySelector('#tabla-carrito tbody');
  const vacio = document.getElementById('carrito-vacio');
  tbody.innerHTML = '';
  let total = 0;

  if (!carrito.length) {
    vacio.style.display = '';
    document.getElementById('totalCarrito').innerText = '';
    document.getElementById('btnConfirmarVenta').disabled = true;
    return;
  }

  vacio.style.display = 'none';
  document.getElementById('btnConfirmarVenta').disabled = false;

  carrito.forEach(item => {
    const subtotal = item.precio * item.cantidad;
    total += subtotal;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.producto}</td>
      <td>${item.talle}</td>
      <td>${item.color}</td>
      <td>$${Number(item.precio).toLocaleString('es-AR', {minimumFractionDigits:2})}</td>
      <td>
        <input type="number" min="1" value="${item.cantidad}" style="width: 60px;"
          onchange="actualizarCantidad(${item.id}, this.value)">
      </td>
      <td>$${subtotal.toLocaleString('es-AR', {minimumFractionDigits:2})}</td>
      <td>
        <button onclick="eliminarDelCarrito(${item.id})">Eliminar</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById('totalCarrito').innerText = "$" + total.toLocaleString('es-AR', {minimumFractionDigits:2});
}

// Actualiza cantidad de un ítem
window.actualizarCantidad = function(id_item, cantidad) {
  fetch(`${API}/carrito/${id_item}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token
    },
    body: JSON.stringify({ cantidad })
  })
  .then(() => cargarCarrito());
};

// Elimina un ítem del carrito
window.eliminarDelCarrito = function(id_item) {
  if (!confirm("¿Eliminar este producto del carrito?")) return;
  fetch(`${API}/carrito/${id_item}`, {
    method: "DELETE",
    headers: { Authorization: "Bearer " + token }
  })
  .then(() => cargarCarrito());
};

// Confirma la venta y vacía el carrito
function confirmarVenta() {
  if (!confirm("¿Registrar la venta? Se descontará el stock y se guardará en el historial.")) return;
  fetch(`${API}/ventas`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token
    },
    body: JSON.stringify({ usuario_id: usuario.id })
  })
    .then(res => res.json())
    .then(data => {
      if (data && data.venta_id) {
        alert("Venta registrada con éxito.");
        cargarCarrito();
        cargarHistorialVentas();
      } else if (data && data.mensaje) {
        alert(data.mensaje);
      }
    });
}

// Carga historial de ventas
function cargarHistorialVentas() {
  fetch(`${API}/ventas`, {
    headers: { Authorization: "Bearer " + token }
  })
    .then(res => res.json())
    .then(ventas => {
      const tbody = document.getElementById('tabla-historial-ventas');
      tbody.innerHTML = '';
      ventas.forEach(v => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${v.id}</td>
          <td>${formatearFecha(v.fecha)}</td>
          <td>$${Number(v.total).toLocaleString('es-AR', {minimumFractionDigits:2})}</td>
          <td>${v.vendedor}</td>
          <td>
            <button onclick="verDetalleVenta(${v.id})">Detalle</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    });
}

// Redirige al detalle de la venta
window.verDetalleVenta = function(id) {
  window.location.href = `detalle_venta.html?id=${id}`;
};

function formatearFecha(fecha) {
  if (!fecha) return "-";
  const d = new Date(fecha);
  return `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}, ${d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`;
}

function cerrarSesion() {
  logout();
}
window.cerrarSesion = cerrarSesion; // <-- corregido (antes decía "windows")
