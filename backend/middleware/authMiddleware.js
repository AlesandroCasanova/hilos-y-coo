// backend/middlewares/authMiddleware.js
const jwt = require('jsonwebtoken');

// Extrae el token del header Authorization: Bearer <token>
// (también intenta en x-access-token o cookies.token como fallback)
function obtenerToken(req) {
  const authHeader = req.headers['authorization'] || '';
  if (authHeader) {
    const [scheme, token] = authHeader.split(' ');
    if (scheme && scheme.toLowerCase() === 'bearer' && token) {
      return token.trim();
    }
  }
  // fallbacks opcionales
  if (req.headers['x-access-token']) return String(req.headers['x-access-token']).trim();
  if (req.cookies && req.cookies.token) return String(req.cookies.token).trim();
  return null;
}

function verificarToken(req, res, next) {
  const token = obtenerToken(req);
  if (!token) {
    return res.status(401).json({ mensaje: 'Token no proporcionado' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Payload esperado: { id, rol, nombre, email, iat, exp }
    req.usuario = decoded;
    return next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ mensaje: 'Token expirado' });
    }
    return res.status(401).json({ mensaje: 'Token inválido' });
  }
}

// Middleware adicional para autorizar por rol, sin romper tu import:
// const verificarToken = require('.../authMiddleware');
// router.get('/ruta', verificarToken, verificarToken.requerirRol('Dueño'), handler);
function requerirRol(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.usuario || !req.usuario.rol) {
      return res.status(401).json({ mensaje: 'No autorizado' });
    }
    if (rolesPermitidos.length && !rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({ mensaje: 'No tenés permisos suficientes' });
    }
    next();
  };
}

// Export default compatible + helper como propiedad
verificarToken.requerirRol = requerirRol;
module.exports = verificarToken;
