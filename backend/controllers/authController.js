const db = require('../models/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

/**
 * LOGIN: Apertura automática de caja física solo si no hay ninguna abierta en todo el sistema.
 * NO registra movimiento de ingreso extra.
 */
exports.login = async (req, res) => {
  const { email, contraseña } = req.body;

  try {
    const [rows] = await db.query('SELECT * FROM usuarios WHERE email = ?', [email]);
    if (rows.length === 0) {
      return res.status(401).json({ mensaje: 'Email no registrado' });
    }
    const usuario = rows[0];

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

    // Registrar inicio de sesión (historial)
    await db.query(
      'INSERT INTO sesiones_empleados (usuario_id, fecha_hora_inicio, ip) VALUES (?, NOW(), ?)',
      [usuario.id, req.ip || null]
    );

    // --- APERTURA AUTOMÁTICA DE CAJA FÍSICA SOLO SI NO HAY ABIERTA (GLOBAL, NO POR USUARIO) ---
    const [cajaAbierta] = await db.query(
      `SELECT a.id FROM caja_aperturas a
       LEFT JOIN caja_cierres c ON a.id = c.apertura_id
       WHERE a.tipo_caja = 'fisica' AND c.id IS NULL
       LIMIT 1`
    );
    if (cajaAbierta.length === 0) {
      // Buscar último cierre para saldo inicial
      const [ultimoCierre] = await db.query(
        `SELECT monto_final FROM caja_cierres 
        JOIN caja_aperturas ON caja_cierres.apertura_id = caja_aperturas.id
        WHERE caja_aperturas.tipo_caja = 'fisica'
        ORDER BY caja_cierres.fecha DESC LIMIT 1`
      );
      const monto_inicial = ultimoCierre.length > 0 ? Number(ultimoCierre[0].monto_final) : 0;

      // Registrar apertura de caja física
      await db.query(
        `INSERT INTO caja_aperturas (usuario_id, tipo_caja, monto_inicial) VALUES (?, ?, ?)`,
        [usuario.id, 'fisica', monto_inicial]
      );
      // *** NO REGISTRAR MOVIMIENTO DE INGRESO EXTRA ***
    }
    // FIN chequeo de apertura automática

    res.json({
      mensaje: 'Login exitoso',
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol
      }
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al iniciar sesión', error });
  }
};

// Registrar cierre de sesión (llamar en el logout del frontend)
exports.logout = async (req, res) => {
  try {
    const usuario_id = req.usuario.id;
    // Buscar la última sesión abierta de este usuario
    const [rows] = await db.query(
      `SELECT id FROM sesiones_empleados WHERE usuario_id = ? AND fecha_hora_cierre IS NULL ORDER BY fecha_hora_inicio DESC LIMIT 1`,
      [usuario_id]
    );
    if (rows.length > 0) {
      const sesion_id = rows[0].id;
      await db.query(
        `UPDATE sesiones_empleados SET fecha_hora_cierre = NOW() WHERE id = ?`,
        [sesion_id]
      );
    }
    res.json({ mensaje: 'Logout registrado correctamente' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al registrar cierre de sesión', error });
  }
};

exports.perfil = async (req, res) => {
  const id = req.usuario.id;
  try {
    const [rows] = await db.query('SELECT id, nombre, email, rol FROM usuarios WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener perfil', error });
  }
};

exports.actualizarPerfil = async (req, res) => {
  const id = req.usuario.id;
  const { nombre, email, contraseña } = req.body;

  try {
    let query = 'UPDATE usuarios SET nombre = ?, email = ?';
    const params = [nombre, email];
    if (contraseña) {
      const hash = await bcrypt.hash(contraseña, 10);
      query += ', contraseña = ?';
      params.push(hash);
    }
    query += ' WHERE id = ?';
    params.push(id);

    await db.query(query, params);

    res.json({ mensaje: 'Perfil actualizado correctamente' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al actualizar perfil', error });
  }
};

exports.registrarPrimerDueño = async (req, res) => {
  const { nombre, email, contraseña } = req.body;
  if (!nombre || !email || !contraseña) {
    return res.status(400).json({ error: 'Faltan datos' });
  }
  try {
    const [usuariosExistentes] = await db.query(
      "SELECT COUNT(*) AS total FROM usuarios WHERE rol = 'Dueño'"
    );
    if (usuariosExistentes[0].total > 0) {
      return res.status(403).json({ error: 'Ya hay un usuario con rol Dueño registrado' });
    }
    const hashed = await bcrypt.hash(contraseña, 10);
    const sql = 'INSERT INTO usuarios (nombre, email, contraseña, rol) VALUES (?, ?, ?, ?)';
    await db.query(sql, [nombre, email, hashed, 'Dueño']);
    res.json({ mensaje: 'Usuario Dueño creado correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al registrar usuario', detalle: error });
  }
};
