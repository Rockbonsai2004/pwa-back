// config/database.js

const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Verificar que la variable de entorno esté definida
    if (!process.env.MONGODB_URI) {
      console.error('❌ Error: La variable MONGODB_URI no está definida en el archivo .env');
      console.error('📝 Por favor, crea un archivo .env con: MONGODB_URI=mongodb://localhost:27017/rapper-dashboard');
      process.exit(1);
    }

    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`✅ MongoDB Conectado: ${conn.connection.host}`);
    console.log(`📊 Base de datos: ${conn.connection.name}`);
    console.log(`🔗 URI utilizada: ${process.env.MONGODB_URI.replace(/\/\/.*@/, '//***:***@')}`); // Ocultar credenciales en el log
  } catch (error) {
    console.error('❌ Error al conectar a MongoDB:', error.message);
    console.error('💡 Verifica que:');
    console.error('   1. MongoDB esté ejecutándose');
    console.error('   2. La URI en .env sea correcta');
    console.error('   3. Tengas permisos de conexión');
    process.exit(1);
  }
};

// Eventos de conexión
mongoose.connection.on('connected', () => {
  console.log('🔗 Mongoose conectado a MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ Error de conexión de Mongoose:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('🔌 Mongoose desconectado de MongoDB');
});

// Cerrar conexión cuando la app se cierra
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('👋 Conexión de MongoDB cerrada');
  process.exit(0);
});

module.exports = connectDB;