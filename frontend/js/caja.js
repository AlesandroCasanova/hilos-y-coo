import { obtenerToken, logout } from './utils.js';

const token = obtenerToken();
const API = 'http://localhost:3000/api';

document.addEventListener('DOMContentLoaded', () => {
  cargarSaldos();
  aplicarFiltros();
});

window.aplicarFiltros = async function () {
  const desdeInput = document.getElementById('fecha-desde');
  const hastaInput = document.getElementById('fecha-hasta');
  const tipoInput = document.getElementById('filtro-tipo');
  const cajaInput = document.getElementById('filtro-caja');

  if (!desdeInput || !hastaInput || !tipoInput || !cajaInput) return;

  const desde = desdeInput.value;
  const hasta = hastaInput.value;
  const tipo = tipoInput.value;
  const caja = cajaInput.value;

  let url = `${API}/caja/movimientos?`;
  if (desde) url += `desde=${desde}&`;
  if (hasta) url += `hasta=${hasta}&`;
  if (tipo) url += `tipo=${tipo}&`;
  if (caja) url += `caja=${caja}&`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: 'Bearer ' + token }
    });
    const movimientos = await res.json();

    const tbody = document.getElementById('tabla-movimientos');
    tbody.innerHTML = '';

    if (!movimientos.length) {
      tbody.innerHTML = `<tr><td colspan="7">No se encontraron movimientos</td></tr>`;
      return;
    }

    movimientos.forEach(m => {
      const esReserva = m.descripcion?.toLowerCase().includes("reserva");
      const tipoMostrar = esReserva ? "🔒 Reserva" : m.tipo;

      const fila = document.createElement('tr');
      fila.innerHTML = `
        <td>${new Date(m.fecha).toLocaleString('es-AR')}</td>
        <td>${tipoMostrar}</td>
        <td>$${Number(m.monto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
        <td>${m.metodo_pago || '-'}</td>
        <td>${m.caja_tipo}</td>
        <td>${m.usuario_nombre || '-'}</td>
        <td>${m.descripcion || '-'}</td>
      `;
      tbody.appendChild(fila);
    });
  } catch (err) {
    console.error(err);
    alert("Error al obtener movimientos de caja.");
  }
};

async function cargarSaldos() {
  try {
    const res = await fetch(`${API}/finanzas/saldos`, {
      headers: { Authorization: 'Bearer ' + token }
    });
    const data = await res.json();

const fisica = Number(data.fisica || 0);
const virtual = Number(data.virtual || 0);
const reservasFisica = Number(data.reservasFisica || 0);
const reservasVirtual = Number(data.reservasVirtual || 0);
const total = fisica + virtual + reservasFisica + reservasVirtual;

document.getElementById('saldo-fisica').textContent = `$${fisica.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
document.getElementById('saldo-virtual').textContent = `$${virtual.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
document.getElementById('reservas-fisica').textContent = `$${reservasFisica.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
document.getElementById('reservas-virtual').textContent = `$${reservasVirtual.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
document.getElementById('balance-total').textContent = `$${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;

  } catch (error) {
    console.error('Error al cargar saldos:', error);
    document.getElementById('saldo-fisica').textContent = "$0.00";
    document.getElementById('saldo-virtual').textContent = "$0.00";
    document.getElementById('reservas-fisica').textContent = "$0.00";
    document.getElementById('reservas-virtual').textContent = "$0.00";
    document.getElementById('balance-total').textContent = "$0.00";
  }
}

window.mostrarModalReserva = function () {
  document.getElementById('modalReserva').style.display = 'block';
};

window.cerrarModalReserva = function () {
  document.getElementById('modalReserva').style.display = 'none';
};

window.guardarReserva = async function () {
  const monto = parseFloat(document.getElementById('montoReserva').value);
  const caja = document.getElementById('cajaReserva').value;
  const descripcion = document.getElementById('descripcionReserva').value || 'Reserva manual';

  if (!monto || monto <= 0) return alert('Monto inválido.');

  const res = await fetch(`${API}/finanzas/reserva`, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ monto, caja, descripcion })
  });

  const data = await res.json();
  if (res.ok) {
    alert('Reserva registrada');
    cerrarModalReserva();
    aplicarFiltros();
    cargarSaldos();
  } else {
    alert(data.mensaje || data.error || 'Error al registrar reserva');
  }
};

window.abrirModalArqueo = function () {
  document.getElementById('modalArqueo').style.display = 'flex';
  document.getElementById('arqueoContado').value = '';
  document.getElementById('arqueoObs').value = '';
};

window.cerrarModalArqueo = function () {
  document.getElementById('modalArqueo').style.display = 'none';
};

window.guardarArqueo = async function () {
  const caja_tipo = document.getElementById('arqueoCaja').value;
  const saldo_contado = parseFloat(document.getElementById('arqueoContado').value);
  const observaciones = document.getElementById('arqueoObs').value || '';
  if (isNaN(saldo_contado) || saldo_contado < 0) return alert("Ingresá un saldo válido.");

  const res = await fetch(`${API}/caja/estado/${caja_tipo}`, {
    headers: { Authorization: 'Bearer ' + obtenerToken() }
  });
  const data = await res.json();
  const saldo_teorico = Number(data.saldo || 0);

  const res2 = await fetch(`${API}/caja/arqueo`, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + obtenerToken(),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      caja_tipo,
      saldo_teorico,
      saldo_contado,
      tipo: 'intermedio',
      observaciones
    })
  });

  const data2 = await res2.json();
  if (res2.ok) {
    alert(`Arqueo registrado.\nDiferencia: $${data2.diferencia.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`);
    cerrarModalArqueo();
  } else {
    alert(data2.error || 'Error al registrar arqueo.');
  }
};

window.cerrarSesion = logout;
