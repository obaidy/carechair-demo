import React from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import HomePage from "./pages/HomePage";
import ExplorePage from "./pages/ExplorePage";
import SalonBookingPage from "./pages/SalonBookingPage";
import SalonAdminPage from "./pages/SalonAdminPage";
import SuperAdminPage from "./pages/SuperAdminPage";
import NotFoundPage from "./pages/NotFoundPage";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Billing from "./pages/Billing";
import Cancellation from "./pages/Cancellation";
import "./styles/platform.css";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/explore" element={<ExplorePage />} />
        <Route path="/admin" element={<SuperAdminPage />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/billing" element={<Billing />} />
        <Route path="/cancellation" element={<Cancellation />} />
        <Route path="/s/:slug" element={<SalonBookingPage />} />
        <Route path="/s/:slug/admin" element={<SalonAdminPage />} />
        <Route path="/s/:slug/admin/:module" element={<SalonAdminPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
