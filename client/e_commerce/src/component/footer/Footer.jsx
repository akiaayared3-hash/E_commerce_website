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
} from "react-icons/fa";

import footer_logo from "../Assets/logo_footer.png";
import "./Footer.css";

const paymentMethods = [
  "Telebirr",
  "CBE Birr",
  "Chapa",
  "Commercial Bank of Ethiopia",
  "Awash Bank",
  "Dashen Bank",
  "Cash on Delivery",
];

const Footer = () => {
  const [email, setEmail] = useState("");
  const year = new Date().getFullYear();

  const handleSubscribe = (e) => {
    e.preventDefault();
    // TODO: send email to your backend
    console.log("Subscribed:", email);
    setEmail("");
  };

  return (
    <footer className="footer-wrapper">
      <div className="footer-main">
        {/* about */}
        <div className="about_house">
          <div className="footer_logo">
            <NavLink to="/">
              <img src={footer_logo} alt="Company logo" />
            </NavLink>
          </div>
          <p className="about-text">
            Curating the finest quality clothing and shoes for a sophisticated
            lifestyle.
          </p>
          <div className="social-media-icon">
            <a
              href="https://facebook.com"
              aria-label="Facebook"
              target="_blank"
              rel="noreferrer"
            >
              <FaFacebookF />
            </a>
            <a
              href="https://instagram.com"
              aria-label="Instagram"
              target="_blank"
              rel="noreferrer"
            >
              <FaInstagram />
            </a>
            <a
              href="https://tiktok.com"
              aria-label="TikTok"
              target="_blank"
              rel="noreferrer"
            >
              <FaTiktok />
            </a>
            <a
              href="https://t.me"
              aria-label="Telegram"
              target="_blank"
              rel="noreferrer"
            >
              <FaTelegramPlane />
            </a>
          </div>
        </div>

        {/* shop */}
        <div className="footer_col">
          <h4>Shop</h4>
          <ul>
            <li>
              <NavLink to="/">Home</NavLink>
            </li>
            <li>
              <NavLink to="/new_arrivals">New Arrivals</NavLink>
            </li>
            <li>
              <NavLink to="/clothes">Clothes</NavLink>
            </li>
            <li>
              <NavLink to="/shoes">Shoes</NavLink>
            </li>
            <li>
              <NavLink to="/t_shirt">T_shirt</NavLink>
            </li>
            <li>
              <NavLink to="/contacts">Contacts</NavLink>
            </li>
          </ul>
        </div>

        {/* customer care */}
        <div className="footer_col">
          <h4>Customer Care</h4>
          <ul>
            <li>
              <NavLink to="/faq">FAQ</NavLink>
            </li>
            <li>
              <NavLink to="/shipping-returns">Shipping &amp; Returns</NavLink>
            </li>
            <li>
              <NavLink to="/size-guide">Size Guide</NavLink>
            </li>
            <li>
              <NavLink to="/track-order">Track Order</NavLink>
            </li>
          </ul>
        </div>

        {/* contact */}
        <div className="footer_col contact_info">
          <h4>Visit Us</h4>
          <ul>
            <li>
              <FaMapMarkerAlt className="contact_icon" />
              <a
                href="https://maps.google.com/?q=Your+Boutique+Address+Addis+Ababa"
                target="_blank"
                rel="noreferrer"
              >
                Debre Birhan, Ethiopia
              </a>
            </li>
            <li>
              <FaEnvelope className="contact_icon" />
              <a href="mailto:info@yourboutique.com">info@yourboutique.com</a>
            </li>
            <li>
              <FaPhoneAlt className="contact_icon" />
              <a href="tel:+251900000000">+251 90 000 0000</a>
            </li>
            <li>
              <FaClock className="contact_icon" />
              <span>Mon – Sat: 9:00 AM – 8:00 PM</span>
            </li>
          </ul>
        </div>
      </div>

      {/* newsletter */}
      <div className="footer-newsletter">
        <div className="newsletter_text">
          <h4>Join Our Community</h4>
          <p>Get early access to new arrivals and exclusive offers.</p>
        </div>
        <form onSubmit={handleSubscribe}>
          <input
            type="email"
            placeholder="Your email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button type="submit">Subscribe</button>
        </form>
      </div>

      {/* payment methods */}
      <div className="footer-payments">
        <span className="payments_title">We Accept</span>
        <ul>
          {paymentMethods.map((method) => (
            <li key={method} className="payment_badge">
              {method}
            </li>
          ))}
        </ul>
      </div>

      {/* copyright */}
      <div className="footer-bottom">
        <p>© {year} Your Boutique Name. All rights reserved.</p>
        <div className="footer-legal">
          <NavLink to="/privacy">Privacy Policy</NavLink>
          <NavLink to="/terms">Terms &amp; Conditions</NavLink>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
