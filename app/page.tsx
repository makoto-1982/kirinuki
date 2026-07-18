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

  const shareClip = () => {
    // X_SHARE_FORMAT_V3: 本文とURLの間に必ず空行を入れる。
    // Xのクローラーが切り抜き固有の画像を読める静的シェアページ。
    // 人が開いた場合は /?clip=<id> へ自動で移動します。
    const url = new URL(`share/${encodeURIComponent(active.id)}/`, window.location.href);
    const text = [
      `「${active.clipTitle}」`,
      "",
      "カラタチの #最果てのセンセイ！",
      "切り抜きサンプラーで聴く☺️👉",
      "",
      url.toString(),
    ].join("\n");
    const intent = new URL("https://twitter.com/intent/tweet");
    intent.searchParams.set("text", text);
    window.open(intent.toString(), "_blank", "noopener,noreferrer");
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
            <div className="track-head">
              <button className={`mini-pad mini-play ${active.color} ${playing ? "is-playing" : ""}`} onClick={togglePlayback} aria-label={playing ? "一時停止" : "再生"}>
                <span>{playing ? "Ⅱ" : "▶"}</span>
              </button>
              <div><h2>{active.clipTitle}</h2></div>
            </div>
            <div className="wave" aria-hidden="true">
              <i className={playing ? "moving" : ""}>▂▅▃▇▆▂▅▇▃▆▂▃▇▅▂▆▃▇▂▅▆▃▂▇</i>
            </div>
            <div className="source-episode"><span>EP.{String(active.episode).padStart(3, "0")}</span><strong>{episodeTitle(active.episode)}</strong></div>
            <div className="now-actions">
              <button className={`heart ${favorites.includes(active.id) ? "liked" : ""}`} onClick={() => toggleFavorite(active.id)}><span>♥</span>{favorites.includes(active.id) ? "保存済み" : "お気に入り"}</button>
              <button className="share" onClick={shareClip} aria-label="Xでシェア"><span>𝕏</span>Xでシェア</button>
              <a href={EPISODES[active.episode]?.appleUrl ?? LINKS.apple} target="_blank" rel="noreferrer">本編を聴く <b>→</b></a>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
