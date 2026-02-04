import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import Employees from "./pages/Employees";
import AddEmployee from "./pages/AddEmployee";
import Attendance from "./pages/Attendance";
import Leave from "./pages/Leave";
import Holidays from "./pages/Holidays";
import WeekOffs from "./pages/WeekOffs";
import Payroll from "./pages/Payroll";
import PerformanceDashboard from "./pages/PerformanceDashboard";
import ProfilePage from "./pages/ProfilePage";
import Organization from "./pages/Organization";
import AddOrganization from "./pages/AddOrganization";
import NotFound from "./pages/NotFound";
import Roles from "./pages/Roles";
import AddRole from "./pages/AddRole";
import Permissions from "./pages/Permissions";
import Login from "./pages/Login";
import Departments from "./pages/Departments";
import AddDepartment from "./pages/AddDepartment";
import Designations from "./pages/Designations";
import AddDesignation from "./pages/AddDesignation";
import React from "react";

const queryClient = new QueryClient();
const PrivateRoute = ({ children }: any) => {
  const token = localStorage.getItem("token");
  return token ? children : <Navigate to="/login" replace />;
};
const App = () => (
  <React.StrictMode>
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/employees" element={<Employees />} />
          <Route path="/employees/add" element={<AddEmployee />} />
          <Route path="/employees/edit/:id" element={<AddEmployee />} />
          <Route path="/attendance" element={<Attendance />} />
          <Route path="/leave" element={<Leave />} />
          <Route path="/holidays" element={<Holidays />} />
          <Route path="/week-offs" element={<WeekOffs />} />
          <Route path="/payroll" element={<Payroll />} />
          <Route path="/performance" element={<PerformanceDashboard />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/organization" element={<Organization />} />
          <Route path="/organization/add" element={<AddOrganization />} />
          <Route path="/organization/edit/:id" element={<AddOrganization />} />
          <Route path="/roles" element={<Roles />} />
          <Route path="/roles/add" element={<AddRole />} />
          <Route path="/roles/edit/:id" element={<AddRole />} />
          <Route path="/permissions" element={<Permissions />} />
          <Route path="/departments" element={<Departments />} />
          <Route path="/departments/add" element={<AddDepartment />} />
          <Route path="/departments/edit/:id" element={<AddDepartment />} />
          <Route path="/designations" element={<Designations />} />
          <Route path="/designations/add" element={<AddDesignation />} />
          <Route path="/designations/edit/:id" element={<AddDesignation />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </React.StrictMode>
);

export default App;
