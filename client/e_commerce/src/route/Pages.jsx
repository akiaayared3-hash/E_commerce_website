import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import NaveBar from "../component/NavBar/NavBar";
import Footer from "../component/footer/Footer";
import HomePage from "../component/HomePages/HomePage";
import Category from "../page/Category";
import Contacts from "../component/contacts/Contacts";
import Product from "../page/Product";
import LoginSignup from "../page/LoginSignup";
import Cart from "../page/Cart";
import { WishList } from "../page/WishList";
import WishlistPage from "../page/WhisListPage";
import ScrollToTop from "../component/ScrollToTop/ScrollToTop";
import Checkout from "../component/checkOut/CheckOut";
import OrderSuccess from "../page/OrderSuccess";
import SearchPage from "../page/Searchpage";
import { categories as products } from "../../src/component/Assets/product.js";
import { AuthProvider } from "../context/AuthContext.jsx";
import ProtectedRoute from "../page/ProtectedRoute.jsx";
import Profile from "../page/Profile.jsx";

// ✅ Only one correct import
import { CartProvider } from "../context/CartContext.jsx";

const Pages = () => {
  return (
    <CartProvider>
      <WishList>
        <BrowserRouter>
          <ScrollToTop />
          <AuthProvider>
            <NaveBar />
            <Routes>
              <Route
                path="/search"
                element={<SearchPage products={products} />}
              />
              <Route path="/" element={<HomePage />} />
              <Route path="/home" element={<Navigate to="/" replace />} />

              <Route
                path="/new_arrivals"
                element={<Category title="New Arrivals" />}
              />
              <Route
                path="/clothes"
                element={<Category title="Clothes" category="clothes" />}
              />
              <Route
                path="/shoes"
                element={<Category title="Shoes" category="shoes" />}
              />
              <Route
                path="/t_shirt"
                element={<Category title="T-Shirts" category="t_shirt" />}
              />

              <Route path="/contacts" element={<Contacts />} />
              <Route path="/login" element={<LoginSignup />} />

              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                }
              />
              <Route path="/cart" element={<Cart />} />
              <Route path="/wishList" element={<WishlistPage />} />
              <Route path="/product/:productId" element={<Product />} />

              <Route
                path="/checkout"
                element={
                  <ProtectedRoute>
                    <Checkout />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/order-success/:orderId"
                element={<OrderSuccess />}
              />

              {/* 404 – keep it last */}
              <Route
                path="*"
                element={<h1 style={{ padding: 40 }}>Page not found</h1>}
              />
            </Routes>
            <Footer />
          </AuthProvider>
        </BrowserRouter>
      </WishList>
    </CartProvider>
  );
};

export default Pages;
