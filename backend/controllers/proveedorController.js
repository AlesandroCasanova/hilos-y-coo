const db = require('../models/db');

exports.crearProveedor = async (req, res) => {
  const { nombre, contacto } = req.body;
  try {
    await db.query('INSERT INTO proveedores (nombre, contacto) VALUES (?, ?)', [nombre, contacto]);
    res.json({ mensaje: 'Proveedor creado' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al crear proveedor', error });
  }
};

exports.listarProveedores = async (req, res) => {
  try {
    const [proveedores] = await db.query('SELECT * FROM proveedores');
    res.json(proveedores);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al listar proveedores', error });
  }
};

exports.editarProveedor = async (req, res) => {
  const { id } = req.params;
  const { nombre, contacto } = req.body;
  try {
    await db.query('UPDATE proveedores SET nombre = ?, contacto = ? WHERE id = ?', [nombre, contacto, id]);
    res.json({ mensaje: 'Proveedor actualizado' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al editar proveedor', error });
  }
};

exports.eliminarProveedor = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM proveedores WHERE id = ?', [id]);
    res.json({ mensaje: 'Proveedor eliminado' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al eliminar proveedor', error });
  }
};
