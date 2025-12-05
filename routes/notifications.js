// routes/notifications.js

const express = require('express');
const router = express.Router();
const webPush = require('web-push');
const PushSubscription = require('../models/PushSubscription');
const { authenticateToken, requireAdmin } = require('../middleware/auth');


// ==========================================
// CONFIGURACIÓN WEB-PUSH
// ==========================================
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webPush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:example@domain.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  console.log('✅ Web Push configurado con claves VAPID');
} else {
  console.warn('⚠️  Claves VAPID no encontradas en .env');
}

// ==========================================
// RUTA: Obtener clave pública VAPID
// ==========================================
router.get('/vapid-public-key', (req, res) => {
  if (!process.env.VAPID_PUBLIC_KEY) {
    return res.status(500).json({
      success: false,
      message: 'Clave pública VAPID no configurada'
    });
  }

  res.json({
    success: true,
    publicKey: process.env.VAPID_PUBLIC_KEY
  });
});

// ==========================================
// RUTA: Guardar suscripción push
// ==========================================
router.post('/subscribe', async (req, res) => {
  try {
    const { subscription, userId, origin } = req.body; // ← Agregar 'origin' aquí
    const requestOrigin = origin || req.headers.origin || 'unknown';

    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({
        success: false,
        message: 'Suscripción inválida'
      });
    }

    let pushSub = await PushSubscription.findOne({
      endpoint: subscription.endpoint
    });

    if (pushSub) {
      pushSub.keys = subscription.keys;
      pushSub.userId = userId || pushSub.userId;
      pushSub.userAgent = req.headers['user-agent'] || '';
      pushSub.origin = origin;
      pushSub.active = true;
      pushSub.lastUsed = new Date();
      await pushSub.save();

      return res.json({
        success: true,
        message: 'Suscripción actualizada',
        subscriptionId: pushSub._id
      });
    }

   pushSub = new PushSubscription({
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      userId: userId || null,
      userAgent: req.headers['user-agent'] || '',
      origin: requestOrigin, // ← Guardar el origin
      active: true
    });

    await pushSub.save();
    console.log('📱 Nueva suscripción push registrada:', pushSub._id);

    res.status(201).json({
      success: true,
      message: 'Suscripción registrada exitosamente',
      subscriptionId: pushSub._id
    });
  } catch (error) {
    console.error('❌ Error guardando suscripción:', error);
    res.status(500).json({
      success: false,
      message: 'Error al guardar la suscripción',
      error: error.message
    });
  }
});

// ==========================================
// RUTA: Eliminar suscripción push
// ==========================================
router.post('/unsubscribe', async (req, res) => {
  try {
    const { endpoint } = req.body;

    if (!endpoint) {
      return res.status(400).json({
        success: false,
        message: 'Endpoint requerido'
      });
    }

    const pushSub = await PushSubscription.findOne({ endpoint });

    if (!pushSub) {
      return res.status(404).json({
        success: false,
        message: 'Suscripción no encontrada'
      });
    }

    await pushSub.deactivate();

    res.json({
      success: true,
      message: 'Suscripción desactivada'
    });
  } catch (error) {
    console.error('❌ Error desactivando suscripción:', error);
    res.status(500).json({
      success: false,
      message: 'Error al desactivar la suscripción',
      error: error.message
    });
  }
});

// ==========================================
// RUTA: Enviar notificación push a todos
// ==========================================
router.post('/send', async (req, res) => {
  try {
    const { title, body, icon, badge, data, tag } = req.body;

    if (!title || !body) {
      return res.status(400).json({
        success: false,
        message: 'Título y cuerpo son requeridos'
      });
    }

    // 🔍 Determinar el origen actual según entorno
    const isProduction = process.env.NODE_ENV === 'production';
    const currentOrigin = isProduction
      ? 'https://pwa-front-rho.vercel.app'
      : 'http://localhost:5173';

    // 🧠 Filtrar solo suscripciones del entorno actual
    const subscriptions = await PushSubscription.find({
      active: true,
      origin: currentOrigin
    });

    if (subscriptions.length === 0) {
      return res.json({
        success: true,
        message: `No hay suscripciones activas para el entorno: ${currentOrigin}`,
        sent: 0
      });
    }

    const payload = JSON.stringify({
      title,
      body,
      icon: icon || '/icon-192x192.png',
      badge: badge || '/icon-72x72.png',
      data: data || {},
      tag: tag || 'default-notification'
    });

    // 📤 Enviar notificaciones solo a este entorno
    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webPush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.keys.p256dh,
                auth: sub.keys.auth
              }
            },
            payload
          );

          await sub.updateLastUsed();
          return { success: true, subscriptionId: sub._id };
        } catch (error) {
          console.error(`❌ Error enviando a ${sub._id}:`, error.message);
          if (error.statusCode === 410) {
            await sub.deactivate();
            console.log(`🗑️ Suscripción ${sub._id} desactivada (410 Gone)`);
          }
          return { success: false, subscriptionId: sub._id, error: error.message };
        }
      })
    );

    const successCount = results.filter(
      (r) => r.status === 'fulfilled' && r.value.success
    ).length;
    const failCount = results.length - successCount;

    console.log(
      `📤 Notificaciones enviadas (${currentOrigin}): ${successCount}/${subscriptions.length}`
    );

    res.json({
      success: true,
      message: 'Notificaciones enviadas',
      total: subscriptions.length,
      sent: successCount,
      failed: failCount
    });
  } catch (error) {
    console.error('❌ Error enviando notificaciones:', error);
    res.status(500).json({
      success: false,
      message: 'Error al enviar notificaciones',
      error: error.message
    });
  }
});

// ==========================================
// RUTA: Enviar notificación a un usuario específico
// ==========================================
router.post('/send', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { title, body, icon, badge, data, tag } = req.body;

    if (!title || !body) {
      return res.status(400).json({
        success: false,
        message: 'Título y cuerpo son requeridos'
      });
    }

    const isProduction = process.env.NODE_ENV === 'production';
    const currentOrigin = isProduction
      ? 'https://pwa-front-rho.vercel.app'
      : 'http://localhost:5173';

    const subscriptions = await PushSubscription.find({
      userId,
      active: true,
      origin: currentOrigin
    });

    if (subscriptions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No hay suscripciones activas para este usuario en este entorno'
      });
    }

    const payload = JSON.stringify({
      title,
      body,
      icon: icon || '/icon-192x192.png',
      badge: badge || '/icon-72x72.png',
      data: data || {},
      tag: tag || 'default-notification'
    });

    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webPush.sendNotification(
            { endpoint: sub.endpoint, keys: sub.keys },
            payload
          );
          await sub.updateLastUsed();
          return { success: true };
        } catch (error) {
          if (error.statusCode === 410) {
            await sub.deactivate();
          }
          return { success: false, error: error.message };
        }
      })
    );

    const successCount = results.filter(
      (r) => r.status === 'fulfilled' && r.value.success
    ).length;

    res.json({
      success: true,
      message: 'Notificación enviada al usuario',
      sent: successCount,
      total: subscriptions.length
    });
  } catch (error) {
    console.error('❌ Error enviando notificación al usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al enviar notificación',
      error: error.message
    });
  }
});

// ==========================================
// RUTA: Obtener estadísticas de suscripciones
// ==========================================
router.get('/stats', async (req, res) => {
  try {
    const total = await PushSubscription.countDocuments();
    const active = await PushSubscription.countDocuments({ active: true });
    const inactive = total - active;

    res.json({
      success: true,
      stats: {
        total,
        active,
        inactive
      }
    });
  } catch (error) {
    console.error('❌ Error obteniendo estadísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas',
      error: error.message
    });
  }
});

module.exports = router;