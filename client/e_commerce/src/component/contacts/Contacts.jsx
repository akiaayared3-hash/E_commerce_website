import React, { useState } from "react";
import {
  FaMapMarkerAlt,
  FaPhoneAlt,
  FaEnvelope,
  FaClock,
  FaTelegramPlane,
  FaWhatsapp,
  FaInstagram,
} from "react-icons/fa";
import "./Contacts.css";

/* ---- your real details: edit here only ---- */
const INFO = {
  address: "[Your address], Debre Birhan, Ethiopia",
  phone: "+251 9XX XXX XXX",
  phoneLink: "+2519XXXXXXXX", // no spaces, used for the tel: link
  email: "info@yourboutique.com",
  hours: "Mon – Sat: 9:00 AM – 8:00 PM",
  telegram: "https://t.me/your_username",
  whatsapp: "https://wa.me/2519XXXXXXXX",
  instagram: "https://instagram.com/your_page",
  mapQuery: "Debre Birhan, Ethiopia", // replace with your shop address
};

const emptyForm = { name: "", email: "", phone: "", message: "" };

const Contacts = () => {
  const [form, setForm] = useState(emptyForm);
  const [sent, setSent] = useState(false);

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const onSubmit = (e) => {
    e.preventDefault();
    // TODO: send `form` to your backend or an email service
    console.log("Contact message:", form);
    setSent(true);
    setForm(emptyForm);
  };

  const cards = [
    { icon: <FaMapMarkerAlt />, title: "Visit us", text: INFO.address },
    {
      icon: <FaPhoneAlt />,
      title: "Call us",
      text: INFO.phone,
      href: `tel:${INFO.phoneLink}`,
    },
    {
      icon: <FaEnvelope />,
      title: "Email us",
      text: INFO.email,
      href: `mailto:${INFO.email}`,
    },
    { icon: <FaClock />, title: "Opening hours", text: INFO.hours },
  ];

  return (
    <main className="contact_page">
      {/* HEADER */}
      <section className="contact_hero">
        <p className="contact_eyebrow">Contact</p>
        <h1>We would love to hear from you.</h1>
        <p className="contact_lead">
          Questions about sizes, orders or delivery? Send us a message and we
          will reply as soon as we can.
        </p>
      </section>

      {/* INFO CARDS */}
      <section className="contact_cards">
        {cards.map((c) => (
          <div key={c.title} className="contact_card">
            <span className="contact_icon" aria-hidden="true">
              {c.icon}
            </span>
            <h2>{c.title}</h2>
            {c.href ? <a href={c.href}>{c.text}</a> : <p>{c.text}</p>}
          </div>
        ))}
      </section>

      {/* FORM + SIDE */}
      <section className="contact_main">
        <div className="contact_form_box">
          <h2>Send a message</h2>

          {sent ? (
            <div className="contact_success" role="status">
              <strong>Thank you!</strong>
              <p>Your message was sent. We will get back to you soon.</p>
              <button
                type="button"
                className="contact_btn"
                onClick={() => setSent(false)}
              >
                Send another message
              </button>
            </div>
          ) : (
            <form onSubmit={onSubmit}>
              <div className="contact_row">
                <div className="contact_field">
                  <label htmlFor="c-name">Full name</label>
                  <input
                    id="c-name"
                    name="name"
                    type="text"
                    value={form.name}
                    onChange={onChange}
                    required
                  />
                </div>
                <div className="contact_field">
                  <label htmlFor="c-phone">Phone (optional)</label>
                  <input
                    id="c-phone"
                    name="phone"
                    type="tel"
                    value={form.phone}
                    onChange={onChange}
                  />
                </div>
              </div>

              <div className="contact_field">
                <label htmlFor="c-email">Email</label>
                <input
                  id="c-email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={onChange}
                  required
                />
              </div>

              <div className="contact_field">
                <label htmlFor="c-message">Message</label>
                <textarea
                  id="c-message"
                  name="message"
                  rows="6"
                  value={form.message}
                  onChange={onChange}
                  required
                />
              </div>

              <button type="submit" className="contact_btn">
                Send message
              </button>
            </form>
          )}
        </div>

        <aside className="contact_side">
          <h2>Chat with us</h2>
          <p>The fastest way to reach us is a quick message.</p>
          <div className="contact_chat">
            <a href={INFO.telegram} target="_blank" rel="noreferrer">
              <FaTelegramPlane /> Telegram
            </a>
            <a href={INFO.whatsapp} target="_blank" rel="noreferrer">
              <FaWhatsapp /> WhatsApp
            </a>
            <a href={INFO.instagram} target="_blank" rel="noreferrer">
              <FaInstagram /> Instagram
            </a>
          </div>

          <div className="contact_map">
            <iframe
              title="Our location on the map"
              src={`https://www.google.com/maps?q=${encodeURIComponent(
                INFO.mapQuery,
              )}&output=embed`}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </aside>
      </section>
    </main>
  );
};

export default Contacts;
