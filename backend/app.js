const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// SERVIR IMÁGENES DESDE LA CARPETA CORRECTA
console.log('Carpeta de imagenes:', path.join(__dirname, 'public', 'imagenes_productos'));
app.use('/imagenes_productos', express.static(path.join(__dirname, 'public', 'imagenes_productos')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));


// Importar rutas
const authRoutes = require('./routes/authRoutes');
const usuarioRoutes = require('./routes/usuarioRoutes');
const productoRoutes = require('./routes/productoRoutes');
const varianteRoutes = require('./routes/varianteRoutes');
const ventaRoutes = require('./routes/ventaRoutes');
const proveedorRoutes = require('./routes/proveedorRoutes');
const finanzaRoutes = require('./routes/finanzaRoutes');
const categoriaRoutes = require('./routes/categoriaRoutes');
const pagosRoutes = require('./routes/pagosRoutes');
const inventarioRoutes = require('./routes/inventarioRoutes');
const cajaRoutes = require('./routes/cajaRoutes');
const pedidosRoutes = require('./routes/pedidosRoutes');





// Usar rutas
app.use('/api', authRoutes);
app.use('/api', usuarioRoutes);
app.use('/api', productoRoutes);
app.use('/api', varianteRoutes);
app.use('/api', ventaRoutes);
app.use('/api', proveedorRoutes);
app.use('/api', finanzaRoutes);
app.use('/api', categoriaRoutes);
app.use('/api', pagosRoutes);
app.use('/api/inventario', inventarioRoutes);
app.use('/api/caja', cajaRoutes);
app.use('/api', pedidosRoutes);

// Levantar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
