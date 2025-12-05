// routes/cart.js

const express = require('express');
const router = express.Router();
const Purchase = require('../models/Purchase');

/**
 * POST /api/cart/sync
 * Endpoint utilizado por el Service Worker para sincronizar
 * la cola de ítems del carrito almacenados offline.
 * Ahora soporta sincronización separada por usuario.
 */
router.post('/sync', async (req, res) => {
    try {
        const { items, userId: bodyUserId } = req.body;
        const headerUserId = req.get('X-User-ID');

        // Identificar el usuario principal de esta sincronización
        const mainUserId = bodyUserId || headerUserId;

        console.log(`[Backend: Cart Sync] 🔄 Sincronización iniciada${mainUserId ? ` para usuario: ${mainUserId}` : ''}`);

        // Validación de entrada
        if (!items || !Array.isArray(items)) {
            console.warn('[Backend] Intento de sincronización con datos no válidos.');
            return res.status(400).json({ 
                success: false, 
                message: 'Formato de datos de carrito no válido.' 
            });
        }

        if (items.length === 0) {
            return res.status(200).json({ 
                success: true, 
                message: 'Cola de sincronización vacía, no se requiere acción.' 
            });
        }

        console.log(`[Backend: Cart Sync] 🛒 Recibidos ${items.length} ítems para procesar.`);

        // Procesar cada elemento de la cola
        const processedPurchases = [];
        const errors = [];
        
        for (const item of items) {
            try {
                // Extraer datos del elemento encolado
                const { userId, timestamp, total, items: cartItems, createdAt, ...itemData } = item;
                
                // Validar datos requeridos
                if (!userId || !cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
                    console.warn('[Backend] Elemento de cola con datos incompletos:', {
                        hasUserId: !!userId,
                        hasCartItems: !!cartItems,
                        isArray: Array.isArray(cartItems),
                        itemCount: cartItems?.length || 0
                    });
                    errors.push({
                        item: item,
                        error: 'Datos incompletos'
                    });
                    continue; // Saltar este elemento pero continuar con los demás
                }

                // Verificar que el userId coincida con el usuario principal (seguridad)
                if (mainUserId && userId !== mainUserId) {
                    console.warn(`[Backend: Cart Sync] ⚠️ Usuario no coincide. Esperado: ${mainUserId}, Recibido: ${userId}`);
                }

                // Calcular total si no se proporciona
                const calculatedTotal = total || cartItems.reduce((sum, cartItem) => sum + (cartItem.price || 0), 0);

                // Crear la compra en la base de datos
                const purchase = await Purchase.create({
                    userId,
                    items: cartItems,
                    total: calculatedTotal,
                    timestamp: timestamp || new Date(createdAt || Date.now()),
                    status: 'synced',
                    syncedAt: new Date(),
                    metadata: {
                        ip: req.ip,
                        userAgent: req.get('user-agent'),
                        source: 'offline-sync',
                        queueId: item.id || 'unknown',
                        syncBatchId: Date.now() // Identificador de este lote de sincronización
                    }
                });

                processedPurchases.push({
                    id: purchase._id,
                    userId: purchase.userId,
                    total: purchase.total,
                    itemCount: purchase.items.length,
                    syncedAt: purchase.syncedAt
                });

                console.log(`[Backend: Cart Sync] ✅ Compra sincronizada: ${purchase._id} (Usuario: ${userId})`);

            } catch (itemError) {
                console.error('[Backend: Cart Sync] ❌ Error procesando elemento individual:', itemError.message);
                errors.push({
                    item: item,
                    error: itemError.message
                });
                // Continuar con el siguiente elemento en lugar de fallar completamente
            }
        }

        // Preparar respuesta
        const responseData = {
            success: processedPurchases.length > 0,
            message: processedPurchases.length > 0 
                ? `${processedPurchases.length} compras sincronizadas exitosamente.`
                : 'No se pudo procesar ningún elemento de la cola.',
            processedCount: processedPurchases.length,
            totalReceived: items.length,
            errorCount: errors.length,
            purchases: processedPurchases
        };

        // Agregar información de errores solo en desarrollo
        if (process.env.NODE_ENV === 'development' && errors.length > 0) {
            responseData.errors = errors;
        }

        if (processedPurchases.length === 0) {
            console.warn(`[Backend: Cart Sync] ⚠️ No se procesó ninguna compra de ${items.length} ítems recibidos`);
            return res.status(400).json(responseData);
        }

        console.log(`[Backend: Cart Sync] ✅ ${processedPurchases.length}/${items.length} compras sincronizadas exitosamente para usuario: ${mainUserId || 'múltiples usuarios'}.`);
        
        // Respuesta exitosa
        res.status(200).json(responseData);

    } catch (error) {
        console.error('[Backend: Cart Sync] ❌ Error general al procesar la cola:', error.message);
        console.error('[Backend: Cart Sync] Stack:', error.stack);
        
        // Devolvemos 500 para forzar al Service Worker a mantener los datos y reintentar
        res.status(500).json({ 
            success: false, 
            message: 'Error interno del servidor al procesar la cola.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router;