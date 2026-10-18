import React, { useState, useEffect } from "react";
import "./ProductGallery.css";

const MAX_THUMBS = 6;
const VIEW_NAMES = ["Front", "Back", "Left", "Right"]; // order used in product.js

const ProductGallery = ({ product }) => {
  // front photo first, no duplicates, up to 6
  const images = [
    ...new Set(product.images?.length ? product.images : [product.image]),
  ]
    .filter(Boolean)
    .slice(0, MAX_THUMBS);

  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState(null); // {x, y} in % while hovering

  // start from the first photo when a different product is opened
  useEffect(() => {
    setActive(0);
    setZoom(null);
  }, [product.id]);

  if (images.length === 0) {
    return <div className="gallery_empty">No photo</div>;
  }

  const viewName = (i) => VIEW_NAMES[i] || `View ${i + 1}`;

  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    setZoom({
      x: ((e.clientX - r.left) / r.width) * 100,
      y: ((e.clientY - r.top) / r.height) * 100,
    });
  };

  return (
    <div className="gallery">
      {images.length > 1 && (
        <div
          className="gallery_thumbs"
          role="group"
          aria-label="Product photos"
        >
          {images.map((src, i) => (
            <button
              key={src + i}
              type="button"
              className={`gallery_thumb ${i === active ? "is_active" : ""}`}
              onClick={() => setActive(i)}
              aria-label={`Show ${viewName(i)} view`}
              aria-pressed={i === active}
              title={viewName(i)}
            >
              <img src={src} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}

      <div
        className={`gallery_main ${zoom ? "is_zoom" : ""}`}
        onMouseMove={onMove}
        onMouseLeave={() => setZoom(null)}
      >
        <img
          src={images[active]}
          alt={`${product.name} - ${viewName(active)} view`}
          style={{
            transformOrigin: zoom ? `${zoom.x}% ${zoom.y}%` : "center",
          }}
        />
        {images.length > 1 && (
          <span className="gallery_tag">{viewName(active)}</span>
        )}
      </div>
    </div>
  );
};

export default ProductGallery;
