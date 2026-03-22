import { NextResponse } from 'next/server';

const version =
  process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.NEXT_PUBLIC_APP_VERSION ?? 'local';

export async function GET() {
  return NextResponse.json({
    version,
    commit: version,
  });
}
