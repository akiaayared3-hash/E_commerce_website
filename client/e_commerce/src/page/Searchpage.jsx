import React, { useMemo } from "react";
import { NavLink, useSearchParams } from "react-router-dom";
import { buildIndex, searchProducts, didYouMean } from "./serchproducts.js";
import "../component/ProductSearch/ProductSearch.css";

const formatPrice = (p) => `ETB ${(p || 0).toLocaleString()}`;


const SearchPage = ({ products = [] }) => {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") || "";
  const sort = params.get("sort") || "best";

  const index = useMemo(() => buildIndex(products), [products]);
  const found = useMemo(() => searchProducts(index, q, 200), [index, q]);
  const suggestion = useMemo(
    () => (found.length === 0 ? didYouMean(index, q) : ""),
    [index, q, found.length],
  );

  const list = useMemo(() => {
    const copy = [...found];
    if (sort === "low") copy.sort((a, b) => a.new_price - b.new_price);
    if (sort === "high") copy.sort((a, b) => b.new_price - a.new_price);
    return copy;
  }, [found, sort]);

  const setSort = (value) => {
    const next = new URLSearchParams(params);
    next.set("sort", value);
    setParams(next, { replace: true });
  };

  return (
    <main className="sp_page">
      <h1>
        {q ? (
          <>
            Results for "{q}" <span className="sp_count">({list.length})</span>
          </>
        ) : (
          "Search"
        )}
      </h1>

      {list.length > 0 && (
        <label className="sp_sort">
          Sort by{" "}
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="best">Best match</option>
            <option value="low">Price: low to high</option>
            <option value="high">Price: high to low</option>
          </select>
        </label>
      )}

      {q && list.length === 0 && (
        <div className="sp_empty">
          <p>We couldn't find anything for "{q}".</p>
          {suggestion && (
            <p>
              Did you mean{" "}
              <NavLink to={`/search?q=${encodeURIComponent(suggestion)}`}>
                {suggestion}
              </NavLink>
              ?
            </p>
          )}
          <p>Try a shorter word, check the spelling, or browse by category.</p>
        </div>
      )}

      <div className="sp_grid">
        {list.map((p) => (
          <NavLink to={`/product/${p.id}`} className="sp_card" key={p.id}>
            <span className="sp_photo">
              {p.image ? <img src={p.image} alt={p.name} /> : <em>No photo</em>}
            </span>
            <span className="sp_cat">
              {String(p.category || "").replace(/_/g, " ")}
            </span>
            <strong>{p.name}</strong>
            <span className="sp_price">{formatPrice(p.new_price)}</span>
          </NavLink>
        ))}
      </div>
    </main>
  );
};

export default SearchPage;
