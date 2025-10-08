const supabaseUrl = (() => {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw || raw.trim().length === 0) {
    throw new Error('Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL');
  }
  const trimmed = raw.trim();
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error(
      `Invalid NEXT_PUBLIC_SUPABASE_URL. Provide a fully qualified Supabase project URL, received: ${trimmed}`
    );
  }
  if (parsed.protocol !== 'https:') {
    throw new Error('Invalid NEXT_PUBLIC_SUPABASE_URL. Supabase project URLs must use https://');
  }
  if (parsed.search || parsed.hash) {
    throw new Error('Invalid NEXT_PUBLIC_SUPABASE_URL. Remove query strings or fragments.');
  }

  const path = parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/$/, '');
  return `${parsed.origin}${path}`;
})();

const supabaseKey = (() => {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!raw || raw.trim().length === 0) {
    throw new Error('Missing required environment variable: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  }
  return raw.trim();
})();

export const publicEnv = {
  NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: supabaseKey,
};
