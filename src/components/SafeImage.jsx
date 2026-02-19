import React, { useMemo, useState } from "react";

export default function SafeImage({
  src,
  alt,
  className = "",
  style,
  fallbackClassName = "",
  fallbackText = "",
  fallbackIcon = "",
  ...rest
}) {
  const [failed, setFailed] = useState(false);

  const showFallback = failed || !src;

  const gradientStyle = useMemo(
    () => ({
      background:
        "linear-gradient(135deg, rgba(242,227,210,0.88), rgba(247,232,237,0.95) 52%, rgba(231,208,184,0.86))",
      ...style,
    }),
    [style]
  );

  if (showFallback) {
    return (
      <div className={`safe-image-fallback ${fallbackClassName} ${className}`.trim()} style={gradientStyle} aria-label={alt || "image fallback"}>
        {fallbackIcon ? <span className="safe-image-icon">{fallbackIcon}</span> : null}
        {fallbackText ? <span className="safe-image-text">{fallbackText}</span> : null}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={style}
      loading="lazy"
      onError={() => setFailed(true)}
      {...rest}
    />
  );
}
