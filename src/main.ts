import "https://deno.land/std@0.187.0/dotenv/load.ts";
import cheetah from "https://deno.land/x/cheetah@v0.7.2/mod.ts";
import { serve } from "https://deno.land/std@0.187.0/http/server.ts";
import ytdl from "https://deno.land/x/ytdl_core@v0.1.2/mod.ts";
import * as $ from "https://deno.land/x/scale@v0.11.2/mod.ts";

const app = new cheetah();

const kv = await Deno.openKv();

app.get("/", (ctx) => {
  ctx.res.header("Content-Type", "text/html");
  return Deno.readTextFileSync("./index.html").replace(
    "$TURNSTILE_SITE_KEY",
    Deno.env.get("TURNSTILE_SITE_KEY") || ""
  );
});

app.get("/assets/:asset", (ctx) => {
  ctx.res.header("Cache-Control", "public, max-age=31536000, immutable");
  ctx.res.blob(
    new Blob([Deno.readFileSync(`./assets/${ctx.req.param("asset")}`)])
  );
});

app.get("/count", async () => {
  const res = await kv.get<number>(["dls"]);
  return res.value?.toString();
});

const $dlFormData = $.object(
  $.field("url", $.str),
  $.field("cf-turnstile-response", $.str)
);

app.post("/dl", async (ctx) => {
  const dlFormData = Object.fromEntries((await ctx.req.formData()) || []);

  if (!$.is($dlFormData, dlFormData)) {
    ctx.res.code(400);
    return "Invalid form data";
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

  if (!turnstileRes.success) {
    ctx.res.code(403);
    return "Turnstile verification failed";
  }

  console.log(`${ctx.req.ip} is downloading ${dlFormData.url}`);

  try {
    const stream = await ytdl(dlFormData.url, {
      quality: "highestaudio",
    });

    ctx.res.header("Content-Type", "video/mp4");
    ctx.res.header(
      "Content-Disposition",
      `attachment; filename="${stream.info.videoDetails.videoId}.mp4"`
    );

    await kv.atomic().sum(["dls"], 1n).commit();

    return ctx.res.stream(stream);
  } catch (e) {
    ctx.res.code(400);
    return (e as Error).stack;
  }
});

serve(app.fetch);
