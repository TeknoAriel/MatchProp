# shellcheck shell=bash
# Nombres canónicos de proyectos Vercel (validación en workflow CLI).
# Alineado con docs/INFRAESTRUCTURA_VERCEL.md
#
# Uso: source scripts/matchprop-production-canonical.env.sh

export MATCHPROP_VERCEL_API_PROJECT_NAME="${MATCHPROP_VERCEL_API_PROJECT_NAME:-match-prop-api-1jte}"
export MATCHPROP_VERCEL_WEB_PROJECT_NAME="${MATCHPROP_VERCEL_WEB_PROJECT_NAME:-match-prop-web}"
export MATCHPROP_VERCEL_ADMIN_PROJECT_NAME="${MATCHPROP_VERCEL_ADMIN_PROJECT_NAME:-match-prop-admin}"
