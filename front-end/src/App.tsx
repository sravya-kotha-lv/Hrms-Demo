import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Employees from "./pages/Employees";
import AddEmployee from "./pages/AddEmployee";
import ViewEmployee from "./pages/ViewEmployee";
import Attendance from "./pages/Attendance";
import EmployeeDashboard from "./pages/EmployeeDashboard";
import Timesheets from "./pages/Timesheets";
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
import RequireAuth from "./components/RequireAuth";
import RoleBasedHome from "./components/RoleBasedHome";

const queryClient = new QueryClient();
const App = () => (
  <React.StrictMode>
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RoleBasedHome />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/dashboard"
            element={
              <RequireAuth permissions={["ORG_VIEW", "EMP_VIEW", "ROLE_VIEW", "LEAVE_VIEW_ALL", "TIMESHEET_VIEW_ALL"]}>
                <Dashboard />
              </RequireAuth>
            }
          />
          <Route
            path="/employee-dashboard"
            element={
              <RequireAuth permissions={["TIMESHEET_VIEW_SELF", "LEAVE_VIEW_SELF", "EMP_SELF_VIEW"]}>
                <EmployeeDashboard />
              </RequireAuth>
            }
          />
          <Route
            path="/employees"
            element={
              <RequireAuth permissions={["EMP_VIEW"]}>
                <Employees />
              </RequireAuth>
            }
          />
          <Route
            path="/employees/add"
            element={
              <RequireAuth permissions={["EMP_CREATE"]}>
                <AddEmployee />
              </RequireAuth>
            }
          />
          <Route
            path="/employees/edit/:id"
            element={
              <RequireAuth permissions={["EMP_UPDATE"]}>
                <AddEmployee />
              </RequireAuth>
            }
          />
          <Route
            path="/employees/:id"
            element={
              <RequireAuth permissions={["EMP_VIEW"]}>
                <ViewEmployee />
              </RequireAuth>
            }
          />
          <Route
            path="/attendance"
            element={
              <RequireAuth permissions={["TIMESHEET_VIEW_ALL"]}>
                <Attendance />
              </RequireAuth>
            }
          />
          <Route
            path="/timesheets"
            element={
              <RequireAuth permissions={["TIMESHEET_VIEW_SELF", "TIMESHEET_VIEW_ALL"]}>
                <Timesheets />
              </RequireAuth>
            }
          />
          <Route
            path="/leave"
            element={
              <RequireAuth permissions={["LEAVE_VIEW_ALL", "LEAVE_VIEW_SELF", "LEAVE_APPLY"]}>
                <Leave />
              </RequireAuth>
            }
          />
          <Route
            path="/holidays"
            element={
              <RequireAuth permissions={["HOLIDAY_VIEW"]}>
                <Holidays />
              </RequireAuth>
            }
          />
          <Route
            path="/week-offs"
            element={
              <RequireAuth permissions={["WEEK_OFF_VIEW"]}>
                <WeekOffs />
              </RequireAuth>
            }
          />
          <Route
            path="/payroll"
            element={
              <RequireAuth>
                <Payroll />
              </RequireAuth>
            }
          />
          <Route
            path="/performance"
            element={
              <RequireAuth>
                <PerformanceDashboard />
              </RequireAuth>
            }
          />
          <Route
            path="/profile"
            element={
              <RequireAuth>
                <ProfilePage />
              </RequireAuth>
            }
          />
          <Route
            path="/organization"
            element={
              <RequireAuth permissions={["ORG_VIEW"]}>
                <Organization />
              </RequireAuth>
            }
          />
          <Route
            path="/organization/add"
            element={
              <RequireAuth permissions={["ORG_MANAGE"]}>
                <AddOrganization />
              </RequireAuth>
            }
          />
          <Route
            path="/organization/edit/:id"
            element={
              <RequireAuth permissions={["ORG_MANAGE"]}>
                <AddOrganization />
              </RequireAuth>
            }
          />
          <Route
            path="/roles"
            element={
              <RequireAuth permissions={["ROLE_VIEW"]}>
                <Roles />
              </RequireAuth>
            }
          />
          <Route
            path="/roles/add"
            element={
              <RequireAuth permissions={["ROLE_CREATE"]}>
                <AddRole />
              </RequireAuth>
            }
          />
          <Route
            path="/roles/edit/:id"
            element={
              <RequireAuth permissions={["ROLE_UPDATE"]}>
                <AddRole />
              </RequireAuth>
            }
          />
          <Route
            path="/permissions"
            element={
              <RequireAuth permissions={["PERMISSION_VIEW"]}>
                <Permissions />
              </RequireAuth>
            }
          />
          <Route
            path="/departments"
            element={
              <RequireAuth permissions={["DEPT_VIEW"]}>
                <Departments />
              </RequireAuth>
            }
          />
          <Route
            path="/departments/add"
            element={
              <RequireAuth permissions={["DEPT_CREATE"]}>
                <AddDepartment />
              </RequireAuth>
            }
          />
          <Route
            path="/departments/edit/:id"
            element={
              <RequireAuth permissions={["DEPT_UPDATE"]}>
                <AddDepartment />
              </RequireAuth>
            }
          />
          <Route
            path="/designations"
            element={
              <RequireAuth permissions={["DESIG_VIEW"]}>
                <Designations />
              </RequireAuth>
            }
          />
          <Route
            path="/designations/add"
            element={
              <RequireAuth permissions={["DESIG_CREATE"]}>
                <AddDesignation />
              </RequireAuth>
            }
          />
          <Route
            path="/designations/edit/:id"
            element={
              <RequireAuth permissions={["DESIG_UPDATE"]}>
                <AddDesignation />
              </RequireAuth>
            }
          />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </React.StrictMode>
);

export default App;
