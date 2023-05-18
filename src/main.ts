import "https://deno.land/std@0.187.0/dotenv/load.ts";
import cheetah from "https://deno.land/x/cheetah@v0.7.1/mod.ts";
import { serve } from "https://deno.land/std@0.187.0/http/server.ts";
import ytdl from "https://deno.land/x/ytdl_core@v0.1.2/mod.ts";
import * as $ from "https://deno.land/x/scale@v0.11.2/mod.ts";

const app = new cheetah();

app.get("/", (ctx) => {
  ctx.res.header("Content-Type", "text/html");
  ctx.res.text(Deno.readTextFileSync("./index.html").replace("$TURNSTILE_SITE_KEY", Deno.env.get("TURNSTILE_SITE_KEY") || ""));
});

const $dlFormData = $.object(
  $.field("url", $.str),
  $.field("cf-turnstile-response", $.str),
  $.optionalField("ip", $.str),
);

app.post("/dl", async (ctx) => {
  const dlFormData = Object.fromEntries(await ctx.req.formData() || []);

  if (!$.is($dlFormData, dlFormData)) {
    return ctx.res.text("Invalid form data");
  }

  const formData = new FormData();
  formData.append("secret", Deno.env.get("TURNSTILE_SECRET_KEY")!);
  formData.append("response", dlFormData["cf-turnstile-response"]);
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

  const stream = await ytdl("https://www.youtube.com/watch?v=FjCVsnYbS58", {
    quality: "highestaudio",
  });

  console.log("Downloading video");

  ctx.res.header("Content-Type", "video/mp4");
  ctx.res.header("Content-Disposition", `attachment; filename="${stream.info.videoDetails.videoId}.mp4"`);
  ctx.res.stream(stream)
});

serve(app.fetch);
