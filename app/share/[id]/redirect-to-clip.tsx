"use client";

import { useEffect } from "react";

export default function RedirectToClip({ clipId }: { clipId: string }) {
  useEffect(() => {
    const target = new URL("../../", window.location.href);
    target.searchParams.set("clip", clipId);
    window.location.replace(target.toString());
  }, [clipId]);

  return <p>切り抜きサンプラーを開いています…</p>;
}
