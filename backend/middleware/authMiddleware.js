const jwt = require('jsonwebtoken');

module.exports = function verificarToken(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    return res.status(401).json({ mensaje: 'Token no proporcionado' });
  }

  const token = authHeader.split(' ')[1]; // Formato esperado: "Bearer <token>"

  if (!token) {
    return res.status(401).json({ mensaje: 'Token inválido' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = decoded; // ahora req.usuario.rol, req.usuario.id, etc.
    next();
  } catch (error) {
    return res.status(403).json({ mensaje: 'Token inválido o expirado' });
  }
};
