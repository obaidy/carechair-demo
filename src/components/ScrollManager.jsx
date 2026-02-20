import { useLayoutEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

function getStickyOffset() {
  if (typeof window === "undefined") return 0;
  const landingHeader = document.querySelector(".landing-nav");
  const platformHeader = document.querySelector(".platform-header");
  const header = landingHeader || platformHeader;
  const rect = header?.getBoundingClientRect();
  return Math.max(0, Math.round((rect?.height || 0) + 10));
}

function scrollToHash(hash, behavior = "smooth") {
  if (typeof window === "undefined" || !hash) return false;
  const id = decodeURIComponent(String(hash || "").replace(/^#/, "")).trim();
  if (!id) return false;
  const el = document.getElementById(id);
  if (!el) return false;
  el.scrollIntoView({ behavior, block: "start" });
  requestAnimationFrame(() => {
    window.scrollBy({ top: -getStickyOffset(), left: 0, behavior: "auto" });
  });
  return true;
}

export default function ScrollManager() {
  const { key, pathname, search, hash } = useLocation();
  const navType = useNavigationType();
  const positionsRef = useRef(new Map());
  const prevKeyRef = useRef(null);
  const debug = String(import.meta.env.VITE_DEBUG_SCROLL || "").trim() === "1";

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const prevKey = prevKeyRef.current;
    if (prevKey && prevKey !== key) {
      positionsRef.current.set(prevKey, window.scrollY || 0);
    }

    const currentKey = key || `${pathname}${search}${hash}`;
    prevKeyRef.current = currentKey;

    if (navType === "POP") {
      const restoreY = Number(positionsRef.current.get(currentKey) || 0);
    window.scrollTo({ top: Math.max(0, restoreY), left: 0, behavior: "auto" });
      if (debug) console.info("[ScrollManager] POP restore", { key: currentKey, y: restoreY });
      return;
    }

    if (hash) {
      const ok = scrollToHash(hash, "smooth");
      if (!ok) {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      }
      if (debug) console.info("[ScrollManager] HASH", { hash, found: ok });
      return;
    }

    if (typeof window === "undefined") return;
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    if (debug) console.info("[ScrollManager] TOP", { pathname, search, navType });
  }, [key, pathname, search, hash, navType, debug]);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const currentKey = key || `${pathname}${search}${hash}`;
    const save = () => {
      positionsRef.current.set(currentKey, window.scrollY || 0);
    };
    window.addEventListener("scroll", save, { passive: true });
    window.addEventListener("beforeunload", save);
    return () => {
      save();
      window.removeEventListener("scroll", save);
      window.removeEventListener("beforeunload", save);
    };
  }, [key, pathname, search, hash]);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return undefined;
    const current = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    return () => {
      window.history.scrollRestoration = current || "auto";
    };
  }, []);

  return null;
}
