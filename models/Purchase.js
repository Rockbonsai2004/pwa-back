// models/Purchase.js

const mongoose = require('mongoose');

const purchaseItemSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  songName: {
    type: String,
    required: true
  },
  albumName: {
    type: String,
    required: true
  },
  artist: {
    type: String,
    required: true
  },
  albumCover: {
    type: String,
    required: true
  },
  year: {
    type: Number,
    required: true
  },
  price: {
    type: Number,
    required: true
  }
});

const purchaseSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: [true, 'El ID de usuario es requerido'],
    index: true
  },
  items: {
    type: [purchaseItemSchema],
    required: [true, 'Los items son requeridos'],
    validate: {
      validator: function(items) {
        return items.length > 0;
      },
      message: 'Debe haber al menos un item en la compra'
    }
  },
  total: {
    type: Number,
    required: [true, 'El total es requerido'],
    min: [0, 'El total debe ser mayor a 0']
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'cancelled', 'synced'],
    default: 'completed'
  },
  timestamp: {
    type: Date,
    required: true,
    default: Date.now
  },
  syncedAt: {
    type: Date
  },
  savedAt: {
    type: Date
  },
  // Metadatos adicionales
  metadata: {
    ip: String,
    userAgent: String,
    source: {
      type: String,
      enum: ['online', 'offline-sync'],
      default: 'online'
    }
  }
}, {
  timestamps: true
});

// Índices para mejorar las búsquedas
purchaseSchema.index({ userId: 1, createdAt: -1 });
purchaseSchema.index({ status: 1 });
purchaseSchema.index({ timestamp: -1 });

// Virtual para contar items
purchaseSchema.virtual('itemCount').get(function() {
  return this.items.length;
});

// Método para marcar como sincronizado
purchaseSchema.methods.markAsSynced = function() {
  this.status = 'synced';
  this.syncedAt = new Date();
  return this.save();
};

// Método estático para obtener compras de un usuario
purchaseSchema.statics.findByUserId = function(userId, options = {}) {
  const query = this.find({ userId });
  
  if (options.limit) query.limit(options.limit);
  if (options.skip) query.skip(options.skip);
  if (options.status) query.where('status').equals(options.status);
  
  return query.sort({ createdAt: -1 });
};

// Método estático para obtener estadísticas
purchaseSchema.statics.getStatsByUser = async function(userId) {
  const stats = await this.aggregate([
    { $match: { userId } },
    {
      $group: {
        _id: '$userId',
        totalPurchases: { $sum: 1 },
        totalSpent: { $sum: '$total' },
        totalItems: { $sum: { $size: '$items' } },
        averageSpent: { $avg: '$total' }
      }
    }
  ]);

  return stats[0] || {
    totalPurchases: 0,
    totalSpent: 0,
    totalItems: 0,
    averageSpent: 0
  };
};

// Middleware pre-save para validar total
purchaseSchema.pre('save', function(next) {
  // Calcular total basado en items
  const calculatedTotal = this.items.reduce((sum, item) => sum + item.price, 0);
  
  // Validar que el total coincida (con margen de error de centavos)
  if (Math.abs(this.total - calculatedTotal) > 0.01) {
    return next(new Error('El total no coincide con la suma de los items'));
  }
  
  next();
});

const Purchase = mongoose.model('Purchase', purchaseSchema);

module.exports = Purchase;