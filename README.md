# E-Commerce Website

A full-stack e-commerce platform built with React and Node.js.

This project includes a customer-facing store and a backend API with authentication, product management, categories, and Chapa payment integration.

> Project Status: **In Progress**

## Features

### Customer Side
- User Registration & Login (JWT)
- Browse products by category
- Product listing and details
- Shopping cart (in progress)
- Checkout with **Chapa** payment
- Order history (planned)

### Backend
- RESTful API
- JWT Authentication
- Password hashing with bcrypt
- Category management
- Product management
- Chapa payment integration
- Input validation with Zod
- Secure headers with Helmet
- Centralized error handling

## Tech Stack

**Frontend**
- React
- Vite
- React Router
- Axios

**Backend**
- Node.js
- Express.js
- MySQL
- JWT
- bcrypt
- Zod
- Multer
- Chapa Payment Gateway

## Project Structure
E_commerce_website/
├── client/
│   └── e_commerce/          # React Frontend (Vite)
└── server/                  # Express Backend
├── src/
│   ├── config/
│   ├── controllers/
│   ├── middlewares/
│   ├── routes/
│   ├── utils/
│   └── app.js
└── tests/
