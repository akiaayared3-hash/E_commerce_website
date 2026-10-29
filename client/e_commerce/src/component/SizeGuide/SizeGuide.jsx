import { useEffect, useMemo, useRef, useState } from "react";
import "./SizeGuide.css";

/*
  Props
  - type:   "clothes" | "shoes"
  - custom: optional { title, headers: string[], rows: (string|number)[][], note }
            Use this to pass a size chart that comes from your backend
            (product.size_guide). It replaces the built-in chart.
  - onClose: () => void
*/

const CLOTHES_ROWS = [
  ["S", [88, 94], [74, 80]],
  ["M", [94, 100], [80, 86]],
  ["L", [100, 106], [86, 92]],
  ["XL", [106, 112], [92, 98]],
  ["XXL", [112, 118], [98, 104]],
  ["XXXL", [118, 124], [104, 110]],
];

const SHOE_ROWS = [
  ["36", "3.5", 22.5],
  ["37", "4.5", 23.2],
  ["38", "5", 23.8],
  ["39", "6", 24.5],
  ["40", "6.5", 25.1],
  ["41", "7.5", 25.8],
  ["42", "8", 26.5],
  ["43", "9", 27.1],
  ["44", "9.5", 27.8],
  ["45", "10.5", 28.4],
];

const CM_PER_INCH = 2.54;

const SizeGuide = ({ type = "clothes", custom = null, onClose }) => {
  const [unit, setUnit] = useState("cm");
  const closeRef = useRef(null);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") onClose?.();
    };

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    closeRef.current?.focus();

    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const fmt = (cm) =>
    unit === "cm" ? String(cm) : (cm / CM_PER_INCH).toFixed(1);

  const range = ([min, max]) => `${fmt(min)}–${fmt(max)}`;

  const table = useMemo(() => {
    if (custom && Array.isArray(custom.headers) && Array.isArray(custom.rows)) {
      return {
        title: custom.title || "Size guide",
        headers: custom.headers,
        rows: custom.rows.map((row) => row.map(String)),
        note: custom.note || "",
        convertible: false,
      };
    }

    if (type === "shoes") {
      return {
        title: "Shoe size guide",
        headers: ["EU", "UK", `Foot length (${unit})`],
        rows: SHOE_ROWS.map(([eu, uk, cm]) => [eu, uk, fmt(cm)]),
        note: "Measured from heel to longest toe. If you are between sizes, choose the larger one.",
        convertible: true,
      };
    }

    return {
      title: "Clothing size guide",
      headers: ["Size", `Chest (${unit})`, `Waist (${unit})`],
      rows: CLOTHES_ROWS.map(([label, chest, waist]) => [
        label,
        range(chest),
        range(waist),
      ]),
      note: "Body measurements, not garment measurements. If you are between sizes, choose the larger one.",
      convertible: true,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, custom, unit]);

  const tips =
    type === "shoes"
      ? [
          "Stand on a sheet of paper and mark your heel and longest toe.",
          "Measure the distance between the marks.",
          "Measure in the evening, when feet are slightly larger.",
        ]
      : [
          "Chest: measure around the fullest part, under the arms.",
          "Waist: measure around the narrowest part of your torso.",
          "Keep the tape snug but not tight.",
        ];

  return (
    <div
      className="sguide_backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sguide-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div className="sguide">
        <header className="sguide_header">
          <h2 id="sguide-title">{table.title}</h2>

          <button
            ref={closeRef}
            type="button"
            className="sguide_close"
            aria-label="Close size guide"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        {table.convertible && (
          <div className="sguide_units" role="group" aria-label="Units">
            {["cm", "in"].map((value) => (
              <button
                key={value}
                type="button"
                className={unit === value ? "is-active" : ""}
                aria-pressed={unit === value}
                onClick={() => setUnit(value)}
              >
                {value}
              </button>
            ))}
          </div>
        )}

        <div className="sguide_table_wrap">
          <table className="sguide_table">
            <thead>
              <tr>
                {table.headers.map((header) => (
                  <th key={header} scope="col">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {table.rows.map((row) => (
                <tr key={row[0]}>
                  {row.map((cell, i) =>
                    i === 0 ? (
                      <th key={i} scope="row">
                        {cell}
                      </th>
                    ) : (
                      <td key={i}>{cell}</td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {table.note && <p className="sguide_note">{table.note}</p>}

        {!custom && (
          <>
            <h3 className="sguide_subtitle">How to measure</h3>
            <ul className="sguide_tips">
              {tips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
            <p className="sguide_note">
              Charts are approximate and may vary slightly by brand.
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default SizeGuide;
