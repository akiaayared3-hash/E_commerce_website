import React from "react";
import { NavLink } from "react-router-dom";
import { FaArrowRight } from "react-icons/fa";
import { categories as products } from "../../component/Assets/product.js";
import Item from "../Item/Item.jsx";
import "./HomePage.css";

/* ---- settings: change these ids to pick which photos are used ---- */
const HERO_ID = 7; // photo in the hero (full outfit)
const EDITORIAL_ID = 20; // photo in the shoes banner (sport shoes)

const categoryTiles = [
  {
    name: "Clothes",
    key: "clothes",
    to: "/clothes",
    coverId: 4,
    blurb: "Jackets, hoodies and full outfits",
  },
  {
    name: "Shoes",
    key: "shoes",
    to: "/shoes",
    coverId: 18,
    blurb: "Sneakers and sport shoes",
  },
  {
    name: "T-Shirts",
    key: "t_shirt",
    to: "/t_shirt",
    coverId: 25,
    blurb: "Everyday comfort",
  },
];

const perks = [
  { title: "Premium quality", text: "Carefully chosen clothing and shoes." },
  { title: "Delivery in Ethiopia", text: "Fast delivery to your door." },
  { title: "Easy returns", text: "Simple and clear return policy." },
  { title: "Local payments", text: "Telebirr, CBE Birr, Cash on Delivery." },
];

const byId = (id) => products.find((p) => p.id === id);
const countIn = (key) => products.filter((p) => p.category === key).length;
const discount = (p) =>
  p.old_price > p.new_price
    ? Math.round((1 - p.new_price / p.old_price) * 100)
    : 0;

const HomePage = () => {
  const marked = products.filter((p) => p.isNew);
  const newArrivals = (marked.length ? marked : products.slice(-4)).slice(0, 4);

  const deals = products
    .filter((p) => discount(p) > 0)
    .sort((a, b) => discount(b) - discount(a))
    .slice(0, 4);

  const tshirts = products.filter((p) => p.category === "t_shirt").slice(0, 4);

  const hero = byId(HERO_ID);
  const editorial = byId(EDITORIAL_ID);

  const renderGrid = (list, badgeFn) => (
    <div className="product_grid">
      {list.map((p) => (
        <Item key={p.id} p={p} badge={badgeFn ? badgeFn(p) : null} />
      ))}
    </div>
  );

  return (
    <main className="home">
      {/* HERO */}
      <section className="hero">
        <div className="hero_text">
          <p className="eyebrow">New collection</p>
          <h1>Dress with quiet confidence.</h1>
          <p className="hero_lead">
            Curating the finest quality clothing and shoes for a sophisticated
            lifestyle.
          </p>
          <div className="hero_actions">
            <NavLink to="/new_arrivals" className="btn btn_primary">
              Shop New Arrivals
            </NavLink>
            <NavLink to="/shoes" className="btn btn_outline">
              Explore Shoes
            </NavLink>
          </div>
          <p className="hero_pay">
            Pay with Telebirr, CBE Birr or Cash on Delivery
          </p>
        </div>

        <div className="hero_media_wrap">
          <div className="hero_media">
            {hero && (
              <img
                src={hero.image}
                alt="Featured outfit"
                fetchPriority="high"
                decoding="async"
              />
            )}
          </div>
        </div>
      </section>

      {/* PERKS STRIP */}
      <section className="perks_band">
        <ul className="perks">
          {perks.map((p) => (
            <li key={p.title}>
              <strong>{p.title}</strong>
              <span>{p.text}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* CATEGORIES */}
      <section className="section">
        <div className="section_head center">
          <p className="eyebrow">Shop by category</p>
          <h2>Find your style</h2>
        </div>
        <div className="cat_grid">
          {categoryTiles.map((c) => {
            const cover = byId(c.coverId);
            return (
              <NavLink key={c.key} to={c.to} className="cat_tile">
                {cover && <img src={cover.image} alt="" loading="lazy" />}
                <span className="cat_overlay" />
                <span className="cat_content">
                  <span className="cat_count">{countIn(c.key)} products</span>
                  <span className="cat_name">{c.name}</span>
                  <span className="cat_blurb">{c.blurb}</span>
                  <span className="cat_cta">
                    Shop now <FaArrowRight />
                  </span>
                </span>
              </NavLink>
            );
          })}
        </div>
      </section>

      {/* NEW ARRIVALS */}
      <section className="section">
        <div className="section_head row">
          <div>
            <p className="eyebrow">Just in</p>
            <h2>New arrivals</h2>
          </div>
          <NavLink to="/new_arrivals" className="view_all">
            View all <FaArrowRight />
          </NavLink>
        </div>
        {renderGrid(newArrivals, () => "New")}
      </section>

      {/* EDITORIAL BANNER */}
      <section className="section">
        <div className="editorial">
          <div className="editorial_text">
            <p className="eyebrow gold">The shoe edit</p>
            <h2>Shoes made to be worn, and worn again.</h2>
            <p>
              Discover footwear chosen for comfort, craft and a finish that
              lasts.
            </p>
            <NavLink to="/shoes" className="btn btn_primary">
              Shop Shoes
            </NavLink>
          </div>
          <div className="editorial_media">
            {editorial && <img src={editorial.image} alt="" loading="lazy" />}
          </div>
        </div>
      </section>

      {/* DEALS */}
      {deals.length > 0 && (
        <section className="section">
          <div className="section_head row">
            <div>
              <p className="eyebrow">Best prices</p>
              <h2>Top deals</h2>
            </div>
            <NavLink to="/new_arrivals" className="view_all">
              See more <FaArrowRight />
            </NavLink>
          </div>
          {renderGrid(deals, (p) => `-${discount(p)}%`)}
        </section>
      )}

      {/* T-SHIRTS */}
      {tshirts.length > 0 && (
        <section className="section">
          <div className="section_head row">
            <div>
              <p className="eyebrow">Everyday wear</p>
              <h2>T-shirt collection</h2>
            </div>
            <NavLink to="/t_shirt" className="view_all">
              View all <FaArrowRight />
            </NavLink>
          </div>
          {renderGrid(tshirts)}
        </section>
      )}

      {/* CLOSING BAND */}
      <section className="section last">
        <div className="cta_band">
          <div>
            <h2>Need help choosing your size?</h2>
            <p>Message us and we will help you find the right fit.</p>
          </div>
          <NavLink to="/contacts" className="btn btn_primary">
            Contact Us
          </NavLink>
        </div>
      </section>
    </main>
  );
};

export default HomePage;
