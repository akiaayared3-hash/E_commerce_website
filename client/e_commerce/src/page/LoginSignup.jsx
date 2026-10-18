import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { categories as products } from "../component/Assets/product.js";
import "./css/LoginSignUp.css";

const PANEL_ID = 5; // product photo shown on the left panel

const emptyForm = {
  name: "",
  email: "",
  phone: "",
  password: "",
  confirm: "",
  remember: false,
  agree: false,
};

const validate = (mode, v) => {
  const e = {};
  if (mode === "signup" && v.name.trim().length < 2)
    e.name = "Enter your full name.";
  if (!/^\S+@\S+\.\S+$/.test(v.email.trim()))
    e.email = "Enter a valid email address.";
  if (v.password.length < 8) e.password = "Use at least 8 characters.";
  if (mode === "signup") {
    if (v.confirm !== v.password) e.confirm = "Passwords do not match.";
    if (!v.agree) e.agree = "Please accept the terms to continue.";
  }
  return e;
};

/* one labelled input with its error message */
const Field = ({ id, label, error, children }) => (
  <div className={`auth_field ${error ? "has_error" : ""}`}>
    <label htmlFor={id}>{label}</label>
    {children}
    {error && (
      <span className="auth_error" id={`${id}-error`} role="alert">
        {error}
      </span>
    )}
  </div>
);

const LoginSignup = () => {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [showPass, setShowPass] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | loading | done

  const panel = products.find((p) => p.id === PANEL_ID);
  const isSignup = mode === "signup";

  const switchMode = (next) => {
    setMode(next);
    setErrors({});
    setStatus("idle");
    setShowPass(false);
    setForm({ ...emptyForm, email: form.email });
  };

  const onChange = (e) => {
    const { name, type, value, checked } = e.target;
    setForm({ ...form, [name]: type === "checkbox" ? checked : value });
    if (errors[name]) setErrors({ ...errors, [name]: undefined });
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const found = validate(mode, form);
    setErrors(found);
    if (Object.keys(found).length) return;

    setStatus("loading");
    // TODO: send to your backend over HTTPS, for example:
    // await fetch("/api/auth/" + mode, { method: "POST", ... })
    // Never save the password in localStorage or log it.
    await new Promise((r) => setTimeout(r, 600));
    setStatus("done");
  };

  return (
    <main className="auth_page">
      <div className="auth_shell">
        {/* LEFT PHOTO PANEL */}
        <aside className="auth_panel">
          {panel && <img src={panel.image} alt="" />}
          <div className="auth_panel_overlay" />
          <div className="auth_panel_text">
            <p className="auth_eyebrow">Members</p>
            <h2>Dress with quiet confidence.</h2>
            <p>Save your favourites, track your orders and check out faster.</p>
          </div>
        </aside>

        {/* RIGHT FORM */}
        <section className="auth_card">
          <div className="auth_tabs" role="tablist" aria-label="Account">
            <button
              type="button"
              role="tab"
              aria-selected={!isSignup}
              className={!isSignup ? "tab active" : "tab"}
              onClick={() => switchMode("login")}
            >
              Log in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={isSignup}
              className={isSignup ? "tab active" : "tab"}
              onClick={() => switchMode("signup")}
            >
              Sign up
            </button>
          </div>

          <h1>{isSignup ? "Create your account" : "Welcome back"}</h1>
          <p className="auth_sub">
            {isSignup
              ? "Join us in a minute and start shopping."
              : "Log in to see your wishlist and orders."}
          </p>

          {status === "done" ? (
            <div className="auth_success" role="status">
              <strong>
                {isSignup
                  ? "Account request received."
                  : "Login request received."}
              </strong>
              <p>
                This page is ready for your server. Connect the form to your
                backend to finish the process.
              </p>
              <NavLink to="/" className="auth_btn">
                Continue shopping
              </NavLink>
            </div>
          ) : (
            <form onSubmit={onSubmit} noValidate>
              {isSignup && (
                <Field id="a-name" label="Full name" error={errors.name}>
                  <input
                    id="a-name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    value={form.name}
                    onChange={onChange}
                    aria-invalid={!!errors.name}
                    aria-describedby={errors.name ? "a-name-error" : undefined}
                  />
                </Field>
              )}

              <Field id="a-email" label="Email" error={errors.email}>
                <input
                  id="a-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={onChange}
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? "a-email-error" : undefined}
                />
              </Field>

              {isSignup && (
                <Field id="a-phone" label="Phone (optional)">
                  <input
                    id="a-phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    placeholder="+251 9XX XXX XXX"
                    value={form.phone}
                    onChange={onChange}
                  />
                </Field>
              )}

              <Field id="a-pass" label="Password" error={errors.password}>
                <div className="auth_pass">
                  <input
                    id="a-pass"
                    name="password"
                    type={showPass ? "text" : "password"}
                    autoComplete={
                      isSignup ? "new-password" : "current-password"
                    }
                    value={form.password}
                    onChange={onChange}
                    aria-invalid={!!errors.password}
                    aria-describedby={
                      errors.password ? "a-pass-error" : undefined
                    }
                  />
                  <button
                    type="button"
                    className="auth_eye"
                    aria-label={showPass ? "Hide password" : "Show password"}
                    onClick={() => setShowPass(!showPass)}
                  >
                    {showPass ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </Field>

              {isSignup && (
                <Field
                  id="a-confirm"
                  label="Confirm password"
                  error={errors.confirm}
                >
                  <input
                    id="a-confirm"
                    name="confirm"
                    type={showPass ? "text" : "password"}
                    autoComplete="new-password"
                    value={form.confirm}
                    onChange={onChange}
                    aria-invalid={!!errors.confirm}
                    aria-describedby={
                      errors.confirm ? "a-confirm-error" : undefined
                    }
                  />
                </Field>
              )}

              {!isSignup ? (
                <div className="auth_row">
                  <label className="auth_check">
                    <input
                      type="checkbox"
                      name="remember"
                      checked={form.remember}
                      onChange={onChange}
                    />
                    Remember me
                  </label>
                  <NavLink to="/forgot-password" className="auth_link">
                    Forgot password?
                  </NavLink>
                </div>
              ) : (
                <div
                  className={`auth_field ${errors.agree ? "has_error" : ""}`}
                >
                  <label className="auth_check">
                    <input
                      type="checkbox"
                      name="agree"
                      checked={form.agree}
                      onChange={onChange}
                    />
                    <span>
                      I agree to the{" "}
                      <NavLink to="/terms" className="auth_link">
                        Terms
                      </NavLink>{" "}
                      and{" "}
                      <NavLink to="/privacy" className="auth_link">
                        Privacy Policy
                      </NavLink>
                      .
                    </span>
                  </label>
                  {errors.agree && (
                    <span className="auth_error" role="alert">
                      {errors.agree}
                    </span>
                  )}
                </div>
              )}

              <button
                type="submit"
                className="auth_btn"
                disabled={status === "loading"}
              >
                {status === "loading"
                  ? "Please wait..."
                  : isSignup
                    ? "Create account"
                    : "Log in"}
              </button>

              <p className="auth_switch">
                {isSignup ? "Already have an account?" : "New here?"}{" "}
                <button
                  type="button"
                  className="auth_link as_button"
                  onClick={() => switchMode(isSignup ? "login" : "signup")}
                >
                  {isSignup ? "Log in" : "Create an account"}
                </button>
              </p>
            </form>
          )}
        </section>
      </div>
    </main>
  );
};

export default LoginSignup;
