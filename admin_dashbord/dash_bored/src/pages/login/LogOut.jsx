import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Login.css";

export default function Logout() {
  const navigate = useNavigate();

  useEffect(() => {
    // Remove the saved authentication token.
    localStorage.removeItem("token");

    // If your application stores authentication in cookies,
    // you must also invalidate the server-side session.
  }, []);

  return (
    <main className="auth-page">
      <section className="auth-main">
        <div className="logout-panel">
          <Link to="/" className="auth-logo" style={{ margin: "0 auto 48px" }}>
            <span className="brand-symbol">S</span>
            Shop<span>Admin</span>
          </Link>

          <div className="logout-icon" aria-hidden="true">
            ✓
          </div>

          <h1>You have been logged out</h1>

          <p>
            Your local login token has been cleared. Thank you for using
            ShopAdmin. You can sign in again whenever you are ready.
          </p>

          <div className="logout-actions">
            <button
              className="auth-submit"
              onClick={() => navigate("/login", { replace: true })}
            >
              Sign in again →
            </button>

            <Link to="/" className="logout-secondary">
              Return to store
            </Link>
          </div>

          <footer className="auth-footer">
            © {new Date().getFullYear()} ShopAdmin. All rights reserved.
          </footer>
        </div>
      </section>
    </main>
  );
}
