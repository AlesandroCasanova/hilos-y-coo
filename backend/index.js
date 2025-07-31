import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import usuariosRoutes from './routes/usuarios.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Ruta de prueba
app.get('/api/ping', (req, res) => {
  res.json({ mensaje: 'El backend responde correctamente 🎉' });
});

// Rutas de usuarios: /api/usuarios/registro y /api/usuarios/login
app.use('/api/usuarios', usuariosRoutes);

app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});
