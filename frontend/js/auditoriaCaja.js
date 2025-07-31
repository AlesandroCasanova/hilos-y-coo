import { obtenerToken } from './utils.js';

window.cargarArqueos = async function () {
  const desde = document.getElementById('filtro-desde').value;
  const hasta = document.getElementById('filtro-hasta').value;
  const caja_tipo = document.getElementById('filtro-caja').value;
  const tipo = document.getElementById('filtro-tipo').value;

  let url = 'http://localhost:3000/api/caja/arqueos?';
  if (desde) url += `desde=${desde}&`;
  if (hasta) url += `hasta=${hasta}&`;
  if (caja_tipo) url += `caja_tipo=${caja_tipo}&`;
  if (tipo) url += `tipo=${tipo}&`;

  const res = await fetch(url, { headers: { Authorization: 'Bearer ' + obtenerToken() } });
  const datos = await res.json();
  const tbody = document.getElementById('tbody-arqueos');
  tbody.innerHTML = '';
  if (!Array.isArray(datos) || !datos.length) {
    tbody.innerHTML = '<tr><td colspan="8">Sin registros</td></tr>';
    return;
  }
  datos.forEach(a => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${new Date(a.fecha).toLocaleString('es-AR')}</td>
      <td>${a.caja_tipo === 'fisica' ? 'Física' : 'Virtual'}</td>
      <td>${a.tipo.charAt(0).toUpperCase() + a.tipo.slice(1)}</td>
      <td>${a.usuario_nombre}</td>
      <td>$${Number(a.saldo_teorico).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
      <td>$${Number(a.saldo_contado).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
      <td style="color:${a.diferencia == 0 ? '#222' : a.diferencia > 0 ? 'green' : 'red'}">
        $${Number(a.diferencia).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
      </td>
      <td>${a.observaciones || '-'}</td>
    `;
    tbody.appendChild(tr);
  });
};

document.addEventListener('DOMContentLoaded', cargarArqueos);
