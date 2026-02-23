'use client';

import {useMemo, useState} from 'react';
import type {ImgHTMLAttributes} from 'react';
import {resolveImageSrc, type ImageFallbackKey} from '@/lib/images';

type SafeImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  fallbackClassName?: string;
  fallbackText?: string;
  fallbackIcon?: string;
  fallbackKey?: ImageFallbackKey;
};

export default function SafeImage({
  src,
  alt,
  className = '',
  style,
  fallbackClassName = '',
  fallbackText = '',
  fallbackIcon = '',
  fallbackKey,
  ...rest
}: SafeImageProps) {
  const [failed, setFailed] = useState(false);
  const resolvedSrc = resolveImageSrc(typeof src === 'string' ? src : '', fallbackKey);
  const showFallback = failed || !src;

  const gradientStyle = useMemo(
    () => ({
      background: 'linear-gradient(135deg, rgba(242,227,210,0.88), rgba(247,232,237,0.95) 52%, rgba(231,208,184,0.86))',
      ...style
    }),
    [style]
  );

  if (showFallback) {
    return (
      <div
        className={`safe-image-fallback ${fallbackClassName} ${className}`.trim()}
        style={gradientStyle}
        aria-label={alt || 'image fallback'}
      >
        {fallbackIcon ? <span className="safe-image-icon">{fallbackIcon}</span> : null}
        {fallbackText ? <span className="safe-image-text">{fallbackText}</span> : null}
      </div>
    );
  }

  return <img src={resolvedSrc} alt={alt} className={className} style={style} loading="lazy" onError={() => setFailed(true)} {...rest} />;
}
