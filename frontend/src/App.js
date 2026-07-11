import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";

import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import { ConfirmProvider } from "@/context/ConfirmContext";
import { ProtectedRoute, AdminRoute } from "@/components/RouteGuards";
import StoreLayout from "@/components/StoreLayout";
import AdminLayout from "@/components/AdminLayout";

import Home from "@/pages/Home";
import ProductDetail from "@/pages/ProductDetail";
import Cart from "@/pages/Cart";
import Checkout from "@/pages/Checkout";
import OrderConfirmation from "@/pages/OrderConfirmation";
import MyOrders from "@/pages/MyOrders";
import Account from "@/pages/Account";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import OrderPrint from "@/pages/OrderPrint";
import InvoicePrint from "@/pages/InvoicePrint";
import InvoiceTicket from "@/pages/InvoiceTicket";
import PrivacyPolicy from "@/pages/legal/PrivacyPolicy";
import CookiePolicy from "@/pages/legal/CookiePolicy";
import Terms from "@/pages/legal/Terms";

import Dashboard from "@/pages/admin/Dashboard";
import AdminOrders from "@/pages/admin/AdminOrders";
import AdminProducts from "@/pages/admin/AdminProducts";
import AdminCategories from "@/pages/admin/AdminCategories";
import AdminInventory from "@/pages/admin/AdminInventory";
import AdminCustomers from "@/pages/admin/AdminCustomers";
import AdminInvoices from "@/pages/admin/AdminInvoices";
import AdminReviews from "@/pages/admin/AdminReviews";
import AdminSettings from "@/pages/admin/AdminSettings";

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <ConfirmProvider>
        <BrowserRouter>
          <Routes>
            {/* Storefront */}
            <Route element={<StoreLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/product/:id" element={<ProductDetail />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/privacidad" element={<PrivacyPolicy />} />
              <Route path="/cookies" element={<CookiePolicy />} />
              <Route path="/terminos" element={<Terms />} />
              <Route
                path="/checkout"
                element={
                  <ProtectedRoute>
                    <Checkout />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/order-confirmation/:id"
                element={
                  <ProtectedRoute>
                    <OrderConfirmation />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/orders"
                element={
                  <ProtectedRoute>
                    <MyOrders />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/account"
                element={
                  <ProtectedRoute>
                    <Account />
                  </ProtectedRoute>
                }
              />
            </Route>

            {/* Printable order (standalone, no store chrome) */}
            <Route
              path="/order/:id/print"
              element={
                <ProtectedRoute>
                  <OrderPrint />
                </ProtectedRoute>
              }
            />

            {/* Printable electronic invoice (representación gráfica) */}
            <Route
              path="/invoice/:id/print"
              element={
                <AdminRoute>
                  <InvoicePrint />
                </AdminRoute>
              }
            />

            {/* Printable electronic invoice — thermal ticket (tirilla) */}
            <Route
              path="/invoice/:id/ticket"
              element={
                <AdminRoute>
                  <InvoiceTicket />
                </AdminRoute>
              }
            />

            {/* Admin */}
            <Route
              element={
                <AdminRoute>
                  <AdminLayout />
                </AdminRoute>
              }
            >
              <Route path="/admin" element={<Dashboard />} />
              <Route path="/admin/orders" element={<AdminOrders />} />
              <Route path="/admin/products" element={<AdminProducts />} />
              <Route path="/admin/categories" element={<AdminCategories />} />
              <Route path="/admin/inventory" element={<AdminInventory />} />
              <Route path="/admin/customers" element={<AdminCustomers />} />
              <Route path="/admin/invoices" element={<AdminInvoices />} />
              <Route path="/admin/reviews" element={<AdminReviews />} />
              <Route path="/admin/settings" element={<AdminSettings />} />
            </Route>
          </Routes>
          <Toaster richColors position="top-right" />
        </BrowserRouter>
        </ConfirmProvider>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
