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
  target.scrollIntoView({ behavior: "smooth", block: "start" });
  requestAnimationFrame(() => {
    window.scrollBy({ top: -getHeaderOffset(), left: 0, behavior: "auto" });
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
    requestAnimationFrame(() => {
      const ok = scrollToHash(hash);
      if (!ok) window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });
  }, [pathname, search, hash]);

  return null;
}

