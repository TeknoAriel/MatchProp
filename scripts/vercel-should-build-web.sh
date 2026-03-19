#!/usr/bin/env bash
# Vercel "Ignored Build Step" para match-prop-web.
# Salida 0 = hacer build, 1 = omitir build.
# Solo construimos web cuando cambian apps/web o packages/shared.

set -e
if [ -z "${VERCEL_GIT_PREVIOUS_SHA}" ] || [ -z "${VERCEL_GIT_COMMIT_SHA}" ]; then
  exit 0
fi
if git diff --name-only "${VERCEL_GIT_PREVIOUS_SHA}" "${VERCEL_GIT_COMMIT_SHA}" | grep -qE '^(apps/web|packages/shared)/'; then
  exit 0
fi
exit 1
