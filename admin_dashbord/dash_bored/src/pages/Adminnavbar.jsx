import Notification from "./Notification";
import useNotifications from "./Usenotifications.js";

export default function AdminNavbar() {
  const {
    notifications,
    loading,
    fetchError,
    refresh,
    markRead,
    markAllRead,
    clearAll,
  } = useNotifications();

  return (
    <nav className="admin-navbar">
      {/* ...your logo, links, profile menu... */}

      <Notification
        notifications={notifications}
        loading={loading}
        fetchError={fetchError}
        onMarkRead={markRead}
        onMarkAllRead={markAllRead}
        onClear={clearAll}
        onRefresh={() => refresh()}
      />
    </nav>
  );
}
