import type { Metadata } from "next";
import clipData from "../../../data/clips.json";
import RedirectToClip from "./redirect-to-clip";

type Clip = {
  id: string;
  episode: number;
  clipTitle: string;
};

const clips = clipData as Clip[];
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://makoto-1982.github.io/kirinuki").replace(/\/$/, "");

export const dynamicParams = false;

export function generateStaticParams() {
  return clips.map((clip) => ({ id: clip.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const clip = clips.find((item) => item.id === id);
  if (!clip) return {};

  const title = `「${clip.clipTitle}」｜カラタチの最果てのセンセイ！`;
  const description = "カラタチの最果てのセンセイ！ 切り抜きサンプラーで聴く☺️";
  const imageUrl = `${SITE_URL}/og/${encodeURIComponent(clip.id)}.jpg`;
  const pageUrl = `${SITE_URL}/share/${encodeURIComponent(clip.id)}/`;

  return {
    title,
    description,
    alternates: { canonical: pageUrl },
    openGraph: {
      type: "website",
      url: pageUrl,
      siteName: "カラタチの最果てのセンセイ！ 切り抜きサンプラー",
      title,
      description,
      images: [{ url: imageUrl, width: 1200, height: 630, alt: clip.clipTitle }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default async function SharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const clip = clips.find((item) => item.id === id);
  if (!clip) return <main>切り抜きが見つかりませんでした。</main>;

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <RedirectToClip clipId={clip.id} />
      <noscript>
        <a href={`../../?clip=${encodeURIComponent(clip.id)}`}>「{clip.clipTitle}」を聴く</a>
      </noscript>
    </main>
  );
}
