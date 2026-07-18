/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/favorites" && request.method === "POST") {
      const body = await request.json() as { clipId?: string; deviceId?: string; liked?: boolean };
      if (!body.clipId || !body.deviceId || typeof body.liked !== "boolean") {
        return Response.json({ error: "invalid favorite" }, { status: 400 });
      }
      if (body.liked) {
        await env.DB.prepare("INSERT OR IGNORE INTO favorites (clip_id, device_id) VALUES (?, ?)").bind(body.clipId, body.deviceId).run();
      } else {
        await env.DB.prepare("DELETE FROM favorites WHERE clip_id = ? AND device_id = ?").bind(body.clipId, body.deviceId).run();
      }
      return Response.json({ ok: true });
    }

    if (url.pathname === "/api/rankings" && request.method === "GET") {
      const period = url.searchParams.get("period") === "total" ? "total" : "week";
      const statement = period === "week"
        ? env.DB.prepare("SELECT clip_id AS clipId, COUNT(*) AS count FROM favorites WHERE created_at >= datetime('now', '-7 days') GROUP BY clip_id ORDER BY count DESC")
        : env.DB.prepare("SELECT clip_id AS clipId, COUNT(*) AS count FROM favorites GROUP BY clip_id ORDER BY count DESC");
      const { results } = await statement.all();
      return Response.json({ rankings: results });
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
