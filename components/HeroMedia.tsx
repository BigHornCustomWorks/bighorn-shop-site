"use client";

import { useEffect, useState } from "react";

const KEY = "bhcw-hero-played";

export function HeroMedia({ photo, video }: { photo: string; video: string }) {
  const still = photo || "/hero.jpg";
  const [play, setPlay] = useState(false);

  useEffect(() => {
    if (!video) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    try {
      if (new URLSearchParams(window.location.search).get("hero") === "1") {
        setPlay(true);
        return;
      }
      if (localStorage.getItem(KEY) === "1") return;
    } catch {
      return;
    }
    setPlay(true);
  }, [video]);

  function done() {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
    setPlay(false);
  }

  return (
    <section className="hero">
      {play && video ? (
        <video
          className="hero-photo"
          src={video}
          poster={still}
          autoPlay
          muted
          playsInline
          onEnded={done}
          onError={done}
        />
      ) : (
        <img className="hero-photo" src={still} alt="" />
      )}
    </section>
  );
}
