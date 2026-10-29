import { NavLink } from "react-router-dom";
import {
  ShoppingCart,
  LayoutDashboard,
  Package,
  ClipboardList,
  Warehouse,
  Tags,
  LogOut,
  MoreHorizontal,
} from "lucide-react";

const links = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/products", label: "Products", icon: Package },
  { to: "/admin/orders", label: "Orders", icon: ClipboardList },
  { to: "/admin/inventory", label: "Inventory", icon: Warehouse },
  { to: "/admin/categories", label: "Categories", icon: Tags },
];

// Mobile bottom bar shows only the first three + "More"
const mobileLinks = links.slice(0, 3);

export default function Sidebar({ open, onClose, onToggle, onLogout }) {
  return (
    <>
      {/* Desktop / tablet drawer */}
      <aside className={`sa-sidebar ${open ? "is-open" : ""}`}>
        <div className="sa-brand">
          <ShoppingCart size={26} className="sa-brand-icon" />
          <span>
            Shop<b>Admin</b>
          </span>
        </div>

        <nav className="sa-nav">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onClose}
              className={({ isActive }) =>
                `sa-link ${isActive ? "active" : ""}`
              }
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <button className="sa-link sa-logout" onClick={onLogout}>
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </aside>

      {open && <div className="sa-backdrop" onClick={onClose} />}

      {/* Mobile bottom navigation */}
      <nav className="sa-bottom-nav">
        {mobileLinks.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `sa-bottom-link ${isActive ? "active" : ""}`
            }
          >
            <Icon size={20} />
            <span>{label}</span>
          </NavLink>
        ))}
        <button className="sa-bottom-link" onClick={onToggle}>
          <MoreHorizontal size={20} />
          <span>More</span>
        </button>
      </nav>
    </>
  );
}
