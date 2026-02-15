import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import Employees from "./pages/Employees";
import AddEmployee from "./pages/AddEmployee";
import ViewEmployee from "./pages/ViewEmployee";
import Attendance from "./pages/Attendance";
import EmployeeDashboard from "./pages/EmployeeDashboard";
import Timesheets from "./pages/Timesheets";
import Leave from "./pages/Leave";
import LeaveApply from "./pages/LeaveApply";
import Holidays from "./pages/Holidays";
import WeekOffs from "./pages/WeekOffs";
import Payroll from "./pages/Payroll";
import PerformanceDashboard from "./pages/PerformanceDashboard";
import ProfilePage from "./pages/ProfilePage";
import Organization from "./pages/Organization";
import AddOrganization from "./pages/AddOrganization";
import OrganizationSettings from "./pages/OrganizationSettings";
import NotFound from "./pages/NotFound";
import Roles from "./pages/Roles";
import AddRole from "./pages/AddRole";
import Permissions from "./pages/Permissions";
import Login from "./pages/Login";
import Departments from "./pages/Departments";
import AddDepartment from "./pages/AddDepartment";
import Designations from "./pages/Designations";
import AddDesignation from "./pages/AddDesignation";
import LeaveTypes from "./pages/LeaveTypes";
import React from "react";
import RequireAuth from "./components/RequireAuth";
import RoleBasedHome from "./components/RoleBasedHome";
import RequireProfile from "./components/RequireProfile";
import CompleteProfile from "./pages/CompleteProfile";
import { MainLayout } from "./components/layout/MainLayout";

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
          <Route element={<MainLayout><Outlet /></MainLayout>}>
            <Route
              path="/complete-profile"
              element={
                <RequireAuth>
                  <CompleteProfile />
                </RequireAuth>
              }
            />
            <Route
              path="/superadmin"
              element={
                <RequireAuth>
                  <SuperAdminDashboard />
                </RequireAuth>
              }
            />
            <Route
              path="/dashboard"
              element={
                <RequireAuth permissions={["ORG_VIEW", "EMP_VIEW", "ROLE_VIEW", "LEAVE_VIEW_ALL", "TIMESHEET_VIEW_ALL"]}>
                  <RequireProfile>
                    <Dashboard />
                  </RequireProfile>
                </RequireAuth>
              }
            />
            <Route
              path="/employee-dashboard"
              element={
                <RequireAuth permissions={["TIMESHEET_VIEW_SELF", "LEAVE_VIEW_SELF", "EMP_SELF_VIEW"]}>
                  <RequireProfile>
                    <EmployeeDashboard />
                  </RequireProfile>
                </RequireAuth>
              }
            />
            <Route
              path="/employees"
              element={
                <RequireAuth permissions={["EMP_VIEW"]}>
                  <RequireProfile>
                    <Employees />
                  </RequireProfile>
                </RequireAuth>
              }
            />
            <Route
              path="/employees/add"
              element={
                <RequireAuth permissions={["EMP_CREATE"]}>
                  <RequireProfile>
                    <AddEmployee />
                  </RequireProfile>
                </RequireAuth>
              }
            />
            <Route
              path="/employees/edit/:id"
              element={
                <RequireAuth permissions={["EMP_UPDATE"]}>
                  <RequireProfile>
                    <AddEmployee />
                  </RequireProfile>
                </RequireAuth>
              }
            />
            <Route
              path="/employees/:id"
              element={
                <RequireAuth permissions={["EMP_VIEW"]}>
                  <RequireProfile>
                    <ViewEmployee />
                  </RequireProfile>
                </RequireAuth>
              }
            />
            <Route
              path="/attendance"
              element={
                <RequireAuth permissions={["TIMESHEET_VIEW_ALL"]}>
                  <RequireProfile>
                    <Attendance />
                  </RequireProfile>
                </RequireAuth>
              }
            />
            <Route
              path="/timesheets"
              element={
                <RequireAuth permissions={["TIMESHEET_VIEW_SELF", "TIMESHEET_VIEW_ALL"]}>
                  <RequireProfile>
                    <Timesheets />
                  </RequireProfile>
                </RequireAuth>
              }
            />
            <Route
              path="/leave"
              element={
                <RequireAuth permissions={["LEAVE_VIEW_ALL", "LEAVE_VIEW_SELF", "LEAVE_APPLY"]}>
                  <RequireProfile>
                    <Leave />
                  </RequireProfile>
                </RequireAuth>
              }
            />
            <Route
              path="/leave/apply"
              element={
                <RequireAuth permissions={["LEAVE_APPLY"]}>
                  <RequireProfile>
                    <LeaveApply />
                  </RequireProfile>
                </RequireAuth>
              }
            />
            <Route
              path="/holidays"
              element={
                <RequireAuth permissions={["HOLIDAY_VIEW", "LEAVE_VIEW_SELF", "LEAVE_APPLY"]}>
                  <RequireProfile>
                    <Holidays />
                  </RequireProfile>
                </RequireAuth>
              }
            />
            <Route
              path="/week-offs"
              element={
                <RequireAuth permissions={["WEEK_OFF_VIEW"]}>
                  <RequireProfile>
                    <WeekOffs />
                  </RequireProfile>
                </RequireAuth>
              }
            />
            <Route
              path="/payroll"
              element={
                <RequireAuth>
                  <RequireProfile>
                    <Payroll />
                  </RequireProfile>
                </RequireAuth>
              }
            />
            <Route
              path="/performance"
              element={
                <RequireAuth>
                  <RequireProfile>
                    <PerformanceDashboard />
                  </RequireProfile>
                </RequireAuth>
              }
            />
            <Route
              path="/profile"
              element={
                <RequireAuth>
                  <RequireProfile>
                    <ProfilePage />
                  </RequireProfile>
                </RequireAuth>
              }
            />
            <Route
              path="/organization"
              element={
                <RequireAuth permissions={["ORG_VIEW"]}>
                  <RequireProfile>
                    <Organization />
                  </RequireProfile>
                </RequireAuth>
              }
            />
            <Route
              path="/organization/settings"
              element={
                <RequireAuth permissions={["ORG_SETTINGS_VIEW"]}>
                  <RequireProfile>
                    <OrganizationSettings />
                  </RequireProfile>
                </RequireAuth>
              }
            />
            
            <Route
              path="/organization/add"
              element={
                <RequireAuth permissions={["ORG_MANAGE"]}>
                  <RequireProfile>
                    <AddOrganization />
                  </RequireProfile>
                </RequireAuth>
              }
            />
            <Route
              path="/organization/edit/:id"
              element={
                <RequireAuth permissions={["ORG_MANAGE"]}>
                  <RequireProfile>
                    <AddOrganization />
                  </RequireProfile>
                </RequireAuth>
              }
            />
            <Route
              path="/roles"
              element={
                <RequireAuth permissions={["ROLE_VIEW"]}>
                  <RequireProfile>
                    <Roles />
                  </RequireProfile>
                </RequireAuth>
              }
            />
            <Route
              path="/roles/add"
              element={
                <RequireAuth permissions={["ROLE_CREATE"]}>
                  <RequireProfile>
                    <AddRole />
                  </RequireProfile>
                </RequireAuth>
              }
            />
            <Route
              path="/roles/edit/:id"
              element={
                <RequireAuth permissions={["ROLE_UPDATE"]}>
                  <RequireProfile>
                    <AddRole />
                  </RequireProfile>
                </RequireAuth>
              }
            />
            <Route
              path="/permissions"
              element={
                <RequireAuth permissions={["PERMISSION_VIEW"]}>
                  <RequireProfile>
                    <Permissions />
                  </RequireProfile>
                </RequireAuth>
              }
            />
            <Route
              path="/departments"
              element={
                <RequireAuth permissions={["DEPT_VIEW"]}>
                  <RequireProfile>
                    <Departments />
                  </RequireProfile>
                </RequireAuth>
              }
            />
            <Route
              path="/departments/add"
              element={
                <RequireAuth permissions={["DEPT_CREATE"]}>
                  <RequireProfile>
                    <AddDepartment />
                  </RequireProfile>
                </RequireAuth>
              }
            />
            <Route
              path="/departments/edit/:id"
              element={
                <RequireAuth permissions={["DEPT_UPDATE"]}>
                  <RequireProfile>
                    <AddDepartment />
                  </RequireProfile>
                </RequireAuth>
              }
            />
            <Route
              path="/designations"
              element={
                <RequireAuth permissions={["DESIG_VIEW"]}>
                  <RequireProfile>
                    <Designations />
                  </RequireProfile>
                </RequireAuth>
              }
            />
            <Route
              path="/designations/add"
              element={
                <RequireAuth permissions={["DESIG_CREATE"]}>
                  <RequireProfile>
                    <AddDesignation />
                  </RequireProfile>
                </RequireAuth>
              }
            />
            <Route
              path="/designations/edit/:id"
              element={
                <RequireAuth permissions={["DESIG_UPDATE"]}>
                  <RequireProfile>
                    <AddDesignation />
                  </RequireProfile>
                </RequireAuth>
              }
            />
            <Route
              path="/leave-types"
              element={
                <RequireAuth permissions={["LEAVE_TYPE_VIEW"]}>
                  <RequireProfile>
                    <LeaveTypes />
                  </RequireProfile>
                </RequireAuth>
              }
            />
          </Route>
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </React.StrictMode>
);

export default App;
