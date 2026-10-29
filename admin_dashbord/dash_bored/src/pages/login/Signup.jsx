import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiRequest } from "../../lib/api.js";
import "./Login.css"; // Reuse the same CSS as Login

export default function Signup() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    // Basic validation
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (form.password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    try {
      await apiRequest("/api/auth/register", {
        method: "POST",
        body: {
          first_name: form.first_name,
          last_name: form.last_name,
          email: form.email,
          password: form.password,
        },
      });

      // After successful signup, redirect to login
      navigate("/login", { replace: true });
    } catch (err) {
      setError(err.message || "Unable to create account. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-brand">
        <Link to="/" className="auth-logo">
          <span className="brand-symbol">S</span>
          Shop<span>Admin</span>
        </Link>

        <div className="brand-content">
          <span className="brand-label">ADMINISTRATION</span>
          <h1>Create your admin account</h1>
          <p>
            Join the platform and start managing your store with powerful tools.
          </p>
        </div>

        <div className="brand-bottom">
          Secure access to your store management workspace.
        </div>
      </section>

      <section className="auth-main">
        <div className="auth-card">
          <div className="mobile-logo">
            <Link to="/" className="auth-logo">
              <span className="brand-symbol">S</span>
              Shop<span>Admin</span>
            </Link>
          </div>

          <div className="auth-heading">
            <span className="auth-eyebrow">GET STARTED</span>
            <h2>Create an account</h2>
            <p>Fill in the details below to get started.</p>
          </div>

          {error && (
            <div className="auth-error" role="alert">
              <span aria-hidden="true">!</span>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="auth-field">
              <label htmlFor="first_name">First Name</label>
              <input
                id="first_name"
                name="first_name"
                type="text"
                placeholder="John"
                value={form.first_name}
                onChange={handleChange}
                required
              />
            </div>

            <div className="auth-field">
              <label htmlFor="last_name">Last Name</label>
              <input
                id="last_name"
                name="last_name"
                type="text"
                placeholder="Doe"
                value={form.last_name}
                onChange={handleChange}
                required
              />
            </div>

            <div className="auth-field">
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="admin@example.com"
                value={form.email}
                onChange={handleChange}
                autoComplete="username"
                required
              />
            </div>

            <div className="auth-field">
              <label htmlFor="password">Password</label>
              <div className="password-wrap">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a password"
                  value={form.password}
                  onChange={handleChange}
                  autoComplete="new-password"
                  required
                />
                <button
                  className="password-toggle"
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showPassword ? "text" : "password"}
                placeholder="Confirm your password"
                value={form.confirmPassword}
                onChange={handleChange}
                autoComplete="new-password"
                required
              />
            </div>

            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? "Creating account..." : "Create account"}
              {!loading && <span aria-hidden="true">→</span>}
            </button>
          </form>

          <div className="auth-divider">
            <span>ALREADY HAVE AN ACCOUNT?</span>
          </div>

          <p className="auth-help">
            <Link to="/login">Sign in instead</Link>
          </p>

          <Link to="/" className="auth-back">
            ← Back to store
          </Link>
        </div>

        <footer className="auth-footer">
          © {new Date().getFullYear()} ShopAdmin. All rights reserved.
        </footer>
      </section>
    </main>
  );
}
