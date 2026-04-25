const ALLOWED_ORIGINS = [
  "https://influxpert.cohete-it.com",
  "https://preview--accord-flow-dash.lovable.app",
  "https://accord-flow-dash.lovable.app",
];

// Permite cualquier subdominio *.lovable.app (los previews cambian)
const LOVABLE_PREVIEW_REGEX = /^https:\/\/[a-zA-Z0-9-]+\.lovable\.app$/;

export function getCorsHeaders(origin: string | null): Record<string, string> {
  const isAllowed = !!origin && (
    ALLOWED_ORIGINS.includes(origin) ||
    LOVABLE_PREVIEW_REGEX.test(origin)
  );

  return {
    "Access-Control-Allow-Origin": isAllowed ? origin! : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-api-key",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Vary": "Origin",
  };
}
