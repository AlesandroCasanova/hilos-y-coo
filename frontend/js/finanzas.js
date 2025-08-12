// js/finanzas.js
import { obtenerToken } from './utils.js';

const API = 'http://localhost:3000/api';

// ===== Helpers =====
function authHeaders(extra={}){ return { Authorization:'Bearer '+(obtenerToken()||''), 'Content-Type':'application/json', ...extra }; }
function fmt(n){ return Number(n||0).toLocaleString('es-AR',{minimumFractionDigits:2, maximumFractionDigits:2}); }
function ymd(d){ return d.toISOString().slice(0,10); }
function firstOfMonth(d=new Date()){ return new Date(d.getFullYear(), d.getMonth(), 1); }
function lastOfMonth(d=new Date()){ return new Date(d.getFullYear(), d.getMonth()+1, 0, 23,59,59); }
function normalizarRol(rol){ return String(rol||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase(); }
function toast(msg, err=false){
  const n=document.createElement('div');
  n.textContent=msg;
  Object.assign(n.style,{position:'fixed',right:'16px',top:'16px',background:err?'#7f1d1d':'#065f46',color:'#fff',padding:'10px 14px',borderRadius:'10px',zIndex:9999});
  document.body.appendChild(n); setTimeout(()=>n.remove(),2000);
}
function setMoney(id, val){ const el=document.getElementById(id); if(el) el.textContent = `$ ${fmt(val)}`; }
function setText(id, val){ const el=document.getElementById(id); if(el) el.textContent = String(val); }
function yyyymmRange(Y,M){
  const from = new Date(Date.UTC(Y, M-1, 1, 0,0,0));
  const to   = new Date(Date.UTC(Y, M, 0, 23,59,59));
  const iso = d=>d.toISOString().slice(0,19).replace('T',' ');
  return { from: iso(from), to: iso(to), fromDate: iso(from).slice(0,10), toDate: iso(to).slice(0,10) };
}

// ===== State =====
let USER=null;
let ROLE='empleado';
let Y = new Date().getFullYear();
let M = new Date().getMonth()+1;
let TOP_DATA=[];

// ===== DOM =====
const userEl = document.getElementById('usuario-logueado');
const btnSalir = document.getElementById('btn-salir');

// Tabs
const tabBtns = document.querySelectorAll('.tab');
const secResumen   = document.getElementById('sec-resumen');
const secGanancias = document.getElementById('sec-ganancias');
const secMovs      = document.getElementById('sec-movs');
const secReservas  = document.getElementById('sec-reservas');

// Periodo
const anioSel = document.getElementById('anio');
const mesSel  = document.getElementById('mes');
const btnAplicar = document.getElementById('btn-aplicar');
const rangoLabel = document.getElementById('rango-label');

// Ganancias: top productos
const topRows = document.getElementById('top-rows');
const topLimitSel = document.getElementById('top-limit');
const btnExportTop = document.getElementById('btn-export-top');

// Movs
const mDesde = document.getElementById('m-desde');
const mHasta = document.getElementById('m-hasta');
const mCuenta = document.getElementById('m-cuenta');
const mTipo = document.getElementById('m-tipo');
const mBuscar = document.getElementById('m-buscar');
const movRows = document.getElementById('mov-rows');

// Reservas
const rTipo = document.getElementById('r-tipo');
const rMonto = document.getElementById('r-monto');
const rDesc = document.getElementById('r-desc');
const rCrear = document.getElementById('r-crear');
const rLiberar = document.getElementById('r-liberar');
const rDispF = document.getElementById('r-disp-f');
const rDispV = document.getElementById('r-disp-v');

const rhDesde = document.getElementById('rh-desde');
const rhHasta = document.getElementById('rh-hasta');
const rhTipo = document.getElementById('rh-tipo');
const rhMov = document.getElementById('rh-mov');
const rhBuscar = document.getElementById('rh-buscar');
const resRows = document.getElementById('res-rows');

// ===== Auth =====
async function validarSesion(){
  const tok = obtenerToken();
  if(!tok){ alert('Acceso denegado: iniciá sesión.'); location.href='login.html'; return null; }
  try{
    const r = await fetch(`${API}/usuarios/me`, { headers:authHeaders() });
    if(!r.ok) throw 0;
    const d = await r.json();
    return d.usuario || d;
  }catch{
    try{ localStorage.removeItem('token'); localStorage.removeItem('usuario'); }catch{}
    alert('Sesión inválida o expirada. Iniciá sesión.');
    location.href='login.html';
    return null;
  }
}

function setTabsByRole(){
  const rn = normalizarRol(ROLE);
  const isOwner = ['dueno','duenio'].includes(rn); // ← solo Dueño
  const gananciasTabBtn = document.querySelector('.tab[data-tab="ganancias"]');
  if (gananciasTabBtn) gananciasTabBtn.classList.toggle('oculto', !isOwner);
  if(!isOwner && document.querySelector('.tab.active')?.dataset.tab==='ganancias'){ selectTab('resumen'); }
}

// ===== Tabs =====
tabBtns.forEach(b=> b.addEventListener('click', ()=> selectTab(b.dataset.tab)));
function selectTab(name){
  tabBtns.forEach(x=>x.classList.toggle('active', x.dataset.tab===name));
  [secResumen, secGanancias, secMovs, secReservas].forEach(sec=>sec.classList.remove('show'));
  if(name==='resumen')   secResumen.classList.add('show');
  if(name==='ganancias') secGanancias.classList.add('show');
  if(name==='movs')      secMovs.classList.add('show');
  if(name==='reservas')  secReservas.classList.add('show');
}

// ===== Periodo =====
function fillPeriodoSelectors(){
  const now=new Date(); const curY=now.getFullYear();
  anioSel.innerHTML='';
  for(let y=curY-4;y<=curY+1;y++){
    const op=document.createElement('option'); op.value=y; op.textContent=y; if(y===Y) op.selected=true; anioSel.appendChild(op);
  }
  mesSel.innerHTML='';
  for(let m=1;m<=12;m++){
    const op=document.createElement('option'); op.value=m; op.textContent=String(m).padStart(2,'0'); if(m===M) op.selected=true; mesSel.appendChild(op);
  }
  const {fromDate,toDate}=yyyymmRange(Y,M);
  rangoLabel.textContent = `Período: ${fromDate} → ${toDate}`;
}
btnAplicar.addEventListener('click', async ()=>{
  Y = Number(anioSel.value); M = Number(mesSel.value);
  fillPeriodoSelectors();
  await Promise.all([loadSaldos(), loadMensual(), loadTopProductos()]);
});

// ===== Loaders =====
async function loadSaldos(){
  try{
    const r = await fetch(`${API}/finanzas/saldos`, { headers:authHeaders() });
    const d = await r.json();
    if(!r.ok) throw new Error(d?.mensaje || 'Error saldos');

    const fis = Number(d?.caja?.fisica ?? d?.fisica ?? 0);
    const vir = Number(d?.caja?.virtual ?? d?.virtual ?? 0);
    const rf  = Number(d?.reservas?.fisica ?? d?.reservasFisica ?? 0);
    const rv  = Number(d?.reservas?.virtual ?? d?.reservasVirtual ?? 0);

    setMoney('saldo-fisica', fis);
    setMoney('saldo-virtual', vir);
    setMoney('res-fis', rf);
    setMoney('res-vir', rv);
    setMoney('saldo-total', Number(d?.total ?? (fis+vir+rf+rv)));

    // Disponible en card de Reservas
    setMoney('r-disp-f', rf);
    setMoney('r-disp-v', rv);
  }catch(e){ console.error('loadSaldos',e); toast('No se pudieron cargar saldos', true); }
}

async function loadMensual(){
  try{
    const r = await fetch(`${API}/ganancias/mensual?year=${Y}&month=${M}`, { headers:authHeaders() });
    const d = await r.json();
    if(!r.ok) throw new Error(d?.mensaje || 'Error mensual');

    // Cashflow (Resumen + Ganancias)
    const cfIng = Number(d?.cashflow?.ingresos_caja || 0);
    const cfEgr = Number(d?.cashflow?.egresos_caja || 0);
    const cfNet = Number(d?.cashflow?.neto || (cfIng - cfEgr));
    setMoney('cf-ing', cfIng); setMoney('cf-egr', cfEgr); setMoney('cf-neto', cfNet);
    setMoney('g-cf-ing', cfIng); setMoney('g-cf-egr', cfEgr); setMoney('g-cf-net', cfNet);

    // P&L
    const ingresosVentas   = Number(d?.ventas?.ingresos_ventas || 0);
    const cogs             = Number(d?.costos?.cogs || 0);
    const otrosIngresos    = Number(d?.otros_ingresos || 0);
    const opex             = Number(d?.gastos_operativos || 0);
    const egresosCompras   = Number(d?.egresos_compras || 0);

    const margenBruto      = Number(d?.resultados?.margen_bruto || (ingresosVentas - cogs));
    const margenBrutoPct   = Number(d?.resultados?.margen_bruto_pct || (ingresosVentas>0? (margenBruto/ingresosVentas*100):0));
    const gananciaNeta     = Number(d?.resultados?.ganancia_neta || ((ingresosVentas+otrosIngresos)-cogs-opex));
    const gananciaNetaPct  = Number(d?.resultados?.ganancia_neta_pct || ((ingresosVentas+otrosIngresos)>0? (gananciaNeta/(ingresosVentas+otrosIngresos)*100):0));

    // Resumen mini
    setMoney('pl-ventas', ingresosVentas);
    setMoney('pl-cogs', cogs);
    setMoney('pl-otros', otrosIngresos);
    setMoney('pl-opex', opex);
    setMoney('pl-mb', margenBruto);
    setText('pl-mb-pct', `${margenBrutoPct.toFixed(2)}%`);
    setMoney('pl-net', gananciaNeta);
    setText('pl-net-pct', `${gananciaNetaPct.toFixed(2)}%`);

    // Ganancias
    setMoney('g-ventas', ingresosVentas);
    setMoney('g-cogs', cogs);
    setMoney('g-otros', otrosIngresos);
    setMoney('g-opex', opex);
    setMoney('g-mb', margenBruto);
    setText('g-mb-pct', `${margenBrutoPct.toFixed(2)}%`);
    setMoney('g-net', gananciaNeta);
    setText('g-net-pct', `${gananciaNetaPct.toFixed(2)}%`);
    setMoney('g-compras', egresosCompras);

  }catch(e){ console.error('loadMensual',e); toast('No se pudo cargar el P&L del mes', true); }
}

async function loadTopProductos(){
  try{
    const limit = Number(topLimitSel?.value || 15);
    const r = await fetch(`${API}/ganancias/top-productos?year=${Y}&month=${M}&limit=${limit}`, { headers:authHeaders() });
    const d = await r.json();
    if(!r.ok) throw new Error(d?.mensaje || 'Error top productos');
    TOP_DATA = Array.isArray(d?.data) ? d.data : [];
    renderTopProductos(TOP_DATA);
  }catch(e){ console.error('loadTopProductos',e); renderTopProductos([]); }
}
function renderTopProductos(rows){
  topRows.innerHTML='';
  if(!rows.length){ topRows.innerHTML=`<tr><td colspan="7" class="muted">Sin datos</td></tr>`; return; }
  rows.forEach((r,idx)=>{
    const tr=document.createElement('tr');
    const pct = r.ingresos>0 ? (r.margen/r.ingresos*100) : 0;
    tr.innerHTML = `
      <td>${idx+1}</td>
      <td>${r.nombre} <span class="muted">#${r.producto_id}</span></td>
      <td class="right">${fmt(r.unidades)}</td>
      <td class="right">$ ${fmt(r.ingresos)}</td>
      <td class="right">$ ${fmt(r.cogs)}</td>
      <td class="right">$ ${fmt(r.margen)}</td>
      <td class="right">${pct.toFixed(2)}%</td>
    `;
    topRows.appendChild(tr);
  });
}
topLimitSel?.addEventListener('change', loadTopProductos);
btnExportTop?.addEventListener('click', ()=>{
  if(!TOP_DATA.length){ return toast('No hay datos para exportar', true); }
  const head = ['pos','producto_id','nombre','unidades','ingresos','cogs','margen','margen_pct'];
  const lines = [head.join(',')];
  TOP_DATA.forEach((r,i)=>{
    const pct = r.ingresos>0 ? (r.margen/r.ingresos*100) : 0;
    lines.push([i+1, r.producto_id, `"${(r.nombre||'').replace(/"/g,'""')}"`, r.unidades, r.ingresos, r.cogs, r.margen, pct.toFixed(2)].join(','));
  });
  const blob = new Blob([lines.join('\n')], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download=`top_productos_${Y}-${String(M).padStart(2,'0')}.csv`;
  document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); },300);
});

// ===== Movimientos =====
async function loadMovimientos(){
  const desde = mDesde.value, hasta = mHasta.value;
  if(!desde || !hasta){ return toast('Elegí un rango válido', true); }
  movRows.innerHTML = `<tr><td colspan="6" class="muted">Cargando…</td></tr>`;
  try{
    const q = new URLSearchParams({ desde, hasta, cuenta:mCuenta.value, tipo:mTipo.value });
    const r = await fetch(`${API}/movimientos?`+q.toString(), { headers:authHeaders() });
    const rows = await r.json();
    if(!r.ok) throw new Error(rows?.mensaje||'Error movimientos');

    if(!Array.isArray(rows) || !rows.length){
      movRows.innerHTML = `<tr><td colspan="6" class="muted">Sin movimientos</td></tr>`; return;
    }
    movRows.innerHTML='';
    rows.forEach(m=>{
      const tr=document.createElement('tr');
      const f=new Date(m.fecha).toLocaleString('es-AR',{dateStyle:'short',timeStyle:'short'});
      const cuentaTxt = m.cuenta==='caja_fisica'?'Caja física':(m.cuenta==='caja_virtual'?'Caja virtual':m.cuenta||'');
      const ref = [m.referencia_tipo||'', m.referencia_id?('#'+m.referencia_id):''].join(' ').trim();
      const signo = Number(m.signo||0);
      tr.innerHTML = `
        <td>${f}</td>
        <td>${cuentaTxt}</td>
        <td><span class="pill ${m.tipo}">${m.tipo||''}</span></td>
        <td>${m.descripcion||''}</td>
        <td class="muted">${ref}</td>
        <td class="right">${signo<0?'-':''}$ ${fmt(Math.abs(Number(m.monto||0)))}</td>
      `;
      movRows.appendChild(tr);
    });
  }catch(e){
    console.error('loadMovimientos',e);
    movRows.innerHTML = `<tr><td colspan="6" class="muted">No se pudieron cargar los movimientos</td></tr>`;
  }
}
mBuscar.addEventListener('click', loadMovimientos);

// ===== Reservas =====
async function crearOLiberarReserva(liberar=false){
  const tipo = rTipo.value;
  const monto = Number(rMonto.value||0);
  const descripcion = rDesc.value||'';
  if(!tipo || !monto || isNaN(monto) || monto<=0) return toast('Completá tipo y monto válido', true);
  try{
    const url = liberar ? `${API}/reservas/liberar` : `${API}/reservas`;
    const r = await fetch(url,{
      method:'POST',
      headers:authHeaders(),
      body:JSON.stringify({ tipo, monto, descripcion })
    });
    const d = await r.json();
    if(!r.ok) throw new Error(d?.mensaje || 'Error reservas');
    toast(liberar?'Reserva liberada':'Reserva creada');
    rMonto.value=''; rDesc.value='';
    await Promise.all([loadSaldos(), loadMovimientos()]);
  }catch(e){ console.error('reserva',e); toast(e.message, true); }
}
rCrear.addEventListener('click', ()=>crearOLiberarReserva(false));
rLiberar.addEventListener('click', ()=>crearOLiberarReserva(true));

async function loadHistorialReservas(){
  const desde = rhDesde.value, hasta = rhHasta.value;
  if(!desde || !hasta){ return toast('Elegí un rango válido', true); }
  resRows.innerHTML=`<tr><td colspan="6" class="muted">Cargando…</td></tr>`;
  try{
    const q = new URLSearchParams({ desde, hasta, tipo: rhTipo.value, movimiento: rhMov.value });
    const r = await fetch(`${API}/reservas?`+q.toString(), { headers:authHeaders() });
    const rows = await r.json();
    if(!r.ok) throw new Error(rows?.mensaje || 'Error historial reservas');

    if(!Array.isArray(rows) || !rows.length){
      resRows.innerHTML = `<tr><td colspan="6" class="muted">Sin movimientos</td></tr>`; return;
    }
    resRows.innerHTML='';
    rows.forEach(x=>{
      const tr=document.createElement('tr');
      const f=new Date(x.fecha).toLocaleString('es-AR',{dateStyle:'short',timeStyle:'short'});
      const ref=[x.referencia_tipo||'',x.referencia_id?('#'+x.referencia_id):''].join(' ').trim();
      const tipoPill = x.movimiento==='alta' ? 'ingreso' : 'egreso';
      tr.innerHTML = `
        <td>${f}</td>
        <td>${x.tipo==='fisica'?'Física':'Virtual'}</td>
        <td><span class="pill ${tipoPill}">${x.movimiento}</span></td>
        <td class="right">$ ${fmt(x.monto)}</td>
        <td>${x.descripcion||''}</td>
        <td class="muted">${ref}</td>
      `;
      resRows.appendChild(tr);
    });
  }catch(e){ console.error('loadHistorialReservas',e); resRows.innerHTML=`<tr><td colspan="6" class="muted">No se pudo cargar</td></tr>`; }
}
rhBuscar.addEventListener('click', loadHistorialReservas);

// ===== Base =====
btnSalir.addEventListener('click', ()=>{
  localStorage.removeItem('token'); localStorage.removeItem('usuario'); location.href='login.html';
});

// ===== Init =====
document.addEventListener('DOMContentLoaded', async ()=>{
  USER = await validarSesion(); if(!USER) return;
  ROLE = USER.rol || 'Empleado';

  // ---- AUTORIZACIÓN DE ROL (Dueño) ----
  const rn = normalizarRol(ROLE);
  if (!['dueno','duenio'].includes(rn)) {
    alert('Acceso denegado: esta sección es solo para el Dueño.');
    location.href = 'dashboard.html';
    return;
  }
  // -------------------------------------

  if (userEl) userEl.textContent = `${USER.nombre} (${USER.rol})`;
  setTabsByRole();

  // Periodo actual
  Y = new Date().getFullYear(); M = new Date().getMonth()+1;
  fillPeriodoSelectors();

  // Rango por defecto para Movs / Reservas: mes actual
  const d1=firstOfMonth(), d2=lastOfMonth();
  mDesde.value = ymd(d1); mHasta.value = ymd(d2);
  rhDesde.value = ymd(d1); rhHasta.value = ymd(d2);

  await Promise.all([
    loadSaldos(),
    loadMensual(),
    loadTopProductos(),
    loadMovimientos(),
    loadHistorialReservas()
  ]);
});
