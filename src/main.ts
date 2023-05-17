import "https://deno.land/std@0.187.0/dotenv/load.ts";
import { Hono } from "https://deno.land/x/hono@v3.2.0-rc.3/mod.ts";
import { serve } from "https://deno.land/std@0.187.0/http/server.ts";
import ytdl from "https://deno.land/x/ytdl_core@v0.1.2/mod.ts";
import * as $ from "https://deno.land/x/scale@v0.11.2/mod.ts";

const app = new Hono();

app.get("/", (ctx) => {
  return ctx.html(
    Deno.readTextFileSync("./index.html").replace(
      "$TURNSTILE_SITE_KEY",
      Deno.env.get("TURNSTILE_SITE_KEY") || ""
    )
  );
});

const $dlFormData = $.object(
  $.field("url", $.str),
  $.field("cf-turnstile-response", $.str),
  $.optionalField("ip", $.str)
);

app.post("/dl", async (ctx) => {
  const dlFormData = Object.fromEntries(await ctx.req.formData());

  if (!$.is($dlFormData, dlFormData)) {
    return ctx.text("Invalid form data");
  }

  const formData = new FormData();
  formData.append("secret", Deno.env.get("TURNSTILE_SECRET_KEY")!);
  formData.append("response", dlFormData["cf-turnstile-response"]);
  formData.append("ip", dlFormData["ip"] || "");

  const turnstileRes: { success: boolean } = await (
    await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      body: formData,
      method: "POST",
    })
  ).json();

  const stream = await ytdl("https://www.youtube.com/watch?v=FjCVsnYbS58", {
    quality: "highestaudio",
  });

  return ctx.newResponse(stream, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Disposition": `attachment; filename="${stream.info.videoDetails.videoId}.mp4"`,
    },
  });
});

serve(app.fetch);
