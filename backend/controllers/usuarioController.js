// backend/controllers/usuarioController.js
const db = require('../models/db');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

/**
 * Crear PRIMER usuario como "duenio".
 * - Sin token.
 * - Si ya existe algún usuario, bloquea la creación.
 * - Fuerza rol = 'duenio' (coincide con enum de la BD).
 */
exports.registroDuenio = async (req, res) => {
  try {
    const { nombre, email, contraseña } = req.body;

    if (!nombre || !email || !contraseña) {
      return res.status(400).json({ mensaje: 'Todos los campos son obligatorios.' });
    }

    // ¿Ya existe algún usuario?
    const [existe] = await db.query('SELECT id FROM usuarios LIMIT 1');
    if (existe.length > 0) {
      return res.status(409).json({ mensaje: 'Ya existe un usuario en el sistema.' });
    }

    // ¿Email duplicado?
    const [dup] = await db.query('SELECT id FROM usuarios WHERE email = ?', [email]);
    if (dup.length > 0) {
      return res.status(400).json({ mensaje: 'El email ya existe.' });
    }

    const hash = await bcrypt.hash(contraseña, SALT_ROUNDS);
    await db.query(
      'INSERT INTO usuarios (nombre, email, contraseña, rol) VALUES (?, ?, ?, ?)',
      [nombre, email, hash, 'duenio']
    );

    return res.status(201).json({ mensaje: 'Dueño creado con éxito' });
  } catch (error) {
    console.error('Error registroDuenio:', error);
    return res.status(500).json({ mensaje: 'Error del servidor' });
  }
};

// ABM protegido: crear usuario (usa enum 'duenio' | 'empleado')
exports.crearUsuario = async (req, res) => {
  const { nombre, email, contraseña, rol } = req.body;
  try {
    if (!nombre || !email || !contraseña || !rol) {
      return res.status(400).json({ mensaje: 'Todos los campos son obligatorios.' });
    }
    if (!['duenio', 'empleado'].includes(rol)) {
      return res.status(400).json({ mensaje: 'Rol inválido.' });
    }

    const [rows] = await db.query('SELECT id FROM usuarios WHERE email = ?', [email]);
    if (rows.length > 0) {
      return res.status(400).json({ mensaje: 'El email ya existe.' });
    }

    const hash = await bcrypt.hash(contraseña, SALT_ROUNDS);
    await db.query(
      'INSERT INTO usuarios (nombre, email, contraseña, rol) VALUES (?, ?, ?, ?)',
      [nombre, email, hash, rol]
    );
    res.json({ mensaje: 'Usuario creado' });
  } catch (error) {
    console.error('Error al crear usuario:', error);
    res.status(500).json({ mensaje: 'Error al crear usuario' });
  }
};

// Listar usuarios
exports.listarUsuarios = async (req, res) => {
  try {
    const [usuarios] = await db.query('SELECT id, nombre, email, rol FROM usuarios');
    res.json(usuarios);
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({ mensaje: 'Error al obtener usuarios' });
  }
};

// Editar usuario
exports.editarUsuario = async (req, res) => {
  const { id } = req.params;
  const { nombre, email, rol } = req.body;
  try {
    if (!['duenio', 'empleado'].includes(rol)) {
      return res.status(400).json({ mensaje: 'Rol inválido.' });
    }
    await db.query(
      'UPDATE usuarios SET nombre = ?, email = ?, rol = ? WHERE id = ?',
      [nombre, email, rol, id]
    );
    res.json({ mensaje: 'Usuario actualizado' });
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({ mensaje: 'Error al actualizar usuario' });
  }
};

// Eliminar usuario
exports.eliminarUsuario = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM usuarios WHERE id = ?', [id]);
    res.json({ mensaje: 'Usuario eliminado' });
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    res.status(500).json({ mensaje: 'Error al eliminar usuario' });
  }
};

// Usuario actual desde token
exports.me = async (req, res) => {
  try {
    const id = req.usuario?.id;
    if (!id) return res.status(401).json({ mensaje: 'No autorizado' });

    const [rows] = await db.query(
      'SELECT id, nombre, email, rol FROM usuarios WHERE id = ? LIMIT 1',
      [id]
    );
    if (!rows || rows.length === 0) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }
    res.status(200).json({ usuario: rows[0] });
  } catch (error) {
    console.error('Error en usuarios.me:', error);
    res.status(500).json({ mensaje: 'Error del servidor' });
  }
};
