import React, { useEffect, useState } from "react";
import {
  NavLink,
  Navigate,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { categories as products } from "../component/Assets/product.js";
import { apiRequest } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import "./css/LoginSignUp.css";

const PANEL_ID = 5; // product photo shown on the left panel

const emptyForm = {
  first_name: "",
  last_name: "",
  email: "",
  phone_number: "",
  password: "",
  confirm: "",
  remember: false,
  agree: false,
};

const validate = (mode, v) => {
  const e = {};
  if (mode === "signup") {
    if (v.first_name.trim().length < 2) e.first_name = "Enter your first name.";
    if (v.last_name.trim().length < 2) e.last_name = "Enter your last name.";
    if (!/^\+?[0-9\s-]{9,15}$/.test(v.phone_number.trim()))
      e.phone_number = "Enter a valid phone number.";
  }
  if (!/^\S+@\S+\.\S+$/.test(v.email.trim())) {
    e.email = "Enter a valid email address.";
  }
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
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState(
    searchParams.get("mode") === "signup" ? "signup" : "login",
  );
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [showPass, setShowPass] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | loading | done

  const { user, login } = useAuth();
  const navigate = useNavigate();
  const panel = products.find((p) => p.id === PANEL_ID);
  const isSignup = mode === "signup";

  // lets "Create an account" in the account menu open the signup tab
  useEffect(() => {
    setMode(searchParams.get("mode") === "signup" ? "signup" : "login");
  }, [searchParams]);

  // after success, go to the shop (timer is cleaned up if the page closes)
  useEffect(() => {
    if (status !== "done") return;
    const t = setTimeout(() => navigate("/", { replace: true }), 1200);
    return () => clearTimeout(t);
  }, [status, navigate]);

  const switchMode = (next) => {
    setMode(next);
    setErrors({});
    setStatus("idle");
    setShowPass(false);
    setForm((prev) => ({ ...emptyForm, email: prev.email }));
  };

  const onChange = (e) => {
    const { name, type, value, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    setErrors((prev) => ({ ...prev, [name]: undefined, submit: undefined }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const found = validate(mode, form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setStatus("loading");

    try {
      const endpoint =
        mode === "signup" ? "/api/auth/register" : "/api/auth/login";

      const payload =
        mode === "signup"
          ? {
              first_name: form.first_name.trim(),
              last_name: form.last_name.trim(),
              email: form.email.trim(),
              phone_number: form.phone_number.trim(),
              password: form.password,
            }
          : {
              email: form.email.trim(),
              password: form.password,
            };

      const res = await apiRequest(endpoint, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      // works whether the backend returns { user, token } or { data: { user, token } }
      const data = res?.data ?? res;

      if (!data?.token) {
        throw new Error("Authentication failed. No token received.");
      }

      // saves to localStorage AND updates shared state, so the navbar changes instantly
      login(data.token, data.user);
      setStatus("done");
    } catch (error) {
      setStatus("idle");
      setErrors({ submit: error.message || "Something went wrong." });
    }
  };

  // already logged in? keep them off this page (must stay after all hooks)
  if (user && status !== "done") return <Navigate to="/profile" replace />;

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
                  ? "Account created successfully!"
                  : "Login successful!"}
              </strong>
              <p>You are now logged in. Taking you to the shop...</p>
              <NavLink to="/" className="auth_btn">
                Continue shopping
              </NavLink>
            </div>
          ) : (
            <form onSubmit={onSubmit} noValidate>
              {isSignup && (
                <>
                  <Field
                    id="a-first"
                    label="First name"
                    error={errors.first_name}
                  >
                    <input
                      id="a-first"
                      name="first_name"
                      type="text"
                      autoComplete="given-name"
                      value={form.first_name}
                      onChange={onChange}
                      aria-invalid={!!errors.first_name}
                      aria-describedby={
                        errors.first_name ? "a-first-error" : undefined
                      }
                    />
                  </Field>

                  <Field id="a-last" label="Last name" error={errors.last_name}>
                    <input
                      id="a-last"
                      name="last_name"
                      type="text"
                      autoComplete="family-name"
                      value={form.last_name}
                      onChange={onChange}
                      aria-invalid={!!errors.last_name}
                      aria-describedby={
                        errors.last_name ? "a-last-error" : undefined
                      }
                    />
                  </Field>
                </>
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
                <Field id="a-phone" label="Phone" error={errors.phone_number}>
                  <input
                    id="a-phone"
                    name="phone_number"
                    type="tel"
                    autoComplete="tel"
                    placeholder="+251 9XX XXX XXX"
                    value={form.phone_number}
                    onChange={onChange}
                    aria-invalid={!!errors.phone_number}
                    aria-describedby={
                      errors.phone_number ? "a-phone-error" : undefined
                    }
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
                    onClick={() => setShowPass((s) => !s)}
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

              {errors.submit && (
                <p className="auth_error" role="alert">
                  {errors.submit}
                </p>
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
