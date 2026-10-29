import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import "./Login.css";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(email, password);
      navigate("/admin", { replace: true });
    } catch (err) {
      setError(err.message || "Unable to sign in. Please try again.");
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
          <h1>Everything your store needs, in one place.</h1>
          <p>
            Manage products, track orders, monitor inventory, and keep your
            business moving.
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
            <span className="auth-eyebrow">WELCOME BACK</span>
            <h2>Sign in to your account</h2>
            <p>Enter your credentials to access your dashboard.</p>
          </div>

          {error && (
            <div className="auth-error" role="alert">
              <span aria-hidden="true">!</span>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="auth-field">
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  className="password-toggle"
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? "Signing in..." : "Sign in to dashboard"}
              {!loading && <span aria-hidden="true">→</span>}
            </button>
          </form>

          <div className="auth-divider">
            <span>SECURE ADMIN ACCESS</span>
          </div>

          <p className="auth-help">
            Having trouble accessing your account? Contact your administrator.
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
