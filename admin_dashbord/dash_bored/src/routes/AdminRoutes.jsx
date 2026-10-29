import { Route, Routes, Navigate } from "react-router-dom";

import Admin from "../pages/Admin/Admin.jsx";
import AdminRoute from "../pages/Admin/AdminRoute.jsx";
import Login from "../pages/login/Login.jsx";
import LogOut from "../pages/login/LogOut.jsx";
import Signup from "../pages/login/Signup.jsx";
import Dashboard from "../component/dashboard/DashBoard.jsx";
import Products from "../pages/Products.jsx";
import Inventory from "../pages/Inventory.jsx";
import Categories from "../pages/Categories.jsx";
import Orders from "../pages/Orders.jsx";
import Profile from "../pages/Profile.jsx"; // fixed: the real profile page
import Settings from "../pages/Setings.jsx"; // new: simple placeholder below

function AdminRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/signup" element={<Signup />} />
      <Route path="/login" element={<Login />} />
      <Route path="/logout" element={<LogOut />} />

      {/* Redirect root to admin */}
      <Route path="/" element={<Navigate to="/admin" replace />} />

      {/* Protected admin routes */}
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <Admin />
          </AdminRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="products" element={<Products />} />
        <Route path="orders" element={<Orders />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="categories" element={<Categories />} />
        <Route path="profile" element={<Profile />} />
         <Route path="settings" element={<Settings />} /> 
      </Route>

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
}

export default AdminRoutes;
