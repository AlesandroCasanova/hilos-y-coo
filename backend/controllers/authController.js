const db = require('../models/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// --- LOGIN ---
exports.login = async (req, res) => {
  const { email, contraseña } = req.body;

  try {
    // Buscar usuario
    const [rows] = await db.query('SELECT * FROM usuarios WHERE email = ?', [email]);
    if (rows.length === 0) {
      return res.status(401).json({ mensaje: 'Email no registrado' });
    }
    const usuario = rows[0];

    // Validar contraseña
    const coincide = await bcrypt.compare(contraseña, usuario.contraseña);
    if (!coincide) {
      return res.status(401).json({ mensaje: 'Contraseña incorrecta' });
    }

    // Crear token JWT
    const token = jwt.sign(
      { id: usuario.id, rol: usuario.rol, nombre: usuario.nombre },
      process.env.JWT_SECRET,
      { expiresIn: '4h' }
    );

    // --- Apertura automática de caja física si está cerrada ---
    const [cajaAbierta] = await db.query(
      `SELECT * FROM sesiones_caja 
       WHERE tipo = 'fisica' AND estado = 'abierta'
       ORDER BY fecha_apertura DESC
       LIMIT 1`
    );

    if (cajaAbierta.length === 0) {
      // Buscar último cierre para obtener monto final como inicial
      const [ultimoCierre] = await db.query(
        `SELECT monto_final FROM sesiones_caja 
         WHERE tipo = 'fisica' AND estado = 'cerrada'
         ORDER BY fecha_cierre DESC
         LIMIT 1`
      );
      const montoInicial = ultimoCierre.length > 0 ? ultimoCierre[0].monto_final : 0;

      await db.query(
        `INSERT INTO sesiones_caja (tipo, usuario_id_apertura, monto_inicial, estado)
         VALUES ('fisica', ?, ?, 'abierta')`,
        [usuario.id, montoInicial]
      );
    }

    res.status(200).json({
      mensaje: 'Inicio de sesión exitoso',
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        rol: usuario.rol
      }
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ mensaje: 'Error en el servidor', error: error.message });
  }
};

// --- REGISTRO ---
exports.registro = async (req, res) => {
  const { nombre, email, contraseña, rol } = req.body;

  try {
    // Verificar si el email ya está registrado
    const [existe] = await db.query('SELECT * FROM usuarios WHERE email = ?', [email]);
    if (existe.length > 0) {
      return res.status(400).json({ mensaje: 'El email ya está registrado' });
    }

    // Encriptar contraseña
    const hashed = await bcrypt.hash(contraseña, 10);

    // Guardar nuevo usuario
    await db.query(
      `INSERT INTO usuarios (nombre, email, contraseña, rol)
       VALUES (?, ?, ?, ?)`,
      [nombre, email, hashed, rol || 'cliente']
    );

    res.status(201).json({ mensaje: 'Usuario registrado exitosamente' });
  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({ mensaje: 'Error en el servidor', error: error.message });
  }
};
