/**
 * Sprint 10: una pasada del worker push a CRM.
 * Uso: pnpm --filter api crm:push:run
 */
import { prisma } from '../lib/prisma.js';
import { runCrmPushOnce } from '../services/crm-push/worker.js';

runCrmPushOnce()
  .then((r) => {
    console.log(`CrmPush: processed=${r.processed} sent=${r.sent} failed=${r.failed}`);
    if (r.sentIds.length) console.log('  sent (max 10):', r.sentIds.join(', '));
    if (r.failedIds.length) {
      console.log('  failed (max 10):', r.failedIds.join(', '));
      r.failedReasons.forEach((reason, i) => {
        if (r.failedIds[i]) console.log(`    ${r.failedIds[i]}: ${reason}`);
      });
    }
    process.exit(0);
  })
  .catch((err) => {
    console.error('CrmPush failed:', err);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
