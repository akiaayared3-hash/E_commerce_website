import { useState } from "react";
import { Mail, Shield, User } from "lucide-react";
import { useAuth } from "../context/AuthContext"; // adjust path
import "./css/Profile.css";

export default function Profile() {
  const { user } = useAuth();
  const [form, setForm] = useState({
    name: user?.name || user?.first_name || "",
    email: user?.email || "",
  });
  const [saved, setSaved] = useState(false);

  const displayName = user?.name || user?.first_name || "Admin";
  const initials = displayName.slice(0, 2).toUpperCase();
  const role = user?.role || "Administrator";

  const onChange = (e) => {
    setSaved(false);
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const onSubmit = (e) => {
    e.preventDefault();
    // TODO: call your update-profile API here
    setSaved(true);
  };

  return (
    <div className="pf-page">
      <h1 className="pf-title">My Profile</h1>

      <div className="pf-grid">
        {/* Summary card */}
        <aside className="pf-card pf-summary">
          <div className="pf-avatar">{initials}</div>
          <h2>{displayName}</h2>
          <span className="pf-badge">{role}</span>

          <ul className="pf-list">
            <li>
              <Mail size={16} /> {user?.email || "No email"}
            </li>
            <li>
              <Shield size={16} /> {role}
            </li>
          </ul>
        </aside>

        {/* Edit form */}
        <form className="pf-card pf-form" onSubmit={onSubmit}>
          <h3>Personal information</h3>

          <label>
            <span>
              <User size={14} /> Full name
            </span>
            <input name="name" value={form.name} onChange={onChange} required />
          </label>

          <label>
            <span>
              <Mail size={14} /> Email
            </span>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={onChange}
              required
            />
          </label>

          <div className="pf-actions">
            <button type="submit" className="pf-btn">
              Save changes
            </button>
            {saved && <span className="pf-saved">Saved ✓</span>}
          </div>
        </form>
      </div>
    </div>
  );
}
