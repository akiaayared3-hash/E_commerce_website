import { useEffect } from "react";
import { X } from "lucide-react";
import "./css/AdminPages.css";

export default function Modal({ title, onClose, children }) {
  // close with the Escape key
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="pg-overlay" onMouseDown={onClose}>
      <div
        className="pg-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="pg-modal-head">
          <h3>{title}</h3>
          <button className="sa-icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
