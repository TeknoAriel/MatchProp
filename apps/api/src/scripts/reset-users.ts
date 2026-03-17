/**
 * Borra todos los usuarios, sesiones, identidades y tokens de magic link.
 * Permite login desde cero con email + contraseña (admins Kiteprop).
 * Uso: DATABASE_URL="postgresql://..." pnpm --filter api run reset-users
 * En producción: usar DATABASE_URL de Vercel (Settings → Environment Variables).
 */
import { prisma } from '../lib/prisma.js';

async function main() {
  await prisma.$transaction(
    async (tx) => {
      await tx.user.updateMany({ data: { activeSearchId: null } });
      await tx.magicLinkToken.deleteMany({});
      await tx.session.deleteMany({});
      await tx.userIdentity.deleteMany({});
      await tx.passkeyCredential.deleteMany({});
      await tx.swipeDecision.deleteMany({});
      await tx.savedItem.deleteMany({});
      await tx.savedList.deleteMany({});
      await tx.savedSearch.deleteMany({});
      await tx.alertSubscription.deleteMany({});
      await tx.lead.deleteMany({});
      await tx.orgMember.deleteMany({});
      await tx.orgInvitation.deleteMany({});
      await tx.userProfile.deleteMany({});
      await tx.preference.deleteMany({});
      await tx.swipe.deleteMany({});
      await tx.property.deleteMany({});
      await tx.notification.deleteMany({});
      await tx.authAuditLog.deleteMany({});
      await tx.user.deleteMany({});
    },
    { timeout: 60_000 }
  );
  console.log('OK: todos los usuarios y datos asociados fueron eliminados. Podés hacer login desde cero.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
