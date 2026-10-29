import React, { useEffect, useState } from "react";
import { NavLink, useNavigate, useSearchParams } from "react-router-dom";
import {
  FaRegUser,
  FaIdCard,
  FaBoxOpen,
  FaLock,
  FaSignOutAlt,
  FaRegHeart,
  FaShoppingBag,
  FaEye,
  FaEyeSlash,
} from "react-icons/fa";

import MyOrders from "./MyOrders.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useWishList } from "./WishList";
import { useCart } from "../context/CartContext.jsx";
import { apiRequest } from "../lib/api.js";
import "./css/Profile.css";

const TABS = [
  { id: "overview", label: "Overview", icon: <FaRegUser /> },
  { id: "details", label: "Personal details", icon: <FaIdCard /> },
  { id: "orders", label: "My orders", icon: <FaBoxOpen /> },
  { id: "security", label: "Password", icon: <FaLock /> },
];

const TAB_IDS = TABS.map(({ id }) => id);

const IDLE = { busy: false, ok: "", err: "" };

const EMPTY_PASSWORD = {
  current_password: "",
  new_password: "",
  confirm: "",
};

const PHONE_RE = /^\+?[0-9\s-]{9,15}$/;

const getErrorMessage = (error, fallback) =>
  typeof error?.message === "string" && error.message.trim()
    ? error.message
    : fallback;

const Alert = ({ type, children }) =>
  children ? (
    <p
      className={`pf_alert pf_alert_${type}`}
      role={type === "error" ? "alert" : "status"}
    >
      {children}
    </p>
  ) : null;

const PasswordField = ({
  label,
  value,
  onChange,
  autoComplete,
  required = true,
}) => {
  const [show, setShow] = useState(false);

  return (
    <label className="pf_field">
      {label}

      <span className="pf_pw">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          required={required}
        />

        <button
          type="button"
          className="pf_pw_toggle"
          onClick={() => setShow((previous) => !previous)}
          aria-label={show ? "Hide password" : "Show password"}
          aria-pressed={show}
        >
          {show ? <FaEyeSlash /> : <FaEye />}
        </button>
      </span>
    </label>
  );
};

const Profile = () => {
  const { user, logout, updateUser } = useAuth();
  const { count: wishCount = 0 } = useWishList();
  const { count: cartCount = 0 } = useCart();

  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const requestedTab = params.get("tab");
  const tab = TAB_IDS.includes(requestedTab) ? requestedTab : "overview";

  const [details, setDetails] = useState({
    first_name: "",
    last_name: "",
    phone_number: "",
  });

  const [password, setPassword] = useState(EMPTY_PASSWORD);
  const [detailsState, setDetailsState] = useState(IDLE);
  const [passwordState, setPasswordState] = useState(IDLE);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    setDetails({
      first_name: user?.first_name ?? "",
      last_name: user?.last_name ?? "",
      phone_number: user?.phone_number ?? "",
    });
  }, [user?.first_name, user?.last_name, user?.phone_number]);

  const initial =
    String(user?.first_name || "U")
      .trim()
      .charAt(0)
      .toUpperCase() || "U";

  const fullName = [user?.first_name, user?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  const joined = user?.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
      })
    : null;

  const goTab = (id) => {
    setDetailsState(IDLE);
    setPasswordState(IDLE);

    setParams(id === "overview" ? {} : { tab: id }, { replace: true });
  };

  const handleLogout = async () => {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      await logout();
    } finally {
      navigate("/", { replace: true });
      setLoggingOut(false);
    }
  };

  const editDetails = (field) => (event) => {
    const value = event.target.value;

    setDetailsState(IDLE);
    setDetails((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const saveDetails = async (event) => {
    event.preventDefault();

    if (detailsState.busy) return;

    const payload = {
      first_name: details.first_name.trim(),
      last_name: details.last_name.trim(),
      phone_number: details.phone_number.trim(),
    };

    if (payload.first_name.length < 2 || payload.last_name.length < 2) {
      setDetailsState({
        ...IDLE,
        err: "Enter your first and last name.",
      });
      return;
    }

    if (!PHONE_RE.test(payload.phone_number)) {
      setDetailsState({
        ...IDLE,
        err: "Enter a valid phone number.",
      });
      return;
    }

    setDetailsState({ ...IDLE, busy: true });

    try {
      const response = await apiRequest("/api/users/me", {
        method: "PUT",
        body: payload,
      });

      const updatedUser =
        response?.user ?? response?.data?.user ?? response?.data ?? {};

      updateUser({
        ...user,
        ...updatedUser,
        ...payload,
      });

      setDetailsState({
        ...IDLE,
        ok: "Your details were saved.",
      });
    } catch (error) {
      setDetailsState({
        ...IDLE,
        err: getErrorMessage(
          error,
          "Could not save your details. Please try again.",
        ),
      });
    }
  };

  const editPassword = (field) => (event) => {
    setPasswordState(IDLE);

    setPassword((previous) => ({
      ...previous,
      [field]: event.target.value,
    }));
  };

  const savePassword = async (event) => {
    event.preventDefault();

    if (passwordState.busy) return;

    if (!password.current_password) {
      setPasswordState({
        ...IDLE,
        err: "Enter your current password.",
      });
      return;
    }

    if (password.new_password.length < 8) {
      setPasswordState({
        ...IDLE,
        err: "New password must be at least 8 characters.",
      });
      return;
    }

    if (password.new_password === password.current_password) {
      setPasswordState({
        ...IDLE,
        err: "Your new password must differ from your current password.",
      });
      return;
    }

    if (password.new_password !== password.confirm) {
      setPasswordState({
        ...IDLE,
        err: "Passwords do not match.",
      });
      return;
    }

    setPasswordState({ ...IDLE, busy: true });

    try {
      await apiRequest("/api/users/me/password", {
        method: "PUT",
        body: {
          current_password: password.current_password,
          new_password: password.new_password,
        },
      });

      setPassword(EMPTY_PASSWORD);
      setPasswordState({
        ...IDLE,
        ok: "Password updated successfully.",
      });
    } catch (error) {
      setPasswordState({
        ...IDLE,
        err: getErrorMessage(
          error,
          "Could not update your password. Please try again.",
        ),
      });
    }
  };

  return (
    <main className="pf_page">
      <div className="pf_shell">
        <aside className="pf_side">
          <div className="pf_user">
            <span className="pf_avatar" aria-hidden="true">
              {initial}
            </span>

            <div className="pf_user_text">
              <strong>{fullName || "My account"}</strong>
              <small>{user?.email || ""}</small>
            </div>
          </div>

          <nav className="pf_nav" aria-label="Account sections">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={tab === item.id ? "pf_tab pf_active" : "pf_tab"}
                aria-current={tab === item.id ? "page" : undefined}
                onClick={() => goTab(item.id)}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}

            <button
              type="button"
              className="pf_tab pf_danger"
              onClick={handleLogout}
              disabled={loggingOut}
            >
              <FaSignOutAlt />
              <span>{loggingOut ? "Logging out..." : "Log out"}</span>
            </button>
          </nav>
        </aside>

        <section className="pf_content">
          {tab === "overview" && (
            <>
              <h1>
                Welcome back{user?.first_name ? `, ${user.first_name}` : ""}
              </h1>

              <p className="pf_sub">
                Manage your details, orders and security from one place.
              </p>

              <div className="pf_stats">
                <NavLink to="/wishList" className="pf_stat">
                  <FaRegHeart />
                  <strong>{wishCount}</strong>
                  <span>Wishlist items</span>
                </NavLink>

                <NavLink to="/cart" className="pf_stat">
                  <FaShoppingBag />
                  <strong>{cartCount}</strong>
                  <span>In your cart</span>
                </NavLink>

                <button
                  type="button"
                  className="pf_stat"
                  onClick={() => goTab("orders")}
                >
                  <FaBoxOpen />
                  <strong>View</strong>
                  <span>Your orders</span>
                </button>
              </div>

              <div className="pf_card">
                <h2>Account summary</h2>

                <dl className="pf_list">
                  <div>
                    <dt>Name</dt>
                    <dd>{fullName || "-"}</dd>
                  </div>

                  <div>
                    <dt>Email</dt>
                    <dd>{user?.email || "-"}</dd>
                  </div>

                  <div>
                    <dt>Phone</dt>
                    <dd>{user?.phone_number || "-"}</dd>
                  </div>

                  {joined && (
                    <div>
                      <dt>Member since</dt>
                      <dd>{joined}</dd>
                    </div>
                  )}
                </dl>
              </div>
            </>
          )}

          {tab === "details" && (
            <>
              <h1>Personal details</h1>
              <p className="pf_sub">Update your name and phone number.</p>

              <form className="pf_card" onSubmit={saveDetails} noValidate>
                <div className="pf_grid">
                  <label className="pf_field">
                    First name
                    <input
                      value={details.first_name}
                      onChange={editDetails("first_name")}
                      autoComplete="given-name"
                      required
                    />
                  </label>

                  <label className="pf_field">
                    Last name
                    <input
                      value={details.last_name}
                      onChange={editDetails("last_name")}
                      autoComplete="family-name"
                      required
                    />
                  </label>
                </div>

                <label className="pf_field">
                  Email
                  <input type="email" value={user?.email || ""} disabled />
                  <small>Email cannot be changed.</small>
                </label>

                <label className="pf_field">
                  Phone
                  <input
                    type="tel"
                    value={details.phone_number}
                    onChange={editDetails("phone_number")}
                    autoComplete="tel"
                    required
                  />
                </label>

                <Alert type="error">{detailsState.err}</Alert>
                <Alert type="ok">{detailsState.ok}</Alert>

                <button
                  type="submit"
                  className="pf_btn"
                  disabled={detailsState.busy}
                >
                  {detailsState.busy ? "Saving..." : "Save changes"}
                </button>
              </form>
            </>
          )}

          {tab === "orders" && (
            <>
              <h1>My orders</h1>
              <p className="pf_sub">Track and review your purchases.</p>

              <MyOrders />
            </>
          )}

          {tab === "security" && (
            <>
              <h1>Password</h1>
              <p className="pf_sub">
                Use at least 8 characters for your new password.
              </p>

              <form className="pf_card" onSubmit={savePassword} noValidate>
                <PasswordField
                  label="Current password"
                  value={password.current_password}
                  onChange={editPassword("current_password")}
                  autoComplete="current-password"
                />

                <PasswordField
                  label="New password"
                  value={password.new_password}
                  onChange={editPassword("new_password")}
                  autoComplete="new-password"
                />

                <PasswordField
                  label="Confirm new password"
                  value={password.confirm}
                  onChange={editPassword("confirm")}
                  autoComplete="new-password"
                />

                <Alert type="error">{passwordState.err}</Alert>
                <Alert type="ok">{passwordState.ok}</Alert>

                <button
                  type="submit"
                  className="pf_btn"
                  disabled={passwordState.busy}
                >
                  {passwordState.busy ? "Updating..." : "Update password"}
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </main>
  );
};

export default Profile;
