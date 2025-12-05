// index.js

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const connectDB = require('./config/database');

// Cargar variables de entorno
dotenv.config();

const app = express();

// ----------------------
// CONFIGURACIÓN DE CORS DINÁMICA
// ----------------------
// Permite múltiples orígenes separados por coma en .env
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',')
  : [];

app.use(
  cors({
    origin: (origin, callback) => {
      // Permitir solicitudes sin 'origin' (por ejemplo, Postman o cURL)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn('❌ CORS bloqueado para origen:', origin);
        callback(new Error('CORS no permitido desde este origen'));
      }
    },
    credentials: true,
  })
);

// ----------------------
// MIDDLEWARES GENERALES
// ----------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Log de peticiones (útil para desarrollo)
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// ----------------------
// RUTAS
// ----------------------
app.use('/api/purchases', require('./routes/purchases'));
app.use('/api/cart', require('./routes/cart'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));



app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Rapper Dashboard API funcionando',
    timestamp: new Date().toISOString(),
    features: {
      pushNotifications: true,
      offlineSync: true,
    },
  });
});

// Manejo de rutas no encontradas
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Ruta no encontrada',
  });
});

// Manejo de errores
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Error interno del servidor',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// ----------------------
// CONEXIÓN A MONGODB Y SERVIDOR
// ----------------------
const PORT = process.env.PORT || 5000;

// Conectar a MongoDB
connectDB();

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`📡 API disponible en http://localhost:${PORT}/api`);
  console.log(`🏥 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔔 Push Notifications: http://localhost:${PORT}/api/notifications`);
});

module.exports = app;
