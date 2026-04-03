#!/usr/bin/env bash
# Avisa si user.email de Git puede disparar rechazo de Vercel (Hobby / team access).
set -e
email=$(git config user.email || true)
if [ -z "$email" ]; then
  echo "⚠️  git user.email no está configurado."
  echo "   Configurá: git config --global user.email \"<mismo email que GitHub y Vercel>\""
  exit 1
fi
case "$email" in
  *@*.local|*@localhost|*"(none)"*)
    echo "⚠️  user.email parece local o no verificable: $email"
    echo "   Vercel puede rechazar deployments (Git author / team access)."
    echo "   Ver docs/DEPLOY_TROUBLESHOOTING.md sección «Git author must have access»."
    echo "   O usá Deploy Hooks + secretos VERCEL_DEPLOY_HOOK_* en GitHub Actions."
    exit 1
    ;;
esac
echo "✓ user.email: $email (revisá que coincida con GitHub y Vercel)."
exit 0
