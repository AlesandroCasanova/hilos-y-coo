const db = require('../models/db');
const bcrypt = require('bcrypt');

exports.crearUsuario = async (req, res) => {
  const { nombre, email, contraseña, rol } = req.body;
  try {
    if (!nombre || !email || !contraseña || !rol) {
      return res.status(400).json({ mensaje: 'Todos los campos son obligatorios.' });
    }
    // Verificar si el email ya existe
    const [rows] = await db.query('SELECT * FROM usuarios WHERE email = ?', [email]);
    if (rows.length > 0) {
      return res.status(400).json({ mensaje: 'El email ya existe.' });
    }
    const hash = await bcrypt.hash(contraseña, 10);
    await db.query(
      'INSERT INTO usuarios (nombre, email, contraseña, rol) VALUES (?, ?, ?, ?)',
      [nombre, email, hash, rol]
    );
    res.json({ mensaje: 'Usuario creado' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al crear usuario', error });
  }
};

exports.listarUsuarios = async (req, res) => {
  try {
    const [usuarios] = await db.query('SELECT id, nombre, email, rol FROM usuarios');
    res.json(usuarios);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener usuarios', error });
  }
};

exports.editarUsuario = async (req, res) => {
  const { id } = req.params;
  const { nombre, email, rol } = req.body;
  try {
    await db.query(
      'UPDATE usuarios SET nombre = ?, email = ?, rol = ? WHERE id = ?',
      [nombre, email, rol, id]
    );
    res.json({ mensaje: 'Usuario actualizado' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al actualizar usuario', error });
  }
};

exports.eliminarUsuario = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM usuarios WHERE id = ?', [id]);
    res.json({ mensaje: 'Usuario eliminado' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al eliminar usuario', error });
  }
};
