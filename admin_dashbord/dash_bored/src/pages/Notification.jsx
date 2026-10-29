import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  X,
  Inbox,
  LoaderCircle,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import "./css/NotificationDropdown.css";

const MAX_BADGE_COUNT = 9;

function isNotificationRead(notification) {
  const value = notification?.read ?? notification?.is_read ?? false;
  // MySQL often returns 0/1 or "0"/"1"
  return value === true || value === 1 || value === "1";
}

function getNotificationId(notification) {
  return notification?.id ?? notification?.notification_id ?? null;
}

function getNotificationDate(notification) {
  const value =
    notification?.createdAt ??
    notification?.created_at ??
    notification?.timestamp ??
    null;

  if (!value) return notification?.time || "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return notification?.time || "";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function normalizeList(input) {
  const list = Array.isArray(input)
    ? input
    : ([input?.notifications, input?.data, input?.rows].find(Array.isArray) ??
      []);
  return list.filter((n) => n && typeof n === "object");
}

export default function Notification({
  notifications = [],
  loading = false,
  fetchError = "",
  onMarkRead,
  onMarkAllRead,
  onClear,
  onRefresh,
}) {
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [error, setError] = useState("");

  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const panelId = useId();

  const safeNotifications = normalizeList(notifications);
  const unreadCount = safeNotifications.filter(
    (n) => !isNotificationRead(n),
  ).length;

  const hasNotifications = safeNotifications.length > 0;
  const isBusy = clearing || markingAll || busyId !== null;
  const shownError = error || fetchError;

  const closeDropdown = useCallback((restoreFocus = false) => {
    setOpen(false);
    setConfirmClear(false);
    if (restoreFocus) {
      requestAnimationFrame(() => triggerRef.current?.focus());
    }
  }, []);

  // Close on outside click and Escape.
  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        closeDropdown();
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDropdown(true);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, closeDropdown]);

  // Move focus into the panel when it opens.
  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  const handleToggle = () => {
    setError("");
    setConfirmClear(false);
    setOpen((current) => !current);
  };

  const run = async (action, fallbackMessage) => {
    setError("");
    try {
      await action();
    } catch (err) {
      setError(
        err instanceof Error && err.message ? err.message : fallbackMessage,
      );
    }
  };

  const handleMarkRead = async (notification) => {
    const id = getNotificationId(notification);
    if (id == null || typeof onMarkRead !== "function" || isBusy) return;

    setBusyId(id);
    await run(
      () => onMarkRead(id),
      "Could not mark this notification as read.",
    );
    setBusyId(null);
  };

  const handleMarkAll = async () => {
    if (typeof onMarkAllRead !== "function" || isBusy || unreadCount === 0) {
      return;
    }
    setMarkingAll(true);
    await run(() => onMarkAllRead(), "Could not mark notifications as read.");
    setMarkingAll(false);
  };

  const handleClear = async () => {
    if (typeof onClear !== "function" || isBusy || !hasNotifications) return;

    // Two-step confirmation: first click arms, second click deletes.
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }

    setClearing(true);
    await run(() => onClear(), "Could not clear notifications.");
    setClearing(false);
    setConfirmClear(false);
  };

  return (
    <div className="nd-root" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="nd-trigger"
        onClick={handleToggle}
        aria-label={
          unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : "Notifications"
        }
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="true"
      >
        <Bell size={20} aria-hidden="true" />

        {unreadCount > 0 && (
          <span className="nd-count" aria-hidden="true">
            {unreadCount > MAX_BADGE_COUNT
              ? `${MAX_BADGE_COUNT}+`
              : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <section
          ref={panelRef}
          id={panelId}
          className="nd-panel"
          aria-label="Notifications"
          tabIndex={-1}
        >
          <header className="nd-header">
            <div className="nd-heading">
              <div className="nd-heading-icon">
                <Bell size={18} aria-hidden="true" />
              </div>

              <div>
                <h2 className="nd-title">Notifications</h2>
                <p className="nd-subtitle">
                  {unreadCount === 0
                    ? "You're all caught up"
                    : `${unreadCount} unread ${
                        unreadCount === 1 ? "notification" : "notifications"
                      }`}
                </p>
              </div>
            </div>

            <div className="nd-header-actions">
              {typeof onRefresh === "function" && (
                <button
                  type="button"
                  className="nd-close"
                  onClick={() => onRefresh()}
                  aria-label="Refresh notifications"
                  title="Refresh"
                  disabled={loading}
                >
                  <RefreshCw
                    size={16}
                    className={loading ? "nd-spin" : undefined}
                    aria-hidden="true"
                  />
                </button>
              )}

              <button
                type="button"
                className="nd-close"
                onClick={() => closeDropdown(true)}
                aria-label="Close notifications"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
          </header>

          {shownError && (
            <div className="nd-error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              <span>{shownError}</span>
            </div>
          )}

          <div className="nd-toolbar">
            <span className="nd-toolbar-label">Recent activity</span>

            {hasNotifications && (
              <div className="nd-toolbar-actions">
                {unreadCount > 0 && typeof onMarkAllRead === "function" && (
                  <button
                    type="button"
                    className="nd-clear"
                    onClick={handleMarkAll}
                    disabled={isBusy}
                  >
                    {markingAll ? (
                      <LoaderCircle
                        size={14}
                        className="nd-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <CheckCheck size={14} aria-hidden="true" />
                    )}
                    Mark all read
                  </button>
                )}

                <button
                  type="button"
                  className="nd-clear"
                  onClick={handleClear}
                  disabled={isBusy || typeof onClear !== "function"}
                >
                  {clearing ? (
                    <LoaderCircle
                      size={14}
                      className="nd-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Trash2 size={14} aria-hidden="true" />
                  )}
                  {confirmClear ? "Confirm clear" : "Clear all"}
                </button>
              </div>
            )}
          </div>

          <div className="nd-list" aria-busy={isBusy || loading}>
            {loading && !hasNotifications ? (
              <div className="nd-empty">
                <div className="nd-empty-icon">
                  <LoaderCircle
                    size={25}
                    className="nd-spin"
                    aria-hidden="true"
                  />
                </div>
                <h3>Loading…</h3>
                <p>Fetching your latest notifications.</p>
              </div>
            ) : !hasNotifications ? (
              <div className="nd-empty">
                <div className="nd-empty-icon">
                  <Inbox size={25} aria-hidden="true" />
                </div>
                <h3>{fetchError ? "Could not load" : "All caught up"}</h3>
                <p>
                  {fetchError
                    ? "Check your connection and try refreshing."
                    : "New notifications will appear here when there is something you need to know."}
                </p>
              </div>
            ) : (
              <ul className="nd-items">
                {safeNotifications.map((notification, index) => {
                  const id = getNotificationId(notification);
                  const read = isNotificationRead(notification);
                  const itemBusy = busyId === id;

                  return (
                    <li
                      key={id ?? `notification-${index}`}
                      className={`nd-item ${read ? "is-read" : "is-unread"}`}
                    >
                      <span className="nd-status-dot" aria-hidden="true" />

                      <div className="nd-item-content">
                        <div className="nd-item-heading">
                          <p className="nd-item-title">
                            {notification.title || "Notification"}
                          </p>

                          {!read && <span className="nd-new-label">New</span>}
                        </div>

                        {notification.message && (
                          <p className="nd-item-message">
                            {notification.message}
                          </p>
                        )}

                        <time className="nd-time">
                          {getNotificationDate(notification)}
                        </time>
                      </div>

                      {!read && (
                        <button
                          type="button"
                          className="nd-read-button"
                          onClick={() => handleMarkRead(notification)}
                          disabled={
                            isBusy ||
                            id == null ||
                            typeof onMarkRead !== "function"
                          }
                          aria-label={`Mark ${
                            notification.title || "notification"
                          } as read`}
                          title="Mark as read"
                        >
                          {itemBusy ? (
                            <LoaderCircle
                              size={16}
                              className="nd-spin"
                              aria-hidden="true"
                            />
                          ) : (
                            <Check size={16} aria-hidden="true" />
                          )}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {hasNotifications && unreadCount > 0 && (
            <footer className="nd-footer">
              <CheckCheck size={15} aria-hidden="true" />
              <span>
                You have {unreadCount} unread{" "}
                {unreadCount === 1 ? "notification" : "notifications"}
              </span>
            </footer>
          )}
        </section>
      )}
    </div>
  );
}
