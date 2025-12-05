// models/PushSubscription.js

const mongoose = require('mongoose');

const pushSubscriptionSchema = new mongoose.Schema({
  endpoint: {
    type: String,
    required: true,
    unique: true
  },
  keys: {
    p256dh: {
      type: String,
      required: true
    },
    auth: {
      type: String,
      required: true
    }
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  userAgent: {
    type: String,
    default: ''
  },
  origin: {
    type: String,
    default: 'unknown'
  },
  active: {
    type: Boolean,
    default: true
  },
  lastUsed: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Índice para búsquedas rápidas
pushSubscriptionSchema.index({ endpoint: 1 });
pushSubscriptionSchema.index({ userId: 1 });
pushSubscriptionSchema.index({ active: 1 });
pushSubscriptionSchema.index({ origin: 1 });

// Método para marcar como inactiva
pushSubscriptionSchema.methods.deactivate = async function() {
  this.active = false;
  return await this.save();
};

// Método para actualizar último uso
pushSubscriptionSchema.methods.updateLastUsed = async function() {
  this.lastUsed = new Date();
  return await this.save();
};

const PushSubscription = mongoose.model('PushSubscription', pushSubscriptionSchema);

module.exports = PushSubscription;