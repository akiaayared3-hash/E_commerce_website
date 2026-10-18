import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  buildIndex,
  searchProducts,
  didYouMean,
  highlightParts,
} from "../../page/serchproducts.js";
import "./ProductSearch.css";

const RECENT_KEY = "recent_searches_v1";
const formatPrice = (p) => `ETB ${(p || 0).toLocaleString()}`;

const readRecent = () => {
  try {
    const r = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    return Array.isArray(r) ? r : [];
  } catch {
    return [];
  }
};
const saveRecent = (q) => {
  const term = q.trim();
  if (term.length < 2) return;
  try {
    const next = [term, ...readRecent().filter((x) => x !== term)].slice(0, 5);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* storage blocked */
  }
};

const Marked = ({ text, query }) =>
  highlightParts(text, query).map((p, i) =>
    p.hit ? <mark key={i}>{p.text}</mark> : <span key={i}>{p.text}</span>,
  );

// <ProductSearch products={allProducts} />
const ProductSearch = ({
  products = [],
  placeholder = "Search products...",
}) => {
  const navigate = useNavigate();
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [recent, setRecent] = useState([]);

  const index = useMemo(() => buildIndex(products), [products]);

  // wait a moment after typing stops
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 180);
    return () => clearTimeout(t);
  }, [q]);

  const results = useMemo(
    () => (debounced.trim() ? searchProducts(index, debounced, 6) : []),
    [index, debounced],
  );
  const suggestion = useMemo(
    () =>
      debounced.trim().length > 2 && results.length === 0
        ? didYouMean(index, debounced)
        : "",
    [index, debounced, results.length],
  );

  // close when clicking outside
  useEffect(() => {
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target))
        setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  useEffect(() => setActive(-1), [debounced]);

  const showRecent = open && !q.trim() && recent.length > 0;
  const showResults = open && q.trim().length > 0;
  const listCount = showRecent ? recent.length : results.length;

  const goSearch = (term) => {
    const t = term.trim();
    if (!t) return;
    saveRecent(t);
    setOpen(false);
    navigate(`/search?q=${encodeURIComponent(t)}`);
  };
  const goProduct = (p) => {
    saveRecent(q);
    setOpen(false);
    setQ("");
    navigate(`/product/${p.id}`);
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (listCount ? (a + 1) % listCount : -1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (listCount ? (a <= 0 ? listCount - 1 : a - 1) : -1));
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active >= 0 && showRecent) goSearch(recent[active]);
      else if (active >= 0 && results[active]) goProduct(results[active]);
      else goSearch(q);
    }
  };

  return (
    <div className="ps_wrap" ref={wrapRef}>
      <form
        className="ps_form"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          goSearch(q);
        }}
      >
        <input
          ref={inputRef}
          className="ps_input"
          type="search"
          value={q}
          placeholder={placeholder}
          autoComplete="off"
          aria-label="Search products"
          role="combobox"
          aria-expanded={showRecent || showResults}
          aria-controls="ps_list"
          aria-activedescendant={active >= 0 ? `ps_opt_${active}` : undefined}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setRecent(readRecent());
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
        />
        {q && (
          <button
            type="button"
            className="ps_clear"
            aria-label="Clear search"
            onClick={() => {
              setQ("");
              inputRef.current?.focus();
            }}
          >
            ×
          </button>
        )}
        <button type="submit" className="ps_go">
          Search
        </button>
      </form>

      {(showRecent || showResults) && (
        <ul className="ps_list" id="ps_list" role="listbox">
          {showRecent && (
            <>
              <li className="ps_label" role="presentation">
                Recent searches
              </li>
              {recent.map((r, i) => (
                <li
                  key={r}
                  id={`ps_opt_${i}`}
                  role="option"
                  aria-selected={active === i}
                  className={`ps_item ps_recent ${active === i ? "active" : ""}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setQ(r);
                    goSearch(r);
                  }}
                >
                  {r}
                </li>
              ))}
            </>
          )}

          {showResults &&
            results.map((p, i) => (
              <li
                key={p.id}
                id={`ps_opt_${i}`}
                role="option"
                aria-selected={active === i}
                className={`ps_item ${active === i ? "active" : ""}`}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => goProduct(p)}
              >
                <span className="ps_thumb">
                  {p.image && <img src={p.image} alt="" />}
                </span>
                <span className="ps_text">
                  <strong>
                    <Marked text={p.name} query={debounced} />
                  </strong>
                  <small>{String(p.category || "").replace(/_/g, " ")}</small>
                </span>
                <span className="ps_price">{formatPrice(p.new_price)}</span>
              </li>
            ))}

          {showResults && results.length > 0 && (
            <li
              className="ps_all"
              role="presentation"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => goSearch(q)}
            >
              See all results for "{q.trim()}"
            </li>
          )}

          {showResults && results.length === 0 && debounced === q && (
            <li className="ps_empty" role="presentation">
              No products found for "{q.trim()}".
              {suggestion && (
                <>
                  {" "}
                  Did you mean{" "}
                  <button
                    type="button"
                    className="ps_suggest"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setQ(suggestion);
                      goSearch(suggestion);
                    }}
                  >
                    {suggestion}
                  </button>
                  ?
                </>
              )}
            </li>
          )}
        </ul>
      )}
    </div>
  );
};

export default ProductSearch;
