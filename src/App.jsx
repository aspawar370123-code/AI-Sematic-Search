import { BrowserRouter, Routes, Route } from "react-router-dom";

import LandingPage from "./pages/LandingPage";
import AdminLoginPage from "./pages/AdminLogin";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import AdminRegister from "./pages/AdminRegister";
import UploadDocuments from "./pages/UploadDocuments";
import ManageDocuments from "./pages/ManageDocuments";
import OfficerLogin from "./pages/OfficerLogin";
import OfficerDashboard from "./pages/OfficerDashboard";
import SearchPolicy from "./pages/SearchPolicy";
import QueryHistory from "./pages/QueryHistory";
export default function App() {

  return (

    <BrowserRouter>

      <Routes>

        <Route path="/" element={<LandingPage />} />

        <Route path="/admin/login" element={<AdminLoginPage />} />

        <Route path="/admin/dashboard" element={<AdminDashboardPage />} />

        <Route path="/admin/register" element={<AdminRegister />} />
        <Route path="/admin/upload" element={<UploadDocuments />} />
        <Route path="/admin/documents" element={<ManageDocuments />} />
        <Route path="/officer/login" element={<OfficerLogin/>} />
        <Route path="/officer/dashboard" element={<OfficerDashboard/>} />
      <Route path="/officer/search" element={<SearchPolicy />} />
      <Route path="/officer/history" element={<QueryHistory />} />
      </Routes>

    </BrowserRouter>

  );

}