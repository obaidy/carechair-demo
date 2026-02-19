import React, { useState } from "react";
import { Link } from "react-router-dom";

export default function BrandLogo({ to = "/", compact = false, className = "" }) {
  const [markFailed, setMarkFailed] = useState(false);
  const [lockupFailed, setLockupFailed] = useState(false);

  if (compact) {
    return (
      <Link to={to} className={`brand-logo compact ${className}`.trim()} aria-label="CareChair">
        {!markFailed ? (
          <img src="/images/brand/carechair-mark.png" alt="CareChair" onError={() => setMarkFailed(true)} />
        ) : (
          <span className="brand-fallback-mark">C</span>
        )}
      </Link>
    );
  }

  return (
    <Link to={to} className={`brand-logo ${className}`.trim()} aria-label="CareChair">
      {!lockupFailed ? (
        <img src="/images/brand/carechair-lockup.png" alt="CareChair" onError={() => setLockupFailed(true)} />
      ) : (
        <span className="brand-fallback-text">CareChair</span>
      )}
    </Link>
  );
}

