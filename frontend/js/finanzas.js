import { obtenerToken, logout } from './utils.js';

const token = obtenerToken();
const API = 'http://localhost:3000/api';

document.addEventListener('DOMContentLoaded', () => {
  cargarSaldos();
});

// ----------- SALDOS Y CARDS -------------
async function cargarSaldos() {
  try {
    const res = await fetch(`${API}/finanzas/saldos`, {
      headers: { Authorization: 'Bearer ' + token }
    });
    const data = await res.json();

    const saldoFisica = Number(data.fisica || 0);
    const saldoVirtual = Number(data.virtual || 0);
    const reservasFisica = Number(data.reservasFisica || 0);
    const reservasVirtual = Number(data.reservasVirtual || 0);

    const balanceTotal = saldoFisica + saldoVirtual + reservasFisica + reservasVirtual;

    document.getElementById('saldo-fisica').textContent = `$${saldoFisica.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
    document.getElementById('saldo-virtual').textContent = `$${saldoVirtual.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
    document.getElementById('reservas-fisica').textContent = `$${reservasFisica.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
    document.getElementById('reservas-virtual').textContent = `$${reservasVirtual.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
    document.getElementById('balance-total').textContent = `$${balanceTotal.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  } catch (error) {
    console.error('Error al cargar saldos:', error);
    document.getElementById('saldo-fisica').textContent = "$0.00";
    document.getElementById('saldo-virtual').textContent = "$0.00";
    document.getElementById('reservas-fisica').textContent = "$0.00";
    document.getElementById('reservas-virtual').textContent = "$0.00";
    document.getElementById('balance-total').textContent = "$0.00";
  }
}



// ----------- MODAL RESERVAS -------------
window.abrirModalReservas = async function () {
  document.getElementById('modalReservas').style.display = 'flex';
  await cargarReservasActivas();
};
window.cerrarModalReservas = function () {
  document.getElementById('modalReservas').style.display = 'none';
};

async function cargarReservasActivas() {
  try {
    const res = await fetch(`${API}/finanzas/reservas-activas`, {
      headers: { Authorization: 'Bearer ' + token }
    });
    const reservas = await res.json();

    // Calcular totales globales por tipo para arriba
    let totalFisicaDisponible = 0;
    let totalVirtualDisponible = 0;
    reservas.forEach(reserva => {
      if (reserva.caja_tipo === 'fisica') {
        totalFisicaDisponible += (Number(reserva.monto) - (Number(reserva.monto_liberado) || 0));
      } else {
        totalVirtualDisponible += (Number(reserva.monto) - (Number(reserva.monto_liberado) || 0));
      }
    });
    document.getElementById('total-reserva-fisica').textContent = `$${totalFisicaDisponible.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
    document.getElementById('total-reserva-virtual').textContent = `$${totalVirtualDisponible.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;

    // Render tabla solo lectura
    const tbody = document.getElementById('tbody-reservas');
    tbody.innerHTML = '';
    if (!reservas.length) {
      tbody.innerHTML = '<tr><td colspan="5">Sin reservas activas</td></tr>';
      return;
    }
    reservas.forEach(reserva => {
      const disponible = Number(reserva.monto) - (Number(reserva.monto_liberado) || 0);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${reserva.caja_tipo === 'fisica' ? 'Física' : 'Virtual'}</td>
        <td>$${Number(reserva.monto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
        <td>$${Number(reserva.monto_liberado || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
        <td><strong>$${disponible.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong></td>
        <td>${reserva.descripcion || '-'}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (error) {
    document.getElementById('tbody-reservas').innerHTML = '<tr><td colspan="5">Error al cargar reservas</td></tr>';
  }
}

// ----------- FUNCION GLOBAL: RETIRAR DESDE RESERVA -------------
window.retirarDesdeReserva = async function (tipo) {
  const input = tipo === 'fisica'
    ? document.getElementById('montoRetiroFisica')
    : document.getElementById('montoRetiroVirtual');
  const monto = parseFloat(input.value);

  if (!monto || monto <= 0) {
    alert('Ingresá un monto válido.');
    return;
  }

  // Consultar cuánto hay disponible (solo para mostrar mensaje de "max disponible")
  const reservasRes = await fetch(`${API}/finanzas/reservas-activas`, {
    headers: { Authorization: 'Bearer ' + token }
  });
  const reservas = await reservasRes.json();
  let disponibleTotal = reservas
    .filter(r => r.caja_tipo === tipo)
    .reduce((acc, r) => acc + (Number(r.monto) - (Number(r.monto_liberado) || 0)), 0);

  if (monto > disponibleTotal) {
    alert(`No hay suficiente disponible. Máximo: $${disponibleTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`);
    return;
  }

  if (!confirm(`¿Liberar $${monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })} de la reserva ${tipo}?`)) return;

  try {
    const res = await fetch(`${API}/finanzas/reservas/extraer`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        tipo_caja: tipo,
        monto
      })
    });
    const data = await res.json();
    if (res.ok) {
      alert('Monto liberado correctamente.');
      input.value = '';
      await cargarSaldos();
      await cargarReservasActivas();
    } else {
      alert(data.mensaje || 'Error al liberar.');
      await cargarSaldos();
      await cargarReservasActivas();
    }
  } catch (err) {
    alert('Error al liberar reserva.');
  }
};

// ---------------- MODALES ACCIONES ----------------
window.abrirModalIngreso = function () {
  document.getElementById('modalIngreso').style.display = 'flex';
};
window.cerrarModalIngreso = function () {
  document.getElementById('modalIngreso').style.display = 'none';
  limpiarModalIngreso();
};
window.abrirModalEgreso = function () {
  document.getElementById('modalEgreso').style.display = 'flex';
  cargarCategoriasFrecuentes();
};
window.cerrarModalEgreso = function () {
  document.getElementById('modalEgreso').style.display = 'none';
  limpiarModalEgreso();
};

function limpiarModalIngreso() {
  document.getElementById('ingreso-categoria').value = '';
  document.getElementById('ingreso-entidad').value = '';
  document.getElementById('ingreso-concepto').value = '';
  document.getElementById('ingreso-descripcion').value = '';
  document.getElementById('ingreso-caja').value = 'fisica';
  document.getElementById('ingreso-monto').value = '';
}
function limpiarModalEgreso() {
  document.getElementById('egreso-tipo').value = 'Pago proveedor';
  document.getElementById('egreso-categoria').value = '';
  document.getElementById('egreso-concepto').value = '';
  document.getElementById('egreso-descripcion').value = '';
  document.getElementById('egreso-caja').value = 'fisica';
  document.getElementById('egreso-monto').value = '';
  if(document.getElementById('egreso-categoria-manual')) document.getElementById('egreso-categoria-manual').value = '';
  if(document.getElementById('egreso-concepto-manual')) document.getElementById('egreso-concepto-manual').value = '';
}

window.guardarIngreso = async function () {
  const categoria = document.getElementById('ingreso-categoria').value.trim();
  const entidad = document.getElementById('ingreso-entidad').value.trim();
  const concepto = document.getElementById('ingreso-concepto').value.trim();
  const descripcion = document.getElementById('ingreso-descripcion').value.trim();
  const caja_tipo = document.getElementById('ingreso-caja').value;
  const monto = parseFloat(document.getElementById('ingreso-monto').value);

  if (!categoria || !entidad || !concepto || !monto || monto <= 0) {
    alert('Por favor, completá todos los campos obligatorios.');
    return;
  }

  try {
    const res = await fetch(`${API}/finanzas/ingreso`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ categoria, entidad, concepto, descripcion, monto, caja_tipo })
    });
    if (res.ok) {
      alert('Ingreso registrado correctamente.');
      cerrarModalIngreso();
      cargarSaldos();
    } else {
      const data = await res.json();
      alert(data.mensaje || 'Error al registrar ingreso.');
    }
  } catch (err) {
    alert('Error de red al registrar ingreso.');
  }
};

window.guardarEgreso = async function () {
  let categoria = document.getElementById('egreso-categoria-manual')?.value.trim();
  if (!categoria) categoria = document.getElementById('egreso-categoria').value.trim();

  let concepto = document.getElementById('egreso-concepto-manual')?.value.trim();
  if (!concepto) concepto = document.getElementById('egreso-concepto').value.trim();

  const tipo_egreso = document.getElementById('egreso-tipo').value;
  const descripcion = document.getElementById('egreso-descripcion').value.trim();
  const caja_tipo = document.getElementById('egreso-caja').value;
  const monto = parseFloat(document.getElementById('egreso-monto').value);

  if (!tipo_egreso || !categoria || !concepto || !monto || monto <= 0) {
    alert('Por favor, completá todos los campos obligatorios.');
    return;
  }

  try {
    const res = await fetch(`${API}/finanzas/egreso`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ tipo_egreso, categoria, concepto, descripcion, monto, caja_tipo })
    });
    if (res.ok) {
      alert('Egreso registrado correctamente.');
      cerrarModalEgreso();
      cargarSaldos();
    } else {
      const data = await res.json();
      alert(data.mensaje || 'Error al registrar egreso.');
    }
  } catch (err) {
    alert('Error de red al registrar egreso.');
  }
};

// ---------------- ANALISIS FINANCIERO ----------------
window.mostrarModalAnalisis = async function () {
  document.getElementById('modalAnalisis').style.display = 'flex';
  mostrarTab('graficos');
  await cargarGraficosYTabla();
};
window.cerrarModalAnalisis = function () {
  document.getElementById('modalAnalisis').style.display = 'none';
};

window.mostrarTab = function(tab) {
  document.querySelectorAll('.tablink').forEach(btn => btn.classList.remove('active'));
  if(tab === 'graficos') {
    document.querySelector('.tablink:nth-child(1)').classList.add('active');
    document.getElementById('tab-graficos').style.display = '';
    document.getElementById('tab-historial').style.display = 'none';
  } else {
    document.querySelector('.tablink:nth-child(2)').classList.add('active');
    document.getElementById('tab-graficos').style.display = 'none';
    document.getElementById('tab-historial').style.display = '';
  }
};

let graficoTorta = null;

async function cargarGraficosYTabla() {
  try {
    const res = await fetch(`${API}/finanzas`, {
      headers: { Authorization: 'Bearer ' + token }
    });
    const movimientos = await res.json();

    // --- ARMAR DATOS DE GASTOS POR CATEGORÍA ---
    const categorias = {};
    movimientos.forEach(m => {
      if (m.tipo === 'Gasto' && m.categoria && m.categoria.trim() && m.categoria.toLowerCase() !== 'sin categoría') {
        categorias[m.categoria] = (categorias[m.categoria] || 0) + Number(m.monto);
      }
    });

    const labels = Object.keys(categorias);
    const data = Object.values(categorias);

    // Paleta de colores
    const colores = [
      "#2196F3", "#4CAF50", "#FFC107", "#F44336",
      "#9C27B0", "#FF9800", "#00BCD4", "#E91E63", "#8BC34A"
    ];

    // --- MOSTRAR/MOSTRAR OCULTAR MENSAJE SI NO HAY DATOS ---
    let mensajeSinDatos = document.getElementById('mensaje-sin-datos');
    if (!mensajeSinDatos) {
      mensajeSinDatos = document.createElement('div');
      mensajeSinDatos.id = 'mensaje-sin-datos';
      mensajeSinDatos.style.display = 'none';
      mensajeSinDatos.style.color = '#666';
      mensajeSinDatos.style.fontWeight = 'bold';
      mensajeSinDatos.style.marginTop = '20px';
      document.getElementById('tab-graficos').appendChild(mensajeSinDatos);
    }
    if (!labels.length) {
      mensajeSinDatos.style.display = '';
      mensajeSinDatos.textContent = "No hay movimientos registrados para mostrar.";
      if (graficoTorta) graficoTorta.destroy();
    } else {
      mensajeSinDatos.style.display = 'none';

      const ctx2 = document.getElementById('grafico-torta').getContext('2d');
      if (graficoTorta) graficoTorta.destroy();
      graficoTorta = new Chart(ctx2, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{
            label: 'Gastos por categoría',
            data,
            backgroundColor: colores,
            hoverOffset: 30,
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          cutout: '70%',
          plugins: {
            legend: {
              display: true,
              position: 'bottom',
              labels: {
                font: { size: 14, weight: 'bold' }
              }
            },
            tooltip: {
              enabled: true,
              callbacks: {
                label: function(context) {
                  let label = context.label || '';
                  let value = context.parsed || 0;
                  return `${label}: $${value.toLocaleString('es-AR', {minimumFractionDigits:2})}`;
                }
              }
            }
          },
          animation: {
            animateRotate: true,
            animateScale: true
          }
        }
      });
    }

    // --- HISTORIAL ---
    const tbody = document.getElementById('tabla-historial');
    tbody.innerHTML = '';
    if (!movimientos.length) {
      tbody.innerHTML = '<tr><td colspan="7">Sin registros</td></tr>';
    } else {
      movimientos.forEach(mov => {
        const fila = document.createElement('tr');
        fila.innerHTML = `
          <td>${new Date(mov.fecha).toLocaleDateString('es-AR')}</td>
          <td>${mov.tipo}</td>
          <td>${mov.categoria || '-'}</td>
          <td>${mov.entidad || '-'}</td>
          <td>${mov.concepto || '-'}</td>
          <td>${mov.descripcion || '-'}</td>
          <td>$${Number(mov.monto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
        `;
        tbody.appendChild(fila);
      });
    }
  } catch (err) {
    let mensajeSinDatos = document.getElementById('mensaje-sin-datos');
    if (!mensajeSinDatos) {
      mensajeSinDatos = document.createElement('div');
      mensajeSinDatos.id = 'mensaje-sin-datos';
      document.getElementById('tab-graficos').appendChild(mensajeSinDatos);
    }
    mensajeSinDatos.textContent = "Error al cargar el gráfico.";
    mensajeSinDatos.style.display = '';
  }
}

// -------- TRANSFERENCIAS ENTRE CAJAS -----------
window.abrirModalTransferencia = function() {
  document.getElementById('modalTransferencia').style.display = 'flex';
  document.getElementById('transfer-monto').value = '';
  document.getElementById('transfer-descripcion').value = '';
};
window.cerrarModalTransferencia = function() {
  document.getElementById('modalTransferencia').style.display = 'none';
};

window.realizarTransferencia = async function() {
  const origen = document.getElementById('transfer-origen').value;
  const destino = document.getElementById('transfer-destino').value;
  const monto = parseFloat(document.getElementById('transfer-monto').value);
  const descripcion = document.getElementById('transfer-descripcion').value;

  if (origen === destino) {
    alert('El origen y destino no pueden ser iguales.');
    return;
  }
  if (!monto || monto <= 0) {
    alert('Ingresá un monto válido.');
    return;
  }

  if (!confirm(`¿Transferir $${monto.toLocaleString('es-AR',{minimumFractionDigits:2})} de ${origen} a ${destino}?`)) return;

  try {
    const res = await fetch(`${API}/finanzas/transferir-caja`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ monto, origen, destino, descripcion })
    });
    const data = await res.json();
    if (res.ok) {
      alert('Transferencia realizada correctamente.');
      cerrarModalTransferencia();
      cargarSaldos();
    } else {
      alert(data.mensaje || 'Error al transferir.');
    }
  } catch (err) {
    alert('Error de red al transferir.');
  }
};

// --------- CARGAR CATEGORÍAS FRECUENTES -------------
async function cargarCategoriasFrecuentes() {
  const select = document.getElementById('egreso-categoria');
  select.innerHTML = '<option value="">Seleccioná...</option>';
  try {
    const res = await fetch(`${API}/finanzas/categorias-frecuentes`, {
      headers: { Authorization: 'Bearer ' + token }
    });
    const categorias = await res.json();
    categorias.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat;
      option.textContent = cat;
      select.appendChild(option);
    });
  } catch (e) {
    // fallback vacío
  }
  // Permitir agregar manual
  if (!document.getElementById('egreso-categoria-manual')) {
    const inputManual = document.createElement('input');
    inputManual.type = 'text';
    inputManual.id = 'egreso-categoria-manual';
    inputManual.placeholder = 'Otra categoría...';
    select.parentNode.appendChild(inputManual);
    select.onchange = function() {
      inputManual.value = select.value;
      cargarConceptosPorCategoria(select.value);
    };
    inputManual.oninput = function() {
      select.value = '';
    };
  }
}

// --------- SUBCATEGORÍA (CONCEPTO) POR CATEGORÍA ---------
async function cargarConceptosPorCategoria(categoria) {
  const select = document.getElementById('egreso-concepto');
  select.innerHTML = '<option value="">Seleccioná...</option>';
  if (!categoria) return;
  try {
    const res = await fetch(`${API}/finanzas/conceptos-por-categoria?categoria=${encodeURIComponent(categoria)}`, {
      headers: { Authorization: 'Bearer ' + token }
    });
    const conceptos = await res.json();
    conceptos.forEach(conc => {
      const option = document.createElement('option');
      option.value = conc;
      option.textContent = conc;
      select.appendChild(option);
    });
  } catch (e) {}
  // Manual
  if (!document.getElementById('egreso-concepto-manual')) {
    const inputManual = document.createElement('input');
    inputManual.type = 'text';
    inputManual.id = 'egreso-concepto-manual';
    inputManual.placeholder = 'Otro concepto...';
    select.parentNode.appendChild(inputManual);
    select.onchange = function() {
      inputManual.value = select.value;
    };
    inputManual.oninput = function() {
      select.value = '';
    };
  }
}

// Llamá a cargarCategoriasFrecuentes al abrir el modal:
// Ya está llamado arriba en window.abrirModalEgreso

window.cerrarSesion = logout;
