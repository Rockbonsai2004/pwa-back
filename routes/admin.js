// routes/admin.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const PushSubscription = require('../models/PushSubscription');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const webPush = require('web-push');

router.use(authenticateToken);
router.use(requireAdmin);

// Obtener usuarios suscritos
router.get('/users/subscribed', async (req, res) => {
  try {
    const subscriptions = await PushSubscription.find({ active: true }).distinct('userId');
    const userIds = subscriptions.filter(id => id !== null);
    const users = await User.find({ _id: { $in: userIds } }).select('-password');

    const usersData = await Promise.all(
      users.map(async (user) => {
        const userSubscriptions = await PushSubscription.find({
          userId: user._id,
          active: true
        });

        return {
          id: user._id,
          username: user.username,
          name: user.name,
          email: user.email,
          role: user.role,
          subscriptionCount: userSubscriptions.length
        };
      })
    );

    res.json({
      success: true,
      count: usersData.length,
      users: usersData
    });
  } catch (error) {
    console.error('Error obteniendo usuarios suscritos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener usuarios suscritos'
    });
  }
});

// Enviar notificación a usuario específico
router.post('/send-notification', async (req, res) => {
  try {
    const { userId, title, body, icon } = req.body;

    if (!userId || !title || !body) {
      return res.status(400).json({
        success: false,
        message: 'userId, title y body son requeridos'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    const subscriptions = await PushSubscription.find({
      userId,
      active: true
    });

    if (subscriptions.length === 0) {
      return res.status(404).json({
        success: false,
        message: `El usuario ${user.username} no tiene suscripciones activas`
      });
    }

    const payload = JSON.stringify({
      title,
      body,
      icon: icon || '/icon-192x192.png',
      badge: '/icon-72x72.png',
      tag: 'admin-notification'
    });

    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webPush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: sub.keys
            },
            payload
          );
          await sub.updateLastUsed();
          return { success: true };
        } catch (error) {
          if (error.statusCode === 410) {
            await sub.deactivate();
          }
          return { success: false };
        }
      })
    );

    const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;

    res.json({
      success: true,
      message: `Notificación enviada a ${user.username}`,
      recipient: {
        username: user.username,
        name: user.name
      },
      sent: successCount,
      total: subscriptions.length
    });
  } catch (error) {
    console.error('Error enviando notificación:', error);
    res.status(500).json({
      success: false,
      message: 'Error al enviar notificación'
    });
  }
});

module.exports = router;