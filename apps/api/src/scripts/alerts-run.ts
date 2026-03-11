/**
 * Job runner: detecta nuevas publicaciones para alertas y emite notificaciones.
 * Ejecutar: pnpm --filter api alerts:run
 */
import { prisma } from '../lib/prisma.js';
import { runAlerts } from '../lib/alerts-runner.js';

runAlerts()
  .then(() => {
    console.log('Alerts run completed');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Alerts run failed:', err);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
