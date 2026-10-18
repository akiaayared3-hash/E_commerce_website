import React from "react";
import { NavLink } from "react-router-dom";
import "./BreadCrams.css";

function BreadCrams(props) {
  const { product } = props;

  if (!product) return null;

  const category = product.category;

  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      <ol>
        <li>
          <NavLink to="/">Home</NavLink>
        </li>
        <li>
          <NavLink to={`/${category}`}>{category.replace("_", "-")}</NavLink>
        </li>
        <li aria-current="page">
          <span>{product.name}</span>
        </li>
      </ol>
    </nav>
  );
}

export default BreadCrams;
