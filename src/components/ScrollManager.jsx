import { useEffect } from "react";
import { useLocation } from "react-router-dom";

function getHeaderOffset() {
  if (typeof window === "undefined") return 0;
  const header =
    document.querySelector(".landing-nav") ||
    document.querySelector(".platform-header");
  const height = header?.getBoundingClientRect?.().height || 0;
  return Math.max(0, Math.round(height + 10));
}

function scrollToHash(hash) {
  if (typeof window === "undefined" || !hash) return false;
  const id = decodeURIComponent(String(hash).replace(/^#/, "")).trim();
  if (!id) return false;
  const target = document.getElementById(id);
  if (!target) return false;
  const targetTop = target.getBoundingClientRect().top + window.scrollY;
  const headerOffset = getHeaderOffset();
  window.scrollTo({
    top: Math.max(0, Math.round(targetTop - headerOffset)),
    left: 0,
    behavior: "smooth",
  });
  return true;
}

export default function ScrollManager() {
  const { pathname, search, hash } = useLocation();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hash) {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      return;
    }
    let attempts = 0;
    let cancelled = false;
    const tryScroll = () => {
      if (cancelled) return;
      const ok = scrollToHash(hash);
      if (ok) return;
      attempts += 1;
      if (attempts > 12) {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
        return;
      }
      window.setTimeout(tryScroll, 80);
    };
    requestAnimationFrame(tryScroll);
    return () => {
      cancelled = true;
    };
  }, [pathname, search, hash]);

  return null;
}
