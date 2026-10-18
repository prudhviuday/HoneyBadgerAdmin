interface Env {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
}

interface PagesContext {
  env: Env;
}

export const onRequest = ({ env }: PagesContext): Response => {
  // These are public browser credentials. Never expose a service-role or secret key here.
  return Response.json(
    {
      url: env.VITE_SUPABASE_URL ?? "",
      anonKey: env.VITE_SUPABASE_ANON_KEY ?? "",
    },
    {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/json; charset=utf-8",
      },
    },
  );
};
