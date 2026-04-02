#!/usr/bin/env bash
# Vercel "Ignored Build Step" para match-prop-admin.
# Documentación Vercel: exit 0 = omitir build; exit ≠ 0 = ejecutar build.

set -e
if [ -z "${VERCEL_GIT_PREVIOUS_SHA}" ] || [ -z "${VERCEL_GIT_COMMIT_SHA}" ]; then
  exit 1
fi
if git diff --name-only "${VERCEL_GIT_PREVIOUS_SHA}" "${VERCEL_GIT_COMMIT_SHA}" | grep -qE '^(apps/admin|packages/shared|scripts/vercel-should-build-admin\.sh|pnpm-lock\.yaml)'; then
  exit 1
fi
exit 0
