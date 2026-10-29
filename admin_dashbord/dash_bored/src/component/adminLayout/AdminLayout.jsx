import { useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import Sidebar from "../sideBar/SideBar";
import NavBar from "../NavBar/NavBar";
import "../../pages/Admin/Admin.css";

export default function AdminLayout() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token"); // adjust to however you store your auth token
    navigate("/logout");
  };

  return (
    <div className="sa-shell">
      <Sidebar
        open={open}
        onClose={() => setOpen(false)}
        onToggle={() => setOpen((v) => !v)}
        onLogout={handleLogout}
      />
      <div className="sa-main">
        <NavBar onMenu={() => setOpen((v) => !v)} onLogout={handleLogout} />
        <main className="sa-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
