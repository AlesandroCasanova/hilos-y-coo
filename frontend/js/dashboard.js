import {
  obtenerToken,
  logout,
  mostrarMensaje
} from './utils.js';

const content = document.getElementById('dashboardContent');
const token = obtenerToken();
const usuario = JSON.parse(localStorage.getItem('usuario')) || {};
const rol = usuario.rol;

const headers = {
  "Content-Type": "application/json",
  Authorization: "Bearer " + token
};

let aperturaIdActual = null;

let tituloPanel = rol === 'Dueño' ? 'Panel del Dueño' : 'Panel del Empleado';

content.innerHTML = `
  <h2>${tituloPanel}</h2>
  <div class="estado-caja">
    <span id="estado-texto">Verificando caja física...</span>
    <button id="btn-abrir-caja" class="oculto">Abrir Caja</button>
    <button id="btn-cerrar-caja" class="oculto">Cerrar Caja</button>
  </div>
  <div id="resumen-cajas" class="montos-caja oculto">
    <strong>Dinero en Caja Física:</strong> <span id="dinero-fisico">-</span><br>
    <strong>Dinero en Caja Virtual:</strong> <span id="dinero-virtual">-</span>
  </div>

  <div class="card-container">
    <div class="card" onclick="location.href='productos.html'">📦 Productos</div>
    <div class="card" onclick="location.href='inventario.html'">📊 Inventario</div>
    <div class="card" onclick="location.href='caja.html'">💳 Caja</div>
    <div class="card" onclick="location.href='finanzas.html'">💰 Finanzas</div>
    <div class="card" onclick="location.href='proveedores.html'">📤 Proveedores</div>
    <div class="card" onclick="location.href='empleados.html'">👥 Empleados</div>
    <div class="card" onclick="location.href='ventas.html'">🧾 Ventas</div>
    <div class="card" onclick="location.href='catalogo.html'">🗂️ Catálogo</div>
    <div class="card" onclick="location.href='carrito.html'">🛒 Carrito</div>
    <div class="card" onclick="location.href='pagos.html'">💸 Pagos</div>
  </div>

  <div id="modal-cierre" class="modal">
    <div class="modal-content">
      <h3>Arqueo y Cierre de Caja</h3>
      <label for="monto-final-cierre">Monto final contado en caja:</label>
      <input type="number" id="monto-final-cierre" placeholder="Ej: 25300.00">
      <div class="modal-buttons">
        <button id="confirmar-cierre">Confirmar</button>
        <button onclick="cerrarModalCierre()">Cancelar</button>
      </div>
    </div>
  </div>
`;

document.getElementById('logoutBtn').addEventListener('click', logout);

const estadoTexto = document.getElementById('estado-texto');
const btnAbrir = document.getElementById('btn-abrir-caja');
const btnCerrar = document.getElementById('btn-cerrar-caja');
const resumen = document.getElementById('resumen-cajas');
const montoFinalInput = document.getElementById('monto-final-cierre');
const modalCierre = document.getElementById('modal-cierre');

// Verificar estado de caja
async function verificarEstadoCaja() {
  const res = await fetch('http://localhost:3000/api/caja/estado/fisica', { headers });
  const data = await res.json();

  const abierta = data.abierta;
  aperturaIdActual = data.apertura_id || null;

  if (abierta) {
    estadoTexto.textContent = `Caja física abierta por ${data.usuario_nombre}`;
    estadoTexto.classList.remove('cerrada');
    estadoTexto.classList.add('abierta');
    btnCerrar.classList.remove('oculto');
    btnAbrir.classList.add('oculto');
    resumen.classList.remove('oculto');
    cargarSaldos();
  } else {
    estadoTexto.textContent = "Caja física cerrada";
    estadoTexto.classList.remove('abierta');
    estadoTexto.classList.add('cerrada');
    btnAbrir.classList.remove('oculto');
    btnCerrar.classList.add('oculto');
    resumen.classList.remove('oculto');
    cargarSaldos();
  }
}

btnAbrir.onclick = async () => {
  const res = await fetch('http://localhost:3000/api/caja/abrir', {
    method: 'POST',
    headers,
    body: JSON.stringify({ tipo_caja: 'fisica' })
  });

  if (res.ok) {
    mostrarMensaje("Caja abierta correctamente");
    location.reload();
  } else {
    let mensaje = "Error al abrir caja: ";
    try {
      const error = await res.json();
      mensaje += error?.detalle?.sqlMessage || error?.detalle?.message || JSON.stringify(error);
    } catch (e) {
      mensaje += "Error inesperado";
    }
    alert(mensaje);
  }
};

btnCerrar.onclick = () => {
  modalCierre.style.display = 'flex';
};

document.getElementById('confirmar-cierre').onclick = async () => {
  const montoFinal = parseFloat(montoFinalInput.value);
  if (isNaN(montoFinal)) return alert("Monto inválido");

  const res = await fetch('http://localhost:3000/api/caja/cerrar', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      apertura_id: aperturaIdActual,
      monto_final: montoFinal
    })
  });

  if (res.ok) {
    mostrarMensaje("Caja cerrada con éxito");
    modalCierre.style.display = 'none';
    location.reload();
  } else {
    alert("Error al cerrar caja");
  }
};

window.cerrarModalCierre = function () {
  modalCierre.style.display = 'none';
};

// Mostrar montos actuales en ambas cajas
async function cargarSaldos() {
  try {
    const res = await fetch('http://localhost:3000/api/finanzas/saldos', {
      headers
    });
    const data = await res.json();

    const fisica = Number(data.fisica || 0);
    const virtual = Number(data.virtual || 0);

    document.getElementById('dinero-fisico').textContent = `$${fisica.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
    document.getElementById('dinero-virtual').textContent = `$${virtual.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
  } catch (error) {
    console.error('Error al cargar saldos:', error);
    document.getElementById('dinero-fisico').textContent = "$0.00";
    document.getElementById('dinero-virtual').textContent = "$0.00";
  }
}

verificarEstadoCaja();
