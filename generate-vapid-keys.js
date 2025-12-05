// generate-vapid-keys.js
// Ejecuta este archivo una vez con: node generate-vapid-keys.js
// Luego copia las claves a tu archivo .env

const webPush = require('web-push');

const vapidKeys = webPush.generateVAPIDKeys();

console.log('═══════════════════════════════════════════════════════════');
console.log('🔑 CLAVES VAPID GENERADAS');
console.log('═══════════════════════════════════════════════════════════');
console.log('\n📋 Copia estas líneas a tu archivo .env:\n');
console.log(`VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
console.log(`VAPID_SUBJECT=mailto:tu-email@example.com`);
console.log('\n═══════════════════════════════════════════════════════════');
console.log('⚠️  IMPORTANTE: Guarda estas claves de forma segura');
console.log('⚠️  NO las compartas públicamente ni las subas a Git');
console.log('═══════════════════════════════════════════════════════════\n');