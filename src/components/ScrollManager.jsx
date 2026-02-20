import { useEffect } from "react";
import { useLocation } from "react-router-dom";

function getStickyOffset() {
  if (typeof window === "undefined") return 0;
  const landingHeader = document.querySelector(".landing-nav");
  const platformHeader = document.querySelector(".platform-header");
  const header = landingHeader || platformHeader;
  const rect = header?.getBoundingClientRect();
  return Math.max(0, Math.round((rect?.height || 0) + 10));
}

function scrollToHash(hash, behavior = "auto") {
  if (typeof window === "undefined" || !hash) return false;
  const id = decodeURIComponent(String(hash || "").replace(/^#/, "")).trim();
  if (!id) return false;
  const el = document.getElementById(id);
  if (!el) return false;
  const top = window.scrollY + el.getBoundingClientRect().top - getStickyOffset();
  window.scrollTo({ top: Math.max(0, top), left: 0, behavior });
  return true;
}

export default function ScrollManager() {
  const { pathname, search, hash } = useLocation();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname, search, hash]);

  useEffect(() => {
    if (!hash || typeof window === "undefined") return;
    let frame = 0;
    let tries = 0;

    const run = () => {
      const done = scrollToHash(hash, "auto");
      if (done) return;
      if (tries >= 12) {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
        return;
      }
      tries += 1;
      frame = window.requestAnimationFrame(run);
    };

    run();
    return () => window.cancelAnimationFrame(frame);
  }, [pathname, hash]);

  return null;
}
