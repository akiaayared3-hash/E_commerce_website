import React, { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  FaRegUser,
  FaRegHeart,
  FaSignInAlt,
  FaSignOutAlt,
} from "react-icons/fa";
import { useAuth } from "../../context/AuthContext.jsx";
import "./AccountMenu.css";

const AccountMenu = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const timer = useRef(null);

  const show = () => {
    clearTimeout(timer.current);
    setOpen(true);
  };
  const hide = () => {
    timer.current = setTimeout(() => setOpen(false), 150);
  };
  const close = () => setOpen(false);

  useEffect(() => {
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target))
        setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
      clearTimeout(timer.current);
    };
  }, []);

  const handleLogout = () => {
    close();
    logout();
    navigate("/", { replace: true });
  };

  const initial = (user?.first_name?.[0] || "U").toUpperCase();

  return (
    <div
      className="account_menu"
      ref={wrapRef}
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      <button
        type="button"
        className="header_action account_trigger"
        aria-label={user ? "Account menu" : "Sign in menu"}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={show}
      >
        {user ? (
          <span className="account_initial">{initial}</span>
        ) : (
          <FaRegUser />
        )}
      </button>

      {open && (
        <div className="account_dropdown" role="menu">
          {user ? (
            <>
              <div className="account_head">
                <span className="account_avatar">{initial}</span>
                <div className="account_who">
                  <strong>
                    {user.first_name} {user.last_name}
                  </strong>
                  <small>{user.email}</small>
                </div>
              </div>

              <NavLink
                to="/profile"
                className="account_item"
                role="menuitem"
                onClick={close}
              >
                <FaRegUser /> My profile
              </NavLink>
              <NavLink
                to="/wishList"
                className="account_item"
                role="menuitem"
                onClick={close}
              >
                <FaRegHeart /> Wishlist
              </NavLink>
              <button
                type="button"
                className="account_item account_logout"
                role="menuitem"
                onClick={handleLogout}
              >
                <FaSignOutAlt /> Log out
              </button>
            </>
          ) : (
            <>
              <p className="account_hello">Welcome to the store</p>
              <NavLink
                to="/login"
                className="account_btn"
                role="menuitem"
                onClick={close}
              >
                <FaSignInAlt /> Sign in
              </NavLink>
              <p className="account_new">
                New customer?{" "}
                <NavLink to="/login?mode=signup" onClick={close}>
                  Create an account
                </NavLink>
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default AccountMenu;
