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
import PricingPage from "./pages/PricingPage";
import SalonSetupPage from "./pages/onboarding/SalonSetupPage";
import ScrollManager from "./components/ScrollManager";
import "./styles/platform.css";

export default function App() {
  return (
    <BrowserRouter>
      <ScrollManager />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/explore" element={<ExplorePage />} />
        <Route path="/admin" element={<SuperAdminPage />} />
        <Route path="/admin/overview" element={<SuperAdminPage />} />
        <Route path="/admin/approvals" element={<SuperAdminPage />} />
        <Route path="/admin/salons/:id" element={<SuperAdminPage />} />
        <Route path="/superadmin" element={<SuperAdminPage />} />
        <Route path="/superadmin/overview" element={<SuperAdminPage />} />
        <Route path="/superadmin/approvals" element={<SuperAdminPage />} />
        <Route path="/superadmin/salons/:id" element={<SuperAdminPage />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/billing" element={<Billing />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/cancellation" element={<Cancellation />} />
        <Route path="/onboarding" element={<SalonSetupPage />} />
        <Route path="/onboarding/salon-setup" element={<SalonSetupPage />} />
        <Route path="/s/:slug" element={<SalonBookingPage />} />
        <Route path="/s/:slug/admin" element={<SalonAdminPage />} />
        <Route path="/s/:slug/admin/:module" element={<SalonAdminPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
