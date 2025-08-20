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

  // Modal listeners
  const modal = document.getElementById('modal-pago');
  const closeBtn = document.getElementById('mp-close');
  const cancelBtn = document.getElementById('mp-cancel');
  closeBtn?.addEventListener('click', cerrarModal);
  cancelBtn?.addEventListener('click', cerrarModal);
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) cerrarModal();
  });

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
          label.className = 'form-row';
          label.innerHTML = `
            <span class="label" style="margin:0">${sel.value}</span>
            <input class="input" type="number" min="0" step="0.01" name="monto-${sel.value}" placeholder="0,00">
          `;
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
    const totalVenta = carrito.reduce((acc, item) => acc + (Number(item.precio) * Number(item.cantidad)), 0);

    if (metodos.length === 0) {
      alert("Seleccioná al menos un método de pago.");
      return;
    }

    let pagos = [];

    if (metodos.length === 1) {
      pagos.push({ metodo: metodos[0], monto: red2(totalVenta) });
    } else {
      let suma = 0;
      pagos = metodos.map(metodo => {
        const input = document.querySelector(`input[name="monto-${metodo}"]`);
        const monto = Number(parseFloat(input?.value || 0));
        suma += monto;
        return { metodo, monto: red2(monto) };
      });

      if (Math.abs(red2(suma) - red2(totalVenta)) > 0.01) {
        alert(`La suma de los montos ($${fmt(suma)}) no coincide con el total ($${fmt(totalVenta)}).`);
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
      cerrarModal();
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

  if (!carrito.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#6b7280">El carrito está vacío</td></tr>`;
  }

  carrito.forEach((item, idx) => {
    const precio = Number(item.precio);
    const cantidad = Number(item.cantidad);
    const subtotal = precio * cantidad;
    total += subtotal;

    tbody.innerHTML += `
      <tr>
        <td>${item.nombre}</td>
        <td>Talle: ${item.talle} &nbsp;|&nbsp; Color: ${item.color}</td>
        <td class="num">$${fmt(precio)}</td>
        <td>
          <input class="input cantidad-input" type="number" min="1" max="999" value="${cantidad}" onchange="cambiarCantidad(${idx}, this.value)">
        </td>
        <td class="num">$${fmt(subtotal)}</td>
        <td class="acciones-carrito">
          <button class="btn danger sm" onclick="eliminarDelCarrito(${idx})">Eliminar</button>
        </td>
      </tr>
    `;
  });

  const totalesEl = document.getElementById('carrito-totales');
  if (totalesEl) totalesEl.innerHTML = `<b>Total:</b> $ ${fmt(total)}`;
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
  document.getElementById('modal-pago')?.classList.add('show');
  document.getElementById('modal-pago')?.setAttribute('aria-hidden', 'false');
};

window.cerrarModal = function () {
  document.getElementById('modal-pago')?.classList.remove('show');
  document.getElementById('modal-pago')?.setAttribute('aria-hidden', 'true');
};

function volverCatalogo() {
  window.location.href = "catalogo.html";
}

function cerrarSesion() {
  logout();
}

// ===== Helpers =====
function fmt(n) {
  return Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function red2(n) { return Math.round(Number(n || 0) * 100) / 100; }
