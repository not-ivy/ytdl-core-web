import "https://deno.land/std@0.187.0/dotenv/load.ts";
import cheetah from "https://deno.land/x/cheetah@v0.7.1/mod.ts";
import { serve } from "https://deno.land/std@0.187.0/http/server.ts";
import ytdl from "https://deno.land/x/ytdl_core@v0.1.2/mod.ts";
import zod, { z } from 'https://deno.land/x/cheetah@v0.7.1/validator/zod.ts'

const app = new cheetah({ validator: zod });

app.get("/", (ctx) => {
  ctx.res.header("Content-Type", "text/html");
  ctx.res.text(Deno.readTextFileSync("./index.html").replace("$TURNSTILE_SITE_KEY", Deno.env.get("TURNSTILE_SITE_KEY") || ""));
});

app.post("/dl", {
  body: z.object({
    url: z.string(),
    "cf-turnstile-response": z.string(),
  })
}, async (ctx) => {
  const formData = new FormData();
  formData.append("secret", Deno.env.get("TURNSTILE_SECRET_KEY")!);
  formData.append("response", ctx.req.body["cf-turnstile-response"]);
  formData.append("ip", ctx.req.ip || "");

  const turnstileRes: { success: boolean } = await (
    await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      body: formData,
      method: "POST",
    })
  ).json();

  console.log("Verified turnstile");

  if (!turnstileRes.success) {
    ctx.res.text("Turnstile verification failed");
  }

  const stream = await ytdl(ctx.req.body.url, {
    quality: "highestaudio",
  });

  console.log("Downloading video");

  ctx.res.header("Content-Type", "video/mp4");
  ctx.res.header("Content-Disposition", `attachment; filename="${stream.info.videoDetails.videoId}.mp4"`);
  ctx.res.stream(stream)
});

serve(app.fetch);
