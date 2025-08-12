// ===== Config =====
const API = 'http://localhost:3000/api';

// ===== Helpers =====
function getToken(){ return localStorage.getItem('token') || ''; }
function authHeaders(extra={}){ return { Authorization: 'Bearer ' + getToken(), 'Content-Type':'application/json', ...extra }; }
function fmt(n){ return Number(n||0).toLocaleString('es-AR',{ minimumFractionDigits:2, maximumFractionDigits:2 }); }

// ===== DOM =====
const spanUsuario = document.getElementById('usuario-logueado');
const btnBack  = document.getElementById('btn-back');
const selYear  = document.getElementById('sel-year');
const selMonth = document.getElementById('sel-month');
const btnAplicar = document.getElementById('btn-aplicar');

const kIngVentas = document.getElementById('kpi-ingresos-ventas');
const kCogs      = document.getElementById('kpi-cogs');
const kBruto     = document.getElementById('kpi-bruto');
const kBrutoPct  = document.getElementById('kpi-bruto-pct');
const kOpex      = document.getElementById('kpi-opex');
const kNeta      = document.getElementById('kpi-neta');
const kNetaPct   = document.getElementById('kpi-neta-pct');

const rowOtrosIng = document.getElementById('row-otros-ing');
const rowEgrComp  = document.getElementById('row-egr-comp');

const rowCajaIng  = document.getElementById('row-caja-ing');
const rowCajaEgr  = document.getElementById('row-caja-egr');
const rowCajaNeto = document.getElementById('row-caja-neto');

const topRows   = document.getElementById('top-rows');

// ===== API calls =====
async function me(){
  const r = await fetch(`${API}/usuarios/me`, { headers: authHeaders() });
  if (!r.ok) return null;
  const data = await r.json();
  return data.usuario || null;
}
async function getMensual(year, month){
  const url = new URL(`${API}/ganancias/mensual`);
  url.searchParams.set('year', year);
  url.searchParams.set('month', month);
  const r = await fetch(url, { headers: authHeaders() });
  if (!r.ok) throw new Error('No se pudo obtener ganancias mensuales');
  return r.json();
}
async function getTopProductos(year, month, limit=15){
  const url = new URL(`${API}/ganancias/top-productos`);
  url.searchParams.set('year', year);
  url.searchParams.set('month', month);
  url.searchParams.set('limit', String(limit));
  const r = await fetch(url, { headers: authHeaders() });
  if (!r.ok) throw new Error('No se pudo obtener top de productos');
  return r.json();
}

// ===== Render =====
function renderMensual(m){
  kIngVentas.textContent = `$ ${fmt(m.ventas.ingresos_ventas)}`;
  kCogs.textContent      = `$ ${fmt(m.costos.cogs)}`;
  const margenBruto = m.resultados.margen_bruto;
  kBruto.textContent     = `$ ${fmt(margenBruto)}`;
  kBrutoPct.textContent  = `${fmt(m.resultados.margen_bruto_pct)}%`;
  kOpex.textContent      = `$ ${fmt(m.gastos_operativos)}`;
  kNeta.textContent      = `$ ${fmt(m.resultados.ganancia_neta)}`;
  kNetaPct.textContent   = `${fmt(m.resultados.ganancia_neta_pct)}%`;

  rowOtrosIng.textContent = `$ ${fmt(m.otros_ingresos)}`;
  rowEgrComp.textContent  = `$ ${fmt(m.egresos_compras)}`;

  rowCajaIng.textContent  = `$ ${fmt(m.cashflow.ingresos_caja)}`;
  rowCajaEgr.textContent  = `$ ${fmt(m.cashflow.egresos_caja)}`;
  rowCajaNeto.innerHTML   = `<b>$ ${fmt(m.cashflow.neto)}</b>`;
}

function renderTop(data){
  const items = data.data || [];
  topRows.innerHTML = '';
  if (!items.length){
    topRows.innerHTML = `<tr><td colspan="7" class="muted">Sin datos</td></tr>`;
    return;
  }
  items.forEach((it, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${idx+1}</td>
      <td>${it.nombre} <span class="muted">#${it.producto_id}</span></td>
      <td>${it.unidades}</td>
      <td>$ ${fmt(it.ingresos)}</td>
      <td>$ ${fmt(it.cogs)}</td>
      <td>$ ${fmt(it.margen)}</td>
      <td>${fmt(it.margen_pct)}%</td>
    `;
    topRows.appendChild(tr);
  });
}

// ===== Init =====
document.addEventListener('DOMContentLoaded', async () => {
  // usuario
  try{
    const u = await me();
    if (!u){ alert('Sesión inválida'); location.href='login.html'; return; }
    spanUsuario.textContent = `${u.nombre} (${u.rol})`;
  }catch{
    alert('Sesión inválida'); location.href='login.html'; return;
  }

  // year/month por defecto (mes actual y +/- 2 años)
  const now = new Date();
  const curY = now.getFullYear();
  const curM = now.getMonth() + 1;
  for (let y = curY + 1; y >= curY - 2; y--) {
    const op = document.createElement('option');
    op.value = String(y);
    op.textContent = String(y);
    if (y === curY) op.selected = true;
    selYear.appendChild(op);
  }
  selMonth.value = String(curM);

  await aplicar();

  btnBack.addEventListener('click', () => history.back());
  btnAplicar.addEventListener('click', aplicar);
});

async function aplicar(){
  const year  = Number(selYear.value);
  const month = Number(selMonth.value);
  try{
    const [mensual, top] = await Promise.all([
      getMensual(year, month),
      getTopProductos(year, month, 15)
    ]);
    renderMensual(mensual);
    renderTop(top);
  }catch(e){
    console.error(e);
    alert('No se pudieron cargar las ganancias mensuales');
  }
}
