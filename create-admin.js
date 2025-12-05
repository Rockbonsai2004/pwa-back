// create-admin.js
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');

dotenv.config();

const createAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB');

    const existing = await User.findOne({ username: 'admin' });
    if (existing) {
      console.log('⚠️ El usuario admin ya existe');
      process.exit(0);
    }

    const admin = new User({
      username: 'admin',
      name: 'Administrador',
      email: 'Johan@gmail.com',
      password: '111111',
      role: 'admin'
    });

    await admin.save();
    console.log('✅ Admin creado: admin / admin123');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
};

createAdmin();