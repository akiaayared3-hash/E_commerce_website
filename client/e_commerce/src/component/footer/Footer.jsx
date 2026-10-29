import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  FaFacebookF,
  FaInstagram,
  FaTiktok,
  FaTelegramPlane,
  FaMapMarkerAlt,
  FaEnvelope,
  FaPhoneAlt,
  FaClock,
  FaArrowUp,
} from "react-icons/fa";

import footer_logo from "../Assets/logo_footer.png";
import "./Footer.css";

/* ---------- Config: edit your real data here ---------- */
const BRAND = {
  name: "Your Boutique Name",
  email: "info@yourboutique.com",
  phone: "+251 90 000 0000",
  phoneHref: "tel:+251900000000",
  address: "Debre Birhan, Ethiopia",
  mapUrl:
    "https://www.google.com/maps/search/?api=1&query=Debre+Birhan+Ethiopia",
  hours: "Mon – Sat: 9:00 AM – 8:00 PM",
};

const NEWSLETTER_ENDPOINT = "/api/newsletter"; // change to your real endpoint
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SOCIALS = [
  { label: "Facebook", href: "https://facebook.com", icon: FaFacebookF },
  { label: "Instagram", href: "https://instagram.com", icon: FaInstagram },
  { label: "TikTok", href: "https://tiktok.com", icon: FaTiktok },
  { label: "Telegram", href: "https://t.me", icon: FaTelegramPlane },
];

const SHOP_LINKS = [
  { label: "Home", to: "/" },
  { label: "New Arrivals", to: "/new_arrivals" },
  { label: "Clothes", to: "/clothes" },
  { label: "Shoes", to: "/shoes" },
  { label: "T-Shirts", to: "/t_shirt" },
];

const CARE_LINKS = [
  { label: "FAQ", to: "/faq" },
  { label: "Shipping & Returns", to: "/shipping-returns" },
  { label: "Size Guide", to: "/size-guide" },
  { label: "Track Order", to: "/track-order" },
  { label: "Contact Us", to: "/contacts" },
];

const LEGAL_LINKS = [
  { label: "Privacy Policy", to: "/privacy" },
  { label: "Terms & Conditions", to: "/terms" },
];

const PAYMENT_METHODS = [
  "Telebirr",
  "CBE Birr",
  "Chapa",
  "Commercial Bank of Ethiopia",
  "Awash Bank",
  "Dashen Bank",
  "Cash on Delivery",
];

const YEAR = new Date().getFullYear();

/* ---------- Component ---------- */
const Footer = () => {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | success | error
  const [message, setMessage] = useState("");

  const handleSubscribe = async (e) => {
    e.preventDefault();
    if (status === "loading") return;

    const value = email.trim();
    if (!EMAIL_REGEX.test(value)) {
      setStatus("error");
      setMessage("Please enter a valid email address.");
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch(NEWSLETTER_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value }),
      });
      if (!res.ok) throw new Error("Request failed");

      setStatus("success");
      setMessage("Thanks for subscribing!");
      setEmail("");
    } catch {
      setStatus("error");
      setMessage("Something went wrong. Please try again.");
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer className="footer-wrapper">
      <div className="footer-container">
        <div className="footer-main">
          {/* About */}
          <div className="about_house">
            <div className="footer_logo">
              <NavLink to="/" aria-label={`${BRAND.name} home`}>
                <img
                  src={footer_logo}
                  alt={`${BRAND.name} logo`}
                  width="180"
                  height="44"
                  loading="lazy"
                />
              </NavLink>
            </div>
            <p className="about-text">
              Curating the finest quality clothing and shoes for a sophisticated
              lifestyle.
            </p>
            <div className="social-media-icon">
              {SOCIALS.map(({ label, href, icon: Icon }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Icon aria-hidden="true" />
                </a>
              ))}
            </div>
          </div>

          {/* Shop */}
          <nav className="footer_col" aria-label="Shop">
            <h3>Shop</h3>
            <ul>
              {SHOP_LINKS.map(({ label, to }) => (
                <li key={to}>
                  <NavLink to={to} end={to === "/"}>
                    {label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          {/* Customer care */}
          <nav className="footer_col" aria-label="Customer care">
            <h3>Customer Care</h3>
            <ul>
              {CARE_LINKS.map(({ label, to }) => (
                <li key={to}>
                  <NavLink to={to}>{label}</NavLink>
                </li>
              ))}
            </ul>
          </nav>

          {/* Contact */}
          <div className="footer_col contact_info">
            <h3>Visit Us</h3>
            <ul>
              <li>
                <FaMapMarkerAlt className="contact_icon" aria-hidden="true" />
                <a
                  href={BRAND.mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {BRAND.address}
                </a>
              </li>
              <li>
                <FaEnvelope className="contact_icon" aria-hidden="true" />
                <a href={`mailto:${BRAND.email}`}>{BRAND.email}</a>
              </li>
              <li>
                <FaPhoneAlt className="contact_icon" aria-hidden="true" />
                <a href={BRAND.phoneHref}>{BRAND.phone}</a>
              </li>
              <li>
                <FaClock className="contact_icon" aria-hidden="true" />
                <span>{BRAND.hours}</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Newsletter */}
        <div className="footer-newsletter">
          <div className="newsletter_text">
            <h3>Join Our Community</h3>
            <p>Get early access to new arrivals and exclusive offers.</p>
          </div>

          <div className="newsletter_form_wrap">
            <form onSubmit={handleSubscribe} noValidate>
              <label htmlFor="footer-email" className="visually-hidden">
                Email address
              </label>
              <input
                id="footer-email"
                type="email"
                placeholder="Your email address"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (status !== "idle" && status !== "loading") {
                    setStatus("idle");
                    setMessage("");
                  }
                }}
                aria-invalid={status === "error"}
                aria-describedby="newsletter-message"
                required
              />
              <button type="submit" disabled={status === "loading"}>
                {status === "loading" ? "Subscribing..." : "Subscribe"}
              </button>
            </form>
            <p
              id="newsletter-message"
              className={`newsletter_message ${status}`}
              role="status"
              aria-live="polite"
            >
              {message}
            </p>
          </div>
        </div>

        {/* Payments */}
        <div className="footer-payments">
          <span className="payments_title">We Accept</span>
          <ul>
            {PAYMENT_METHODS.map((method) => (
              <li key={method} className="payment_badge">
                {method}
              </li>
            ))}
          </ul>
        </div>

        {/* Bottom */}
        <div className="footer-bottom">
          <p>
            © {YEAR} {BRAND.name}. All rights reserved.
          </p>
          <div className="footer-legal">
            {LEGAL_LINKS.map(({ label, to }) => (
              <NavLink key={to} to={to}>
                {label}
              </NavLink>
            ))}
          </div>
          <button
            type="button"
            className="back-to-top"
            onClick={scrollToTop}
            aria-label="Back to top"
          >
            <FaArrowUp aria-hidden="true" />
          </button>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
