import "https://deno.land/std@0.187.0/dotenv/load.ts";
import { Hono } from "https://deno.land/x/hono@v3.2.0-rc.3/mod.ts";
import { serve } from "https://deno.land/std@0.187.0/http/server.ts";
import ytdl from "https://deno.land/x/ytdl_core@v0.1.2/mod.ts";

const app = new Hono();

app.get("/", (ctx) => {
  return ctx.html(
    Deno.readTextFileSync("./index.html").replace(
      "$TURNSTILE_SITE_KEY",
      Deno.env.get("TURNSTILE_SITE_KEY") || ""
    )
  );
});

app.get("/dl", async (ctx) => {
  const url = ctx.req.query("url");
  if (!url) return ctx.text("No url provided");
  const cfTurnstileResponse = ctx.req.query("cf-turnstile-response");
  if (!cfTurnstileResponse)
    return ctx.text("No cf-turnstile-response provided");
  const ip = ctx.req.query("ip");

  const formData = new FormData();
  formData.append("secret", Deno.env.get("TURNSTILE_SECRET_KEY")!);
  formData.append("response", cfTurnstileResponse);
  ip ? formData.append("ip", ip) : null;

  const turnstileRes = await (
    await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      body: formData,
      method: "POST",
    })
  ).json();

  if (!turnstileRes.success) return ctx.text("Turnstile verification failed");

  console.log(`${ip} is downloading ${url}`);

  const stream = await ytdl(url, {
    quality: "highestaudio",
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "video/mp4",
    },
  });
});

serve(app.fetch);
