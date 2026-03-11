/** Build estable para evitar hydration mismatch. Usar NEXT_PUBLIC_BUILD_ID en prod. */
export const ASSISTANT_BUILD = process.env.NEXT_PUBLIC_BUILD_ID ?? 'dev';
