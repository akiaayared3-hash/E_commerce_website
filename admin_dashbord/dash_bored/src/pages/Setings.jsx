import { useState } from "react";
import { User, Lock, Bell, Store } from "lucide-react";
import { useAuth } from "../context/AuthContext"; // adjust path
import "./css/Setinges.css";

const TABS = [
  { id: "account", label: "Account", icon: User },
  { id: "password", label: "Password", icon: Lock },
  { id: "store", label: "Store", icon: Store },
  { id: "notifications", label: "Notifications", icon: Bell },
];

function Toggle({ checked, onChange, label, hint }) {
  return (
    <label className="st-toggle-row">
      <div>
        <span className="st-toggle-label">{label}</span>
        {hint && <span className="st-toggle-hint">{hint}</span>}
      </div>
      <input
        type="checkbox"
        className="st-switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

export default function Settings() {
  const { user } = useAuth();
  const [tab, setTab] = useState("account");
  const [message, setMessage] = useState(null); // { type: "ok" | "error", text }

  const [account, setAccount] = useState({
    name: user?.name || user?.first_name || "",
    email: user?.email || "",
  });
  const [password, setPassword] = useState({
    current: "",
    next: "",
    confirm: "",
  });
  const [store, setStore] = useState({
    name: "ShopAdmin",
    currency: "USD",
    lowStock: 5,
  });
  const [notify, setNotify] = useState({
    orders: true,
    lowStock: true,
    email: false,
  });

  const flash = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const saveAccount = (e) => {
    e.preventDefault();
    // TODO: call your update-account API
    flash("ok", "Account updated");
  };

  const savePassword = (e) => {
    e.preventDefault();
    if (password.next.length < 8)
      return flash("error", "New password must be at least 8 characters");
    if (password.next !== password.confirm)
      return flash("error", "Passwords do not match");
    // TODO: call your change-password API
    setPassword({ current: "", next: "", confirm: "" });
    flash("ok", "Password changed");
  };

  const saveStore = (e) => {
    e.preventDefault();
    // TODO: call your store-settings API
    flash("ok", "Store settings saved");
  };

  const saveNotify = (e) => {
    e.preventDefault();
    // TODO: call your preferences API
    flash("ok", "Preferences saved");
  };

  return (
    <div className="st-page">
      <h1 className="st-title">Settings</h1>

      {message && (
        <div className={`st-alert ${message.type}`}>{message.text}</div>
      )}

      <div className="st-layout">
        <nav className="st-tabs" aria-label="Settings sections">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={`st-tab ${tab === id ? "active" : ""}`}
              onClick={() => setTab(id)}
            >
              <Icon size={16} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="st-card">
          {tab === "account" && (
            <form onSubmit={saveAccount}>
              <h3>Account</h3>
              <p className="st-sub">Update your name and email address.</p>
              <label className="st-field">
                <span>Full name</span>
                <input
                  value={account.name}
                  required
                  onChange={(e) =>
                    setAccount({ ...account, name: e.target.value })
                  }
                />
              </label>
              <label className="st-field">
                <span>Email</span>
                <input
                  type="email"
                  value={account.email}
                  required
                  onChange={(e) =>
                    setAccount({ ...account, email: e.target.value })
                  }
                />
              </label>
              <button className="st-btn">Save changes</button>
            </form>
          )}

          {tab === "password" && (
            <form onSubmit={savePassword}>
              <h3>Change password</h3>
              <p className="st-sub">Use at least 8 characters.</p>
              <label className="st-field">
                <span>Current password</span>
                <input
                  type="password"
                  value={password.current}
                  required
                  autoComplete="current-password"
                  onChange={(e) =>
                    setPassword({ ...password, current: e.target.value })
                  }
                />
              </label>
              <label className="st-field">
                <span>New password</span>
                <input
                  type="password"
                  value={password.next}
                  required
                  autoComplete="new-password"
                  onChange={(e) =>
                    setPassword({ ...password, next: e.target.value })
                  }
                />
              </label>
              <label className="st-field">
                <span>Confirm new password</span>
                <input
                  type="password"
                  value={password.confirm}
                  required
                  autoComplete="new-password"
                  onChange={(e) =>
                    setPassword({ ...password, confirm: e.target.value })
                  }
                />
              </label>
              <button className="st-btn">Update password</button>
            </form>
          )}

          {tab === "store" && (
            <form onSubmit={saveStore}>
              <h3>Store</h3>
              <p className="st-sub">General settings for your shop.</p>
              <label className="st-field">
                <span>Store name</span>
                <input
                  value={store.name}
                  required
                  onChange={(e) => setStore({ ...store, name: e.target.value })}
                />
              </label>
              <label className="st-field">
                <span>Currency</span>
                <select
                  value={store.currency}
                  onChange={(e) =>
                    setStore({ ...store, currency: e.target.value })
                  }
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="ETB">ETB (Br)</option>
                </select>
              </label>
              <label className="st-field">
                <span>Low stock alert at</span>
                <input
                  type="number"
                  min="0"
                  value={store.lowStock}
                  onChange={(e) =>
                    setStore({ ...store, lowStock: Number(e.target.value) })
                  }
                />
              </label>
              <button className="st-btn">Save changes</button>
            </form>
          )}

          {tab === "notifications" && (
            <form onSubmit={saveNotify}>
              <h3>Notifications</h3>
              <p className="st-sub">Choose what you want to be told about.</p>
              <Toggle
                label="New orders"
                hint="When a customer places an order"
                checked={notify.orders}
                onChange={(v) => setNotify({ ...notify, orders: v })}
              />
              <Toggle
                label="Low stock"
                hint="When a product runs below the alert level"
                checked={notify.lowStock}
                onChange={(v) => setNotify({ ...notify, lowStock: v })}
              />
              <Toggle
                label="Email summaries"
                hint="A daily summary by email"
                checked={notify.email}
                onChange={(v) => setNotify({ ...notify, email: v })}
              />
              <button className="st-btn">Save preferences</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
