// utils.js
// Archivo de utilidades centralizadas para Hilos y Coo

//---------------------------------------------
// 1. Obtener token JWT desde localStorage
//---------------------------------------------
export function obtenerToken() {
    return localStorage.getItem('token');
}

//---------------------------------------------
// 2. Fetch con token JWT automáticamente
//---------------------------------------------
export async function fetchConToken(url, options = {}) {
    const token = obtenerToken();
    options.headers = options.headers || {};
    options.headers['Authorization'] = 'Bearer ' + token;
    return fetch(url, options);
}

//---------------------------------------------
// 3. Mostrar mensajes (éxito/error/info)
export function mostrarMensaje(mensaje, tipo = "info") {
    // Crea o reutiliza un contenedor de mensajes flotante
    let cont = document.getElementById("mensaje-flotante");
    if (!cont) {
        cont = document.createElement("div");
        cont.id = "mensaje-flotante";
        cont.style.position = "fixed";
        cont.style.top = "20px";
        cont.style.right = "20px";
        cont.style.zIndex = "9999";
        cont.style.minWidth = "180px";
        cont.style.padding = "15px 20px";
        cont.style.borderRadius = "8px";
        cont.style.fontWeight = "bold";
        cont.style.color = "#fff";
        cont.style.boxShadow = "0 2px 10px rgba(0,0,0,0.2)";
        document.body.appendChild(cont);
    }
    if (tipo === "exito") cont.style.background = "#43a047";
    else if (tipo === "error") cont.style.background = "#e53935";
    else cont.style.background = "#1e88e5";

    cont.textContent = mensaje;
    cont.style.display = "block";
    setTimeout(() => { cont.style.display = "none"; }, 2400);
}

//---------------------------------------------
// 4. Logout global: chequea estado de caja antes de salir
//---------------------------------------------
export async function logout() {
    const token = obtenerToken();
    try {
        // Consultar estado de caja física
        const res = await fetch('http://localhost:3000/api/caja/estado/fisica', {
            headers: { Authorization: 'Bearer ' + token }
        });
        const data = await res.json();

        // Si está abierta, NO permite logout
        if (data.abierta) {
            mostrarMensaje("Debés cerrar la caja física antes de salir.", "error");
            return;
        }
        // Si está cerrada, limpia y sale
        localStorage.clear();
        window.location.href = "login.html";
    } catch (err) {
        // Si hay error en el servidor, igual permite salir (opcional)
        localStorage.clear();
        window.location.href = "login.html";
    }
}

//---------------------------------------------
// 5. Validaciones comunes de formulario
//---------------------------------------------
export function camposVacios(obj) {
    // obj: {campo: valor, campo2: valor2, ...}
    for (let key in obj) {
        if (!obj[key] || obj[key].toString().trim() === "") return true;
    }
    return false;
}
export function esEmailValido(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
// Puedes agregar más validaciones acá según necesites

//---------------------------------------------
// 6. Cargar fragmentos HTML comunes (nav, footer, etc.)
export function cargarFragmento(idElemento, urlFragmento) {
    // Ejemplo: cargarFragmento("miNav", "nav.html");
    fetch(urlFragmento)
        .then(r => r.text())
        .then(html => document.getElementById(idElemento).innerHTML = html);
}
