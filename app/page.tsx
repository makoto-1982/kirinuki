"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import saihateLogo from "../public/saihate-logo.png";
import episodeData from "../data/episodes.json";
import clipData from "../data/clips.json";

type Clip = { id: string; episode: number; clipTitle: string; color: "orange" | "lime" | "sky"; audioUrl: string };

// 回ごとの情報はここへ一度だけ登録します。
// 同じ回から切り抜きを何本作っても、タイトルと本編リンクは自動で共有されます。
const EPISODES = Object.fromEntries(
  episodeData.map((episode) => [episode.episode, { title: episode.title, audioUrl: episode.audioUrl, appleUrl: episode.appleUrl }]),
) as Record<number, { title: string; audioUrl: string; appleUrl: string }>;

const episodeTitle = (episode: number) => EPISODES[episode]?.title ?? `第${episode}回`;

const ALL_CLIPS = clipData as Clip[];

const RANKING_API_BASE = "https://kirinuki-ranking-api.goodtimes1982.workers.dev";

const LINKS = {
  apple: "https://podcasts.apple.com/jp/podcast/%E3%82%AB%E3%83%A9%E3%82%BF%E3%81%AE%E6%9C%80%E6%9E%9C%E3%81%A6%E3%81%AE%E3%82%BB%E3%83%B3%E3%82%BB%E3%82%A4/id1680512344",
  spotify: "https://open.spotify.com/show/6REiZN6eLqyhikBNXX2b8N?si=d9d6ff0427544cbb",
  youtube: "https://www.youtube.com/playlist?list=PLcopHZdckrjT63rBpTPrzCa59g-0cWOmf",
};

function shuffle<T>(items: T[]) { return [...items].sort(() => Math.random() - .5); }

export default function Home() {
  const [clips, setClips] = useState(() => ALL_CLIPS.slice(0, 8));
  const [active, setActive] = useState<Clip>(ALL_CLIPS[0]);
  const [playing, setPlaying] = useState(false);
  const [shareFeedback, setShareFeedback] = useState("シェア");
  const audioRef = useRef<HTMLAudioElement>(null);
  const [favorites, setFavorites] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    const saved = localStorage.getItem("saihate-favorites");
    return saved ? JSON.parse(saved) : [];
  });
  const [view, setView] = useState<"sampler" | "favorites" | "ranking">("sampler");
  const [rankingPeriod, setRankingPeriod] = useState<"week" | "total">("week");
  const [rankingCounts, setRankingCounts] = useState<Record<string, number>>({});
  const [deviceId] = useState(() => {
    if (typeof window === "undefined") return "";
    const saved = localStorage.getItem("saihate-device-id");
    if (saved) return saved;
    const created = crypto.randomUUID();
    localStorage.setItem("saihate-device-id", created);
    return created;
  });

  useEffect(() => {
    const sharedId = new URLSearchParams(window.location.search).get("clip");
    const sharedClip = ALL_CLIPS.find((clip) => clip.id === sharedId);
    const initialClips = sharedClip
      ? [sharedClip, ...shuffle(ALL_CLIPS.filter((clip) => clip.id !== sharedClip.id)).slice(0, 7)]
      : shuffle(ALL_CLIPS).slice(0, 8);
    setClips(initialClips);
    setActive(sharedClip ?? initialClips[0]);
  }, []);

  useEffect(() => {
    if (view !== "ranking") return;
    let cancelled = false;
    fetch(`${RANKING_API_BASE}/api/rankings?period=${rankingPeriod}`)
      .then((response) => response.json())
      .then((data: { rankings?: { clipId: string; count: number }[] }) => {
        if (cancelled) return;
        setRankingCounts(Object.fromEntries((data.rankings ?? []).map((item) => [item.clipId, Number(item.count)])));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [view, rankingPeriod]);

  const toggleFavorite = (id: string) => {
    setFavorites((current) => {
      const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
      localStorage.setItem("saihate-favorites", JSON.stringify(next));
      const liked = next.includes(id);
      if (deviceId) {
        fetch(`${RANKING_API_BASE}/api/favorites`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ clipId: id, deviceId, liked }) }).catch(() => {});
      }
      return next;
    });
  };

  const visibleClips = useMemo(() => {
    if (view === "favorites") return ALL_CLIPS.filter((clip) => favorites.includes(clip.id));
    if (view === "ranking") return [...ALL_CLIPS].sort((a, b) => (rankingCounts[b.id] ?? 0) - (rankingCounts[a.id] ?? 0)).slice(0, 8);
    return clips;
  }, [view, clips, favorites, rankingCounts]);

  const choose = (clip: Clip) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    if (active.id !== clip.id || !audio.src) {
      audio.src = clip.audioUrl;
      audio.load();
      setActive(clip);
    } else {
      audio.currentTime = 0;
    }
    audio.play().catch(() => setPlaying(false));
  };

  const togglePlayback = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) audio.pause();
    else {
      if (!audio.src) {
        audio.src = active.audioUrl;
        audio.load();
      }
      audio.play().catch(() => setPlaying(false));
    }
  };

  const createShareCard = async (clip: Clip): Promise<File | null> => {
    try {
      await document.fonts.ready;
      const canvas = document.createElement("canvas");
      canvas.width = 1200;
      canvas.height = 630;
      const context = canvas.getContext("2d");
      if (!context) return null;

      context.fillStyle = "#07163d";
      context.fillRect(0, 0, 1200, 630);
      context.fillStyle = "#315085";
      for (let x = 28; x < 1200; x += 36) {
        for (let y = 28; y < 630; y += 36) context.fillRect(x, y, 3, 3);
      }

      context.fillStyle = "#fff1ce";
      context.beginPath();
      context.roundRect(48, 42, 1104, 546, 42);
      context.fill();

      const logo = new window.Image();
      logo.src = saihateLogo.src;
      await new Promise<void>((resolve, reject) => {
        logo.onload = () => resolve();
        logo.onerror = () => reject(new Error("logo load failed"));
      });
      context.drawImage(logo, 82, 72, 420, 153);

      context.fillStyle = "#ff6435";
      context.fillRect(82, 264, 12, 210);
      context.fillStyle = "#07163d";
      context.font = '800 28px "M PLUS Rounded 1c", sans-serif';
      context.fillText(`EP.${String(clip.episode).padStart(3, "0")}  切り抜き`, 122, 300);

      const words = Array.from(clip.clipTitle);
      const lines: string[] = [];
      let line = "";
      context.font = '800 54px "M PLUS Rounded 1c", sans-serif';
      for (const word of words) {
        const candidate = line + word;
        if (context.measureText(candidate).width > 900 && line) {
          lines.push(line);
          line = word;
        } else line = candidate;
      }
      if (line) lines.push(line);
      lines.slice(0, 3).forEach((text, index) => context.fillText(text, 122, 374 + index * 70));

      context.fillStyle = "#536180";
      context.font = '700 23px "M PLUS Rounded 1c", sans-serif';
      context.fillText("saihate-sensei.com/kirinuki/", 760, 548);

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      return blob ? new File([blob], `${clip.id}.png`, { type: "image/png" }) : null;
    } catch {
      return null;
    }
  };

  const shareClip = async () => {
    const url = new URL(window.location.href);
    url.search = "";
    url.hash = "";
    url.searchParams.set("clip", active.id);
    const title = `「${active.clipTitle}」｜カラタチの最果てのセンセイ！`;
    const text = `「${active.clipTitle}」\nカラタチの最果てのセンセイ！ 切り抜きサンプラー`;

    try {
      const card = await createShareCard(active);
      const shareData: ShareData = { title, text, url: url.toString() };
      if (card && navigator.canShare?.({ files: [card] })) shareData.files = [card];
      if (navigator.share) {
        await navigator.share(shareData);
        setShareFeedback("シェア済み");
      } else {
        await navigator.clipboard.writeText(url.toString());
        setShareFeedback("コピー済み");
      }
    } catch (error) {
      if ((error as DOMException).name !== "AbortError") {
        await navigator.clipboard.writeText(url.toString()).catch(() => {});
        setShareFeedback("コピー済み");
      }
    }
    window.setTimeout(() => setShareFeedback("シェア"), 1800);
  };

  return (
    <main className="site-shell">
      <audio
        ref={audioRef}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
      <header className="topbar">
        <button className="brand" onClick={() => setView("sampler")}>
          <Image src={saihateLogo} alt="カラタチの最果てのセンセイ！" width={2048} height={746} priority />
        </button>
        <nav className="primary-nav" aria-label="メインメニュー">
          <button className={view === "favorites" ? "active" : ""} onClick={() => setView("favorites")}>♥ お気に入り</button>
          <button className={view === "ranking" ? "active" : ""} onClick={() => setView("ranking")}>🏆 ランキング</button>
        </nav>
        <div className="platforms">
          <a href={LINKS.apple} target="_blank" rel="noreferrer">Apple</a>
          <a href={LINKS.spotify} target="_blank" rel="noreferrer">Spotify</a>
          <a href={LINKS.youtube} target="_blank" rel="noreferrer">YouTube</a>
          <a href="https://saihate-sensei.com/">TOP</a>
        </div>
      </header>

      <section className="machine">
        <div className="machine-title">
          <span className="equalizer">▂▅▇▃▆</span>
          <div><h1>{view === "sampler" ? "切り抜きサンプラー" : view === "favorites" ? "お気に入り" : "人気ランキング"}</h1>{view === "ranking" && <div className="ranking-tabs"><button className={rankingPeriod === "week" ? "active" : ""} onClick={() => setRankingPeriod("week")}>今週</button><button className={rankingPeriod === "total" ? "active" : ""} onClick={() => setRankingPeriod("total")}>累計</button></div>}</div>
          <span className="equalizer">▆▃▇▅▂</span>
        </div>

        <div className="machine-grid">
          <div className="left-panel">
            {visibleClips.length ? <div className="pads">
              {visibleClips.map((clip, index) => (
                <button key={clip.id} className={`pad ${clip.color} ${active.id === clip.id && playing ? "is-playing" : ""}`} onClick={() => choose(clip)}>
                  <span className="pad-number">{String(index + 1).padStart(2, "0")}</span>
                  <span className="pad-title">{clip.clipTitle}</span>
                  <span className="play-icon">▶</span>
                  <span className="episode">ep.{String(clip.episode).padStart(3, "0")}</span>
                  {favorites.includes(clip.id) && <span className="pad-favorite" aria-label="お気に入り済み">♥</span>}
                </button>
              ))}
            </div> : <div className="empty">まだお気に入りがありません。<br />サンプラーでハートを押してみよう！</div>}

            {view === "sampler" && <button className="shuffle" onClick={() => { setClips(shuffle(ALL_CLIPS).slice(0, 8)); setPlaying(false); }}><span>↝</span> 8個を入れ替える</button>}
            {view !== "sampler" && <button className="shuffle compact" onClick={() => setView("sampler")}>サンプラーへ戻る</button>}
          </div>

          <aside className="now-playing">
            <div className="now-label">{playing ? "再生中" : "スタンバイ"}</div>
            <div className="track-head"><span className={`mini-pad ${active.color}`}>♪</span><div><h2>{active.clipTitle}</h2></div></div>
            <button className="wave" onClick={togglePlayback} aria-label={playing ? "一時停止" : "再生"}>
              <span>{playing ? "Ⅱ" : "▶"}</span><i className={playing ? "moving" : ""}>▂▅▃▇▆▂▅▇▃▆▂▃▇▅▂▆▃▇▂▅▆▃▂▇</i>
            </button>
            <div className="source-episode"><span>EP.{String(active.episode).padStart(3, "0")}</span><strong>{episodeTitle(active.episode)}</strong></div>
            <div className="now-actions">
              <button className={`heart ${favorites.includes(active.id) ? "liked" : ""}`} onClick={() => toggleFavorite(active.id)}><span>♥</span>{favorites.includes(active.id) ? "保存済み" : "お気に入り"}</button>
              <button className="share" onClick={shareClip}><span>↗</span>{shareFeedback}</button>
              <a href={EPISODES[active.episode]?.appleUrl ?? LINKS.apple} target="_blank" rel="noreferrer">本編を聴く <b>→</b></a>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
