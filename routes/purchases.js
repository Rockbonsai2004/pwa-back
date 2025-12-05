// routes/purchases.js

const express = require('express');
const router = express.Router();
const Purchase = require('../models/Purchase');

// ===========================
// RUTAS PUBLICAS (offline-first)
// ===========================

// @route   POST /api/purchases
// @desc    Crear nueva compra (desde front o sync)
// @access  Public (para permitir sync offline sin auth)
router.post('/', async (req, res) => {
  try {
    const { items, userId, timestamp, total, syncedAt } = req.body;

    // Validar datos requeridos
    if (!items || !userId || !total) {
      return res.status(400).json({
        success: false,
        message: 'Faltan datos requeridos: items, userId, total'
      });
    }

    // Validar que items sea un array y no esté vacío
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Items debe ser un array con al menos un elemento'
      });
    }

    // Determinar si es una compra sincronizada o directa
    const source = syncedAt ? 'offline-sync' : 'online';

    // Crear la compra
    const purchase = await Purchase.create({
      userId,
      items,
      total,
      timestamp: timestamp || new Date(),
      syncedAt: syncedAt || null,
      status: syncedAt ? 'synced' : 'completed',
      metadata: {
        ip: req.ip,
        userAgent: req.get('user-agent'),
        source
      }
    });

    console.log(`✅ Compra creada: ${purchase._id} (${source})`);

    res.status(201).json({
      success: true,
      message: 'Compra registrada exitosamente',
      data: {
        purchase: {
          id: purchase._id,
          userId: purchase.userId,
          total: purchase.total,
          itemCount: purchase.items.length,
          status: purchase.status,
          createdAt: purchase.createdAt,
          source: purchase.metadata.source
        }
      }
    });
  } catch (error) {
    console.error('❌ Error al crear compra:', error);
    res.status(500).json({
      success: false,
      message: 'Error al procesar la compra',
      error: error.message
    });
  }
});

// ===========================
// RUTAS DE LECTURA OPCIONALES
// ===========================

// @route   GET /api/purchases
// @desc    Obtener todas las compras
// @access  Opcionalmente pública, puedes usarla para debug o stats
router.get('/', async (req, res) => {
  try {
    const purchases = await Purchase.find().sort({ createdAt: -1 });
    res.json({
      success: true,
      data: purchases
    });
  } catch (error) {
    console.error('Error al obtener compras:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener compras',
      error: error.message
    });
  }
});

// @route   GET /api/purchases/:id
// @desc    Obtener una compra específica
// @access  Opcionalmente pública, útil para debug
router.get('/:id', async (req, res) => {
  try {
    const purchase = await Purchase.findById(req.params.id);
    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: 'Compra no encontrada'
      });
    }

    res.json({
      success: true,
      data: purchase
    });
  } catch (error) {
    console.error('Error al obtener compra:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener la compra',
      error: error.message
    });
  }
});

module.exports = router;
