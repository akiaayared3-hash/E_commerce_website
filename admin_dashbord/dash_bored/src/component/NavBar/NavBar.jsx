import { Menu } from "lucide-react";
import Notification from "../../pages/Notification"; // adjust path if needed
import ProfileDropdown from "../../pages/ProfileDropdown";
import "./NavBar.css";

const DEFAULT_USER = { name: "Admin", initials: "AD", email: "" };

export default function NavBar({
  onMenu,
  menuOpen, // optional: pass true/false so screen readers know the sidebar state
  onLogout,
  user = DEFAULT_USER,
  notifications,
  notificationsLoading = false,
  notificationsError = "",
  onMarkAsRead,
  onMarkAllAsRead,
  onClearNotifications,
  onRefreshNotifications,
}) {
  return (
    <header className="sa-topbar">
      <div className="sa-topbar-left">
        <button
          type="button"
          className="sa-icon-btn sa-menu-btn"
          onClick={onMenu}
          aria-label="Toggle navigation menu"
          aria-expanded={menuOpen}
        >
          <Menu size={20} aria-hidden="true" />
        </button>
      </div>

      <div className="sa-topbar-right">
        <Notification
          notifications={notifications}
          loading={notificationsLoading}
          fetchError={notificationsError}
          onMarkRead={onMarkAsRead}
          onMarkAllRead={onMarkAllAsRead}
          onClear={onClearNotifications}
          onRefresh={onRefreshNotifications}
        />

        <ProfileDropdown user={user} onLogout={onLogout} />
      </div>
    </header>
  );
}
