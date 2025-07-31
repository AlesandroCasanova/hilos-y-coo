const db = require('../models/db');

exports.crearCategoria = async (req, res) => {
  const { nombre } = req.body;
  try {
    await db.query('INSERT INTO categorias (nombre) VALUES (?)', [nombre]);
    res.json({ mensaje: 'Categoría creada' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al crear categoría', error });
  }
};

exports.listarCategorias = async (req, res) => {
  try {
    const [categorias] = await db.query('SELECT * FROM categorias');
    res.json(categorias);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al listar categorías', error });
  }
};

exports.editarCategoria = async (req, res) => {
  const { id } = req.params;
  const { nombre } = req.body;
  try {
    await db.query('UPDATE categorias SET nombre = ? WHERE id = ?', [nombre, id]);
    res.json({ mensaje: 'Categoría actualizada' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al actualizar categoría', error });
  }
};

exports.eliminarCategoria = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM categorias WHERE id = ?', [id]);
    res.json({ mensaje: 'Categoría eliminada' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al eliminar categoría', error });
  }
};
