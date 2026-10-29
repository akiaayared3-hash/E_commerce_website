import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";

const isAdmin = (user) => String(user?.role ?? "").toLowerCase() === "admin";

export default function AdminRoute({ children }) {
  const { user, loading, logout } = useAuth();
  const location = useLocation();

  if (loading) return <p style={{ padding: 24 }}>Checking access...</p>;

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!isAdmin(user)) {
    return (
      <div style={{ padding: 24 }}>
        <h2>Access denied</h2>
        <p>Your account doesn't have admin permissions.</p>
        <button onClick={logout}>Sign in with another account</button>
      </div>
    );
  }

  return children;
}
