import React, { useState, useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import SideBar from "../../component/sideBar/SideBar.jsx";
import NavBar from "../../component/NavBar/NavBar.jsx";
import { apiRequest } from "../../lib/api.js";
import "./admin.css";

const Admin = () => {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Load notifications
  useEffect(() => {
    let isMounted = true;

    const loadNotifications = async () => {
      try {
        const res = await apiRequest("/api/notifications");
        const list =
          res?.data?.notifications || res?.notifications || res?.data || [];

        if (isMounted) {
          setNotifications(Array.isArray(list) ? list : []);
        }
      } catch (err) {
        console.error("Failed to load notifications:", err);
        if (isMounted) setNotifications([]);
      }
    };

    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleMarkAsRead = async (id) => {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );

    try {
      await apiRequest(`/api/notifications/${id}/read`, { method: "PATCH" });
    } catch (err) {
      console.error("Failed to mark as read:", err);
      // Optional: revert if needed
    }
  };

  const handleClearNotifications = async () => {
    const previous = [...notifications];
    setNotifications([]); // Optimistic

    try {
      await apiRequest("/api/notifications/clear", { method: "DELETE" });
    } catch (err) {
      console.error("Failed to clear notifications:", err);
      setNotifications(previous); // Revert on error
    }
  };

  const handleLogout = async () => {
    navigate("/logout", { replace: true });
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const name = user?.first_name || user?.name || user?.email || "Admin";
  const initials = name.slice(0, 2).toUpperCase();
  const email = user?.email || "";

  return (
    <div className="sa-shell">
      <SideBar
        open={open}
        onClose={() => setOpen(false)}
        onToggle={() => setOpen((o) => !o)}
        onLogout={handleLogout}
      />

      <div className="sa-main">
        <NavBar
          user={{ name, initials, email }}
          onMenu={() => setOpen((o) => !o)}
          onLogout={handleLogout}
          notifications={notifications}
          onMarkAsRead={handleMarkAsRead}
          onClearNotifications={handleClearNotifications}
        />

        <main className="sa-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Admin;
