import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./ProductGallery.css";

/*
  Backend image shape (all optional except url):
  images: [
    { url, view: "front" | "back" | "side" | "left" | "right" | "top" | "bottom" | "detail" | "model",
      label, alt, color, sort_order, is_primary }
  ]
  Plain strings also work. If `color` is set on an image, it is only shown
  when that color is selected (images without a color always show).
*/

const VIEW_ORDER = [
  "front",
  "back",
  "side",
  "left",
  "right",
  "top",
  "bottom",
  "detail",
  "model",
  "lifestyle",
];

const VIEW_LABELS = {
  front: "Front",
  back: "Back",
  side: "Side",
  left: "Left",
  right: "Right",
  top: "Top",
  bottom: "Bottom",
  detail: "Detail",
  model: "On model",
  lifestyle: "Lifestyle",
};

const isRecord = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const cleanString = (value) => String(value ?? "").trim();

const normalizeView = (raw) => {
  const value = cleanString(raw)
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (!value) return "";
  if (value.includes("front")) return "front";
  if (value.includes("back") || value.includes("rear")) return "back";
  if (value.includes("left")) return "left";
  if (value.includes("right")) return "right";
  if (value.includes("side")) return "side";
  if (value.includes("top")) return "top";
  if (value.includes("bottom") || value.includes("sole")) return "bottom";
  if (
    value.includes("detail") ||
    value.includes("close") ||
    value.includes("zoom")
  )
    return "detail";
  if (value.includes("model") || value.includes("worn")) return "model";
  if (value.includes("lifestyle")) return "lifestyle";
  return value;
};

const normalizeColor = (value) => cleanString(value).toLowerCase();

const toItem = (raw, index) => {
  if (typeof raw === "string") {
    const url = raw.trim();
    return url
      ? {
          url,
          view: "",
          label: "",
          alt: "",
          color: "",
          order: null,
          primary: false,
          index,
        }
      : null;
  }

  if (!isRecord(raw)) return null;

  const url = cleanString(raw.url ?? raw.image_url ?? raw.src ?? raw.path);
  if (!url) return null;

  const order = Number(raw.sort_order ?? raw.position ?? raw.order);

  return {
    url,
    view: normalizeView(raw.view ?? raw.angle ?? raw.type ?? raw.label),
    label: cleanString(raw.label),
    alt: cleanString(raw.alt ?? raw.alt_text),
    color: normalizeColor(raw.color ?? raw.color_name),
    order: Number.isFinite(order) ? order : null,
    primary:
      raw.is_primary === true || raw.is_primary === 1 || raw.primary === true,
    index,
  };
};

const collectImages = (product, activeColor) => {
  const raw = [];

  if (Array.isArray(product?.images)) raw.push(...product.images);

  const single = product?.image ?? product?.image_url;
  if (single) raw.unshift(single);

  if (Array.isArray(product?.variants)) {
    product.variants.forEach((variant) => {
      const url = variant?.image ?? variant?.image_url;
      if (url && typeof url === "string") {
        raw.push({
          url,
          color:
            variant.color ?? variant.color_name ?? variant.attributes?.color,
        });
      }
    });
  }

  const seen = new Set();
  const items = [];

  raw.forEach((entry, index) => {
    const item = toItem(
      isRecord(entry) && isRecord(entry.url)
        ? { ...entry, url: entry.url.url }
        : entry,
      index,
    );
    if (!item || seen.has(item.url)) return;
    seen.add(item.url);
    items.push(item);
  });

  const colorKey = normalizeColor(activeColor);
  const hasColorImages =
    colorKey && items.some((item) => item.color === colorKey);

  const visible = hasColorImages
    ? items.filter((item) => !item.color || item.color === colorKey)
    : items.filter((item) => !item.color || !colorKey);

  const list = visible.length ? visible : items;

  const sortKey = (item) => {
    if (item.primary) return -1;
    if (item.order !== null) return item.order;
    const viewIndex = VIEW_ORDER.indexOf(item.view);
    return (
      1000 +
      (viewIndex === -1 ? VIEW_ORDER.length : viewIndex) * 10 +
      item.index / 1000
    );
  };

  return [...list].sort((a, b) => sortKey(a) - sortKey(b));
};

const labelFor = (item, position) =>
  item.label || VIEW_LABELS[item.view] || `View ${position + 1}`;

const SWIPE_THRESHOLD = 45;

const ProductGallery = ({ product, activeColor = "" }) => {
  const images = useMemo(
    () => collectImages(product, activeColor),
    [product, activeColor],
  );

  const imagesKey = images.map((item) => item.url).join("|");
  const productName = cleanString(product?.name ?? product?.title) || "Product";

  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState({ active: false, x: 50, y: 50 });
  const [lightbox, setLightbox] = useState(false);
  const [loaded, setLoaded] = useState({});
  const [failed, setFailed] = useState({});

  const touchStart = useRef(null);
  const thumbsRef = useRef(null);
  const closeRef = useRef(null);

  const count = images.length;
  const safeIndex = count ? Math.min(index, count - 1) : 0;
  const current = images[safeIndex];

  useEffect(() => {
    setIndex(0);
    setZoom((z) => ({ ...z, active: false }));
  }, [imagesKey]);

  const go = useCallback(
    (next) => {
      if (!count) return;
      setIndex(((next % count) + count) % count);
      setZoom((z) => ({ ...z, active: false }));
    },
    [count],
  );

  // Preload neighbours so switching angles feels instant.
  useEffect(() => {
    if (count < 2) return;
    [safeIndex - 1, safeIndex + 1].forEach((i) => {
      const item = images[((i % count) + count) % count];
      if (item) {
        const img = new Image();
        img.src = item.url;
      }
    });
  }, [images, safeIndex, count]);

  // Keep the active thumbnail visible.
  useEffect(() => {
    const node = thumbsRef.current?.querySelector(".pgal_thumb.is-active");
    node?.scrollIntoView?.({
      block: "nearest",
      inline: "nearest",
      behavior: "smooth",
    });
  }, [safeIndex]);

  // Lightbox: keyboard, scroll lock, focus.
  useEffect(() => {
    if (!lightbox) return undefined;

    const onKey = (event) => {
      if (event.key === "Escape") setLightbox(false);
      if (event.key === "ArrowRight") go(safeIndex + 1);
      if (event.key === "ArrowLeft") go(safeIndex - 1);
    };

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    closeRef.current?.focus();

    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [lightbox, go, safeIndex]);

  const onStageKey = (event) => {
    if (event.key === "ArrowRight") go(safeIndex + 1);
    if (event.key === "ArrowLeft") go(safeIndex - 1);
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setLightbox(true);
    }
  };

  const onMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setZoom({
      active: true,
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    });
  };

  const onTouchStart = (event) => {
    touchStart.current = event.touches[0].clientX;
  };

  const onTouchEnd = (event) => {
    if (touchStart.current === null) return;
    const delta = event.changedTouches[0].clientX - touchStart.current;
    touchStart.current = null;
    if (Math.abs(delta) > SWIPE_THRESHOLD) go(safeIndex + (delta < 0 ? 1 : -1));
  };

  const markLoaded = (url) => setLoaded((prev) => ({ ...prev, [url]: true }));
  const markFailed = (url) => setFailed((prev) => ({ ...prev, [url]: true }));

  if (!count) {
    return (
      <div className="pgal">
        <div className="pgal_stage pgal_stage--empty">
          <span>No image available</span>
        </div>
      </div>
    );
  }

  const currentLabel = labelFor(current, safeIndex);
  const currentAlt = current.alt || `${productName} – ${currentLabel} view`;
  const isFailed = failed[current.url];
  const isLoaded = loaded[current.url];

  return (
    <div className="pgal">
      <div className="pgal_stage_wrap">
        <div
          className={`pgal_stage ${zoom.active ? "is-zooming" : ""}`}
          tabIndex={0}
          role="group"
          aria-roledescription="carousel"
          aria-label={`${productName} images`}
          onKeyDown={onStageKey}
          onMouseMove={onMove}
          onMouseLeave={() => setZoom((z) => ({ ...z, active: false }))}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          onClick={() => setLightbox(true)}
        >
          {!isLoaded && !isFailed && (
            <div className="pgal_skeleton" aria-hidden="true" />
          )}

          {isFailed ? (
            <div className="pgal_error">Image could not be loaded</div>
          ) : (
            <img
              key={current.url}
              className="pgal_img"
              src={current.url}
              alt={currentAlt}
              draggable="false"
              loading={safeIndex === 0 ? "eager" : "lazy"}
              decoding="async"
              onLoad={() => markLoaded(current.url)}
              onError={() => markFailed(current.url)}
              style={{
                transformOrigin: `${zoom.x}% ${zoom.y}%`,
              }}
            />
          )}

          <span className="pgal_view_tag">{currentLabel}</span>

          {count > 1 && (
            <span className="pgal_counter" aria-live="polite">
              {safeIndex + 1} / {count}
            </span>
          )}

          <span className="pgal_expand" aria-hidden="true">
            ⤢
          </span>
        </div>

        {count > 1 && (
          <>
            <button
              type="button"
              className="pgal_arrow pgal_arrow--prev"
              aria-label="Previous image"
              onClick={() => go(safeIndex - 1)}
            >
              ‹
            </button>
            <button
              type="button"
              className="pgal_arrow pgal_arrow--next"
              aria-label="Next image"
              onClick={() => go(safeIndex + 1)}
            >
              ›
            </button>
          </>
        )}
      </div>

      {count > 1 && (
        <div
          className="pgal_thumbs"
          ref={thumbsRef}
          role="tablist"
          aria-label="Product views"
        >
          {images.map((item, position) => {
            const label = labelFor(item, position);
            const active = position === safeIndex;

            return (
              <button
                key={item.url}
                type="button"
                role="tab"
                aria-selected={active}
                aria-label={`Show ${label} view`}
                className={`pgal_thumb ${active ? "is-active" : ""}`}
                onClick={() => go(position)}
              >
                <img
                  src={item.url}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  draggable="false"
                />
                <span className="pgal_thumb_label">{label}</span>
              </button>
            );
          })}
        </div>
      )}

      {lightbox && (
        <div
          className="pgal_lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`${productName} image viewer`}
          onClick={(event) => {
            if (event.target === event.currentTarget) setLightbox(false);
          }}
        >
          <button
            ref={closeRef}
            type="button"
            className="pgal_lb_close"
            aria-label="Close viewer"
            onClick={() => setLightbox(false)}
          >
            ×
          </button>

          <div
            className="pgal_lb_stage"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            {count > 1 && (
              <button
                type="button"
                className="pgal_lb_arrow pgal_lb_arrow--prev"
                aria-label="Previous image"
                onClick={() => go(safeIndex - 1)}
              >
                ‹
              </button>
            )}

            <img
              src={current.url}
              alt={currentAlt}
              className="pgal_lb_img"
              draggable="false"
            />

            {count > 1 && (
              <button
                type="button"
                className="pgal_lb_arrow pgal_lb_arrow--next"
                aria-label="Next image"
                onClick={() => go(safeIndex + 1)}
              >
                ›
              </button>
            )}
          </div>

          <div className="pgal_lb_caption">
            {currentLabel}
            {count > 1 && ` · ${safeIndex + 1} / ${count}`}
          </div>

          {count > 1 && (
            <div className="pgal_lb_thumbs">
              {images.map((item, position) => (
                <button
                  key={item.url}
                  type="button"
                  aria-label={`Show ${labelFor(item, position)} view`}
                  className={position === safeIndex ? "is-active" : ""}
                  onClick={() => go(position)}
                >
                  <img src={item.url} alt="" draggable="false" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProductGallery;
