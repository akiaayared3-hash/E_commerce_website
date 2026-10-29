import AdminRoutes from "./routes/AdminRoutes.jsx";
import { AuthProvider } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext.jsx";

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <AdminRoutes />
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
