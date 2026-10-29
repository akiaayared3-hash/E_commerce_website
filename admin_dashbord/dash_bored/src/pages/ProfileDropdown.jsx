import { useState, useRef, useEffect } from "react";
import { User, Settings, LogOut, ChevronDown, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext"; // adjust path if needed
import "./css/ProfileDropdowun.css";

function Avatar({ name, initials, url, size = "" }) {
  const [imgError, setImgError] = useState(false);
  return (
    <div className={`pd-avatar ${size}`}>
      {url && !imgError ? (
        <img src={url} alt={name} onError={() => setImgError(true)} />
      ) : (
        initials
      )}
      <span className="pd-status" />
    </div>
  );
}

export default function ProfileDropdown() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const ref = useRef(null);
  const menuRef = useRef(null);

  // Close on outside click + Escape
  useEffect(() => {
    const onMouseDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  // Focus first item when opened
  useEffect(() => {
    if (open) menuRef.current?.querySelector("button")?.focus();
  }, [open]);

  // Arrow-key navigation
  const onMenuKeyDown = (e) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = [...menuRef.current.querySelectorAll("button")];
    const i = items.indexOf(document.activeElement);
    const next = e.key === "ArrowDown" ? i + 1 : i - 1;
    items[(next + items.length) % items.length].focus();
  };

  const goTo = (path) => {
    setOpen(false);
    navigate(path);
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      navigate("/login", { replace: true });
    } finally {
      setLoggingOut(false);
      setOpen(false);
    }
  };

  const displayName = user?.name || user?.first_name || "Admin";
  const initials = displayName.slice(0, 2).toUpperCase();
  const email = user?.email || "";
  const role = user?.role || "Administrator";
  const avatarProps = { name: displayName, initials, url: user?.avatar };

  return (
    <div className="pd-wrapper" ref={ref}>
      <button
        className={`pd-trigger ${open ? "active" : ""}`}
        onClick={() => setOpen((p) => !p)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Avatar {...avatarProps} />
        <div className="pd-info">
          <span className="pd-name">{displayName}</span>
          <span className="pd-role">{role}</span>
        </div>
        <ChevronDown size={16} className={`pd-chevron ${open ? "open" : ""}`} />
      </button>

      {open && (
        <div
          className="pd-dropdown"
          role="menu"
          ref={menuRef}
          onKeyDown={onMenuKeyDown}
        >
          <div className="pd-header">
            <Avatar {...avatarProps} size="lg" />
            <div className="pd-header-text">
              <p className="pd-header-name">{displayName}</p>
              {email && <p className="pd-header-email">{email}</p>}
              <span className="pd-badge">{role}</span>
            </div>
          </div>

          <div className="pd-menu">
            <button
              className="pd-item"
              role="menuitem"
              style={{ "--i": 0 }}
              onClick={() => goTo("/admin/profile")}
            >
              <User size={16} />
              <span>My Profile</span>
            </button>
            <button
              className="pd-item"
              role="menuitem"
              style={{ "--i": 1 }}
              onClick={() => goTo("/admin/settings")}
            >
              <Settings size={16} />
              <span>Settings</span>
            </button>
          </div>

          <div className="pd-divider" />

          <div className="pd-menu">
            <button
              className="pd-item pd-logout"
              role="menuitem"
              style={{ "--i": 2 }}
              onClick={handleLogout}
              disabled={loggingOut}
            >
              {loggingOut ? (
                <Loader2 size={16} className="pd-spin" />
              ) : (
                <LogOut size={16} />
              )}
              <span>{loggingOut ? "Logging out…" : "Logout"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
