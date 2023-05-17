import "https://deno.land/std@0.187.0/dotenv/load.ts";
import { Hono } from "https://deno.land/x/hono@v3.2.0-rc.3/mod.ts";
import { serve } from "https://deno.land/std@0.187.0/http/server.ts";
import ytdl from "https://deno.land/x/ytdl_core@v0.1.2/mod.ts";

const app = new Hono();

app.get("/", (ctx) => {
  return ctx.html(`
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/purecss@3.0.0/build/pure-min.css" integrity="sha384-X38yfunGUhNzHpBaEBsWLO+A0HDYOQi8ufWDkZ0k9e0eXz/tH3II7uKZ9msv++Ls" crossorigin="anonymous">
  <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
  <form action="/dl" method="GET" style="padding: 1.5rem" class="pure-form">
    <fieldset>
      <legend>simple ytdl-core frontend built with deno + hono + purecss</legend>
      <label for="url">URL</label>
      <input type="text" id="url" name="url" placeholder="https://www.youtube.com/watch?v=dQw4w9WgXcQ" class="pure-input-1-4" required />
      <button type="submit" class="pure-button pure-button-primary">Download</button>
      <input type="hidden" id="ip" name="ip" />
      <div class="cf-turnstile" data-sitekey="${Deno.env.get(
        "TURNSTILE_SITE_KEY"
      )}" style="margin-top: 2rem;"></div>
    </fieldset>
    <script>
      document.querySelector("form").addEventListener("submit", (e) => {
        e.preventDefault();
        fetch("https://ifconfig.me/ip").then((res) => res.text()).then((ip) => {
          document.querySelector("#ip").value = ip;
        }).then(() => {
          document.querySelector("form").submit();
        });
      });
    </script>
  </form>
  `);
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

  console.log(`Downloading ${url}`);

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
