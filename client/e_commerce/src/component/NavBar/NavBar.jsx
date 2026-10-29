import { useState } from "react";
import { NavLink } from "react-router-dom";
import { FaRegHeart, FaShoppingBag, FaBars, FaTimes } from "react-icons/fa";
import AccountMenu from "../AccountMenu/AccountMenu";
import { useWishList } from "../../page/WishList";
import { useCart } from "../../context/CartContext"; // ← correct path
import { categories as products } from "../Assets/product.js";
import logo_headers from "../Assets/logo_headers.png";
import ProductSearch from "../ProductSearch/ProductSearch.jsx";
import "./NavBar.css";

const NavBar = () => {
  const [open, setOpen] = useState(false);
  const { count } = useWishList();
  const { count: cartCount } = useCart(); // ← only call hooks inside the component

  const closeMenu = () => setOpen(false);

  return (
    <>
      <div className="header_wrapper">
        {/* top headers */}
        <div className="top_headers">
          <div className="logo">
            <NavLink to="/">
              <img src={logo_headers} alt="logo" />
            </NavLink>
          </div>
          <div className="search_slot" style={{ flex: 1, minWidth: 0 }}>
            <ProductSearch
              products={products}
              placeholder="search clothes, shoes, t-shirt ...."
            />
          </div>
        </div>

        {/* main headers */}
        <div className="main_headers">
          <button
            className="menu_btn"
            aria-label="Toggle menu"
            onClick={() => setOpen(!open)}
          >
            {open ? <FaTimes /> : <FaBars />}
          </button>

          <nav className={`page_headers ${open ? "open" : ""}`}>
            <ul>
              <li>
                <NavLink to="/" onClick={closeMenu}>
                  Home
                </NavLink>
              </li>
              <li>
                <NavLink to="/new_arrivals" onClick={closeMenu}>
                  New Arrivals
                </NavLink>
              </li>
              <li>
                <NavLink to="/clothes" onClick={closeMenu}>
                  Clothes
                </NavLink>
              </li>
              <li>
                <NavLink to="/shoes" onClick={closeMenu}>
                  Shoes
                </NavLink>
              </li>
              <li>
                <NavLink to="/t_shirt" onClick={closeMenu}>
                  T_shirt
                </NavLink>
              </li>
              <li>
                <NavLink to="/contacts" onClick={closeMenu}>
                  Contacts
                </NavLink>
              </li>
            </ul>
          </nav>

          <div className="action_headers">
            <AccountMenu />
            <NavLink
              to="/wishList"
              aria-label={`Wishlist, ${count} items`}
              className="header_action wish_link"
            >
              <FaRegHeart />
              {count > 0 && <span className="header_badge">{count}</span>}
            </NavLink>
            <NavLink
              to="/cart"
              aria-label={`Cart, ${cartCount} items`}
              className="header_action wish_link"
            >
              <FaShoppingBag />
              {cartCount > 0 && (
                <span className="header_badge">{cartCount}</span>
              )}
            </NavLink>
          </div>
        </div>
      </div>
    </>
  );
};

export default NavBar;
