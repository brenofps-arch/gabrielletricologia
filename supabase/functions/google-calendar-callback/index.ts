// Recebe o código de autorização do Google e troca por tokens
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state"); // user_id
    const error = url.searchParams.get("error");

    const appOrigin = "https://id-preview--5ce40450-21cb-448f-9fe7-64610f5c261a.lovable.app";

    if (error || !code || !state) {
      return Response.redirect(`${appOrigin}/agenda?google=error`, 302);
    }

    const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID")!;
    const clientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const redirectUri = `${supabaseUrl}/functions/v1/google-calendar-callback`;

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokens = await tokenRes.json();
    if (!tokens.access_token) {
      console.error("Token exchange failed:", tokens);
      return Response.redirect(`${appOrigin}/agenda?google=error`, 302);
    }

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await supabase.from("google_calendar_tokens").upsert({
      user_id: state,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: expiresAt,
      scope: tokens.scope,
    }, { onConflict: "user_id" });

    return Response.redirect(`${appOrigin}/agenda?google=success`, 302);
  } catch (e) {
    console.error("Callback error:", e);
    return new Response("Erro na autorização", { status: 500 });
  }
});
