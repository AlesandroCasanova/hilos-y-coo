-- Crear base de datos
CREATE DATABASE IF NOT EXISTS hilosycoo;
USE hilosycoo;

-- Tabla de usuarios
CREATE TABLE usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100),
  email VARCHAR(100) UNIQUE,
  contraseña VARCHAR(255),
  rol ENUM('Dueño', 'Empleado') DEFAULT 'Empleado'
);

-- Tabla de proveedores
CREATE TABLE proveedores (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100),
  contacto VARCHAR(100)
);

-- Tabla de productos
CREATE TABLE productos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100),
  descripcion TEXT,
  codigo VARCHAR(50) UNIQUE,
  categoria VARCHAR(50),
  proveedor_id INT,
  precio_proveedor DECIMAL(10,2),
  precio DECIMAL(10,2),
  imagen VARCHAR(255),
  activo TINYINT(1) NOT NULL DEFAULT 1,
  FOREIGN KEY (proveedor_id) REFERENCES proveedores(id)
);

-- Tabla de variantes
CREATE TABLE variantes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  producto_id INT,
  talle VARCHAR(20),
  color VARCHAR(30),
  stock INT,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  FOREIGN KEY (producto_id) REFERENCES productos(id)
);

-- Historial de precios
CREATE TABLE historial_precios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  producto_id INT NOT NULL,
  precio_anterior DECIMAL(10,2),
  precio_nuevo DECIMAL(10,2),
  fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
  usuario_id INT,
  FOREIGN KEY (producto_id) REFERENCES productos(id)
);

-- Historial de stock
CREATE TABLE historial_stock (
  id INT AUTO_INCREMENT PRIMARY KEY,
  variante_id INT,
  tipo_movimiento ENUM('Ingreso', 'Egreso', 'Ajuste'),
  cantidad INT,
  motivo VARCHAR(100),
  fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (variante_id) REFERENCES variantes(id)
);

-- Ajustes de inventario
CREATE TABLE ajustes_inventario (
  id INT AUTO_INCREMENT PRIMARY KEY,
  variante_id INT,
  stock_anterior INT,
  stock_nuevo INT,
  motivo VARCHAR(100),
  usuario_id INT,
  fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (variante_id) REFERENCES variantes(id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- Carrito
CREATE TABLE carrito (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT,
  variante_id INT,
  cantidad INT,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  FOREIGN KEY (variante_id) REFERENCES variantes(id)
);

-- Ventas
CREATE TABLE ventas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT,
  fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
  total DECIMAL(10,2),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- Detalle venta
CREATE TABLE detalle_venta (
  id INT AUTO_INCREMENT PRIMARY KEY,
  venta_id INT,
  variante_id INT,
  cantidad INT,
  precio_unitario DECIMAL(10,2),
  FOREIGN KEY (venta_id) REFERENCES ventas(id),
  FOREIGN KEY (variante_id) REFERENCES variantes(id)
);

-- Cuotas de venta
CREATE TABLE cuotas_venta (
  id INT AUTO_INCREMENT PRIMARY KEY,
  venta_id INT,
  nro_cuota INT,
  monto DECIMAL(10,2),
  fecha_vencimiento DATE,
  pagada BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (venta_id) REFERENCES ventas(id)
);

-- Finanzas
CREATE TABLE finanzas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tipo ENUM('Ingreso', 'Gasto'),
  descripcion VARCHAR(255),
  monto DECIMAL(10,2),
  monto_liberado DECIMAL(10,2) DEFAULT 0,
  fecha DATETIME NOT NULL,
  es_reserva BOOLEAN DEFAULT 0,
  categoria VARCHAR(100),
  entidad VARCHAR(100),
  concepto VARCHAR(150),
  caja_tipo VARCHAR(20),
  usuario_id INT,
  liberada DATETIME DEFAULT NULL
);

-- Pagos a empleados
CREATE TABLE empleados_pagos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empleado_id INT,
  monto DECIMAL(10,2),
  concepto VARCHAR(100),
  fecha DATE,
  descripcion VARCHAR(255),
  FOREIGN KEY (empleado_id) REFERENCES usuarios(id)
);

-- Pedidos a proveedores
CREATE TABLE pedidos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  proveedor_id INT,
  fecha DATE,
  total DECIMAL(10,2),
  estado ENUM('Pendiente', 'Recibido', 'Pagado') DEFAULT 'Pendiente',
  FOREIGN KEY (proveedor_id) REFERENCES proveedores(id)
);

-- Pagos a proveedores
CREATE TABLE proveedores_pagos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  proveedor_id INT,
  monto DECIMAL(10,2),
  fecha DATE DEFAULT CURRENT_DATE,
  descripcion VARCHAR(255),
  concepto VARCHAR(100),
  FOREIGN KEY (proveedor_id) REFERENCES proveedores(id)
);

-- Categorías
CREATE TABLE categorias (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(50) UNIQUE
);

-- Relación producto-categoría
CREATE TABLE producto_categoria (
  id INT AUTO_INCREMENT PRIMARY KEY,
  producto_id INT,
  categoria_id INT,
  FOREIGN KEY (producto_id) REFERENCES productos(id),
  FOREIGN KEY (categoria_id) REFERENCES categorias(id)
);

-- Notas internas
CREATE TABLE notas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  titulo VARCHAR(100),
  contenido TEXT,
  autor_id INT,
  fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (autor_id) REFERENCES usuarios(id)
);

-- Logs del sistema
CREATE TABLE logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT,
  accion VARCHAR(255),
  fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- Reportes generados
CREATE TABLE reportes_generados (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tipo_reporte VARCHAR(100),
  usuario_id INT,
  fecha_generado DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- Descuentos
CREATE TABLE descuentos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tipo ENUM('Producto', 'Categoría', 'Proveedor'),
  ref_id INT,
  porcentaje DECIMAL(5,2),
  desde DATE,
  hasta DATE
);

-- Configuraciones del sistema
CREATE TABLE configuraciones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  clave VARCHAR(50) UNIQUE,
  valor TEXT
);

-- Caja - aperturas
CREATE TABLE caja_aperturas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  tipo_caja ENUM('fisica', 'virtual') NOT NULL,
  monto_inicial DECIMAL(10,2) NOT NULL,
  fecha_apertura DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- Caja - cierres
CREATE TABLE caja_cierres (
  id INT AUTO_INCREMENT PRIMARY KEY,
  apertura_id INT NOT NULL,
  usuario_id INT NOT NULL,
  monto_final DECIMAL(10,2) NOT NULL,
  fecha_cierre DATETIME DEFAULT CURRENT_TIMESTAMP,
  fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (apertura_id) REFERENCES caja_aperturas(id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- Movimientos de caja
CREATE TABLE movimientos_caja (
  id INT AUTO_INCREMENT PRIMARY KEY,
  venta_id INT,
  tipo ENUM('ingreso', 'egreso') NOT NULL,
  descripcion VARCHAR(255),
  monto DECIMAL(10,2) NOT NULL,
  metodo_pago ENUM('efectivo', 'transferencia', 'debito', 'credito', 'mixto') NOT NULL,
  caja_tipo ENUM('fisica', 'virtual') NOT NULL,
  fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
  usuario_id INT NOT NULL,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  FOREIGN KEY (venta_id) REFERENCES ventas(id)
);

-- Otros pagos
CREATE TABLE otros_pagos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  entidad VARCHAR(100),
  concepto VARCHAR(100),
  monto DECIMAL(12,2),
  descripcion VARCHAR(255),
  fecha DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Impuestos pagos
CREATE TABLE impuestos_pagos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  entidad VARCHAR(100),
  concepto VARCHAR(100),
  monto DECIMAL(12,2),
  descripcion VARCHAR(255),
  fecha DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sesiones empleados
CREATE TABLE sesiones_empleados (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  fecha_hora_inicio DATETIME NOT NULL,
  fecha_hora_cierre DATETIME,
  ip VARCHAR(45),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);
ALTER TABLE variantes
ADD CONSTRAINT chk_stock_positivo CHECK (stock >= 0);

UPDATE variantes SET stock = 0 WHERE stock < 0;

SELECT v.*, p.nombre, p.imagen
FROM variantes v
JOIN productos p ON v.producto_id = p.id
WHERE v.activo = 1;


ALTER TABLE movimientos_caja MODIFY COLUMN venta_id INT NULL;

ALTER TABLE movimientos_caja
MODIFY COLUMN venta_id INT NULL;


SELECT * FROM movimientos_caja
ORDER BY id DESC
LIMIT 10;


SELECT id, tipo, categoria, monto, caja_tipo, es_reserva, liberada 
FROM finanzas 
WHERE es_reserva = 1;


SELECT * FROM movimientos_caja
WHERE caja_tipo = 'fisica'
ORDER BY fecha DESC
LIMIT 10;

DELETE FROM movimientos_caja WHERE descripcion LIKE '%reserva%';
DELETE FROM finanzas WHERE es_reserva = 1;

SELECT * FROM movimientos_caja WHERE caja_tipo = 'fisica';

DROP DATABASE hilosycoo


-- =========================================================
--  Ledger en Español - Caja/Reservas/Saldos por movimientos
--  Fecha: 2025-08-07
-- =========================================================

-- 1) Movimientos de dinero en cajas (física/virtual)
CREATE TABLE IF NOT EXISTS movimientos_caja (
  id INT AUTO_INCREMENT PRIMARY KEY,
  fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  usuario_id INT NULL,
  cuenta ENUM('caja_fisica','caja_virtual') NOT NULL,
  tipo ENUM('ingreso','egreso','transferencia','reserva','ajuste') NOT NULL,
  signo TINYINT NOT NULL,                -- +1 ingreso / -1 egreso
  monto DECIMAL(14,2) NOT NULL CHECK (monto >= 0),
  referencia_tipo VARCHAR(50) NULL,      -- venta | pago | pedido | cierre | etc
  referencia_id INT NULL,
  descripcion VARCHAR(255) NULL,
  INDEX idx_cuenta_fecha (cuenta, fecha),
  INDEX idx_ref (referencia_tipo, referencia_id)
) ENGINE=InnoDB;

-- 2) Movimientos de reservas (altas/liberaciones; el disponible = altas - liberaciones)
CREATE TABLE IF NOT EXISTS movimientos_reserva (
  id INT AUTO_INCREMENT PRIMARY KEY,
  fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  usuario_id INT NULL,
  tipo ENUM('fisica','virtual') NOT NULL,
  movimiento ENUM('alta','liberacion') NOT NULL,
  monto DECIMAL(14,2) NOT NULL CHECK (monto >= 0),
  referencia_tipo VARCHAR(50) NULL,      -- cierre, manual, pedido, etc
  referencia_id INT NULL,
  descripcion VARCHAR(255) NULL,
  INDEX idx_tipo_fecha (tipo, fecha)
) ENGINE=InnoDB;

-- 3) Sesiones de caja física (aperturas/cierres) - la virtual no requiere sesión
CREATE TABLE IF NOT EXISTS sesiones_caja (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tipo ENUM('fisica') NOT NULL DEFAULT 'fisica',
  fecha_apertura DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  usuario_id_apertura INT NOT NULL,
  monto_inicial DECIMAL(14,2) NOT NULL DEFAULT 0,
  fecha_cierre DATETIME NULL,
  usuario_id_cierre INT NULL,
  monto_final DECIMAL(14,2) NULL,
  estado ENUM('abierta','cerrada') NOT NULL DEFAULT 'abierta'
) ENGINE=InnoDB;

-- 4) Vistas de saldos actuales (cajas + reservas)
DROP VIEW IF EXISTS vista_saldo_cajas;
CREATE VIEW vista_saldo_cajas AS
SELECT
  IFNULL(SUM(CASE WHEN cuenta = 'caja_fisica' THEN signo * monto ELSE 0 END),0) AS caja_fisica,
  IFNULL(SUM(CASE WHEN cuenta = 'caja_virtual' THEN signo * monto ELSE 0 END),0) AS caja_virtual
FROM movimientos_caja;

DROP VIEW IF EXISTS vista_reservas_disponibles;
CREATE VIEW vista_reservas_disponibles AS
SELECT
  IFNULL(SUM(CASE WHEN tipo='fisica'  AND movimiento='alta'       THEN monto ELSE 0 END) -
         SUM(CASE WHEN tipo='fisica'  AND movimiento='liberacion' THEN monto ELSE 0 END), 0) AS reservas_fisica,
  IFNULL(SUM(CASE WHEN tipo='virtual' AND movimiento='alta'       THEN monto ELSE 0 END) -
         SUM(CASE WHEN tipo='virtual' AND movimiento='liberacion' THEN monto ELSE 0 END), 0) AS reservas_virtual
FROM movimientos_reserva;


ALTER TABLE movimientos_caja
ADD COLUMN sesion_id INT NULL,
ADD FOREIGN KEY (sesion_id) REFERENCES sesiones_caja(id);

CREATE TABLE IF NOT EXISTS devoluciones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  venta_id INT NOT NULL,
  usuario_id INT NULL,
  fecha DATETIME NOT NULL,
  caja_tipo ENUM('fisica','virtual') NOT NULL,
  motivo VARCHAR(255) DEFAULT '',
  total_reintegro DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_diferencia DECIMAL(12,2) NOT NULL DEFAULT 0,
  observaciones TEXT,
  INDEX (venta_id)
);

CREATE TABLE IF NOT EXISTS devolucion_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  devolucion_id INT NOT NULL,
  venta_item_id INT NOT NULL,
  producto_id INT NOT NULL,
  variante_id_devuelta INT NOT NULL,
  cantidad_devuelta DECIMAL(10,2) NOT NULL,
  precio_unit_devuelto DECIMAL(12,2) NOT NULL,
  subtotal_devuelto DECIMAL(12,2) NOT NULL,
  variante_id_entregada INT NULL,
  cantidad_entregada DECIMAL(10,2) NULL,
  precio_unit_entregado DECIMAL(12,2) NULL,
  subtotal_entregado DECIMAL(12,2) NULL,
  INDEX (devolucion_id),
  INDEX (venta_item_id)
);

-- Log de inventario (si no lo tenés)
CREATE TABLE IF NOT EXISTS inventario_movimientos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  fecha DATETIME NOT NULL,
  producto_id INT NOT NULL,
  variante_id INT NOT NULL,
  tipo VARCHAR(50) NOT NULL,
  cantidad DECIMAL(10,2) NOT NULL,
  referencia_tipo VARCHAR(50) NULL,
  referencia_id INT NULL,
  INDEX (variante_id)
);

-- Movimientos de caja (formato que tu UI de caja ya espera)
CREATE TABLE IF NOT EXISTS caja_movimientos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  fecha DATETIME NOT NULL,
  cuenta ENUM('caja_fisica','caja_virtual') NOT NULL,
  tipo VARCHAR(80) NOT NULL,           -- 'devolucion' | 'diferencia por cambio'
  signo TINYINT NOT NULL,              -- +1 ingreso, -1 egreso
  monto DECIMAL(12,2) NOT NULL,
  descripcion VARCHAR(255) NULL,
  referencia_tipo VARCHAR(50) NULL,
  referencia_id INT NULL,
  INDEX (fecha),
  INDEX (referencia_tipo, referencia_id)
);
