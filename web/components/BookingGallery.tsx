'use client';

import {useMemo, useState} from 'react';
import SafeImage from '@/components/SafeImage';

type BookingGalleryProps = {
  images: string[];
  imageLabel: string;
};

export default function BookingGallery({images, imageLabel}: BookingGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const galleryImages = useMemo(() => {
    if (images.length > 0) return images;
    return ['', '', '', ''];
  }, [images]);

  const canNavigate = galleryImages.length > 1;

  return (
    <>
      <div className="gallery-grid">
        {galleryImages.map((img, idx) => (
          <button
            type="button"
            key={`${img || 'empty'}-${idx}`}
            className="gallery-lightbox-btn"
            onClick={() => setLightboxIndex(idx)}
          >
            <SafeImage
              src={img}
              alt={`${imageLabel} ${idx + 1}`}
              className="gallery-tile"
              fallbackIcon="🌸"
              fallbackKey="gallery"
            />
          </button>
        ))}
      </div>

      {lightboxIndex >= 0 ? (
        <div className="lightbox-backdrop" role="dialog" aria-modal="true">
          <button type="button" className="lightbox-close" onClick={() => setLightboxIndex(-1)}>
            ×
          </button>
          {canNavigate ? (
            <button
              type="button"
              className="lightbox-nav prev"
              onClick={() => setLightboxIndex((prev) => (prev - 1 + galleryImages.length) % galleryImages.length)}
            >
              ‹
            </button>
          ) : null}
          <SafeImage
            src={galleryImages[lightboxIndex] || ''}
            alt={`${imageLabel} ${lightboxIndex + 1}`}
            className="lightbox-image"
            fallbackIcon="🌸"
            fallbackKey="gallery"
          />
          {canNavigate ? (
            <button
              type="button"
              className="lightbox-nav next"
              onClick={() => setLightboxIndex((prev) => (prev + 1) % galleryImages.length)}
            >
              ›
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
