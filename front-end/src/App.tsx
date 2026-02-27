import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Outlet, Navigate } from "react-router-dom";
import React from "react";
import RequireAuth from "./components/RequireAuth";
import RoleBasedHome from "./components/RoleBasedHome";
import RequireProfile from "./components/RequireProfile";
import { MainLayout } from "@/components/layout/MainLayout";

const Dashboard = React.lazy(() => import("./pages/Dashboard"));
const SuperAdminDashboard = React.lazy(() => import("./pages/SuperAdminDashboard"));
const Employees = React.lazy(() => import("./pages/Employees"));
const AddEmployee = React.lazy(() => import("./pages/AddEmployee"));
const ViewEmployee = React.lazy(() => import("./pages/ViewEmployee"));
const Attendance = React.lazy(() => import("./pages/Attendance"));
const EmployeeDashboard = React.lazy(() => import("./pages/EmployeeDashboard"));
const Timesheets = React.lazy(() => import("./pages/Timesheets"));
const Leave = React.lazy(() => import("./pages/Leave"));
const LeaveApply = React.lazy(() => import("./pages/LeaveApply"));
const Holidays = React.lazy(() => import("./pages/Holidays"));
const WeekOffs = React.lazy(() => import("./pages/WeekOffs"));
const Payroll = React.lazy(() => import("./pages/Payroll"));
const PayrollEmployeeBreakdown = React.lazy(() => import("./pages/PayrollEmployeeBreakdown"));
const PerformanceDashboard = React.lazy(() => import("./pages/PerformanceDashboard"));
const ProfilePage = React.lazy(() => import("./pages/ProfilePage"));
const Organization = React.lazy(() => import("./pages/Organization"));
const AddOrganization = React.lazy(() => import("./pages/AddOrganization"));
const OrganizationSettings = React.lazy(() => import("./pages/OrganizationSettings"));
const NotFound = React.lazy(() => import("./pages/NotFound"));
const Roles = React.lazy(() => import("./pages/Roles"));
const AddRole = React.lazy(() => import("./pages/AddRole"));
const Permissions = React.lazy(() => import("./pages/Permissions"));
const Login = React.lazy(() => import("./pages/Login"));
const ForgotPassword = React.lazy(() => import("./pages/ForgotPassword"));
const ChangePassword = React.lazy(() => import("./pages/ChangePassword"));
const Departments = React.lazy(() => import("./pages/Departments"));
const AddDepartment = React.lazy(() => import("./pages/AddDepartment"));
const Designations = React.lazy(() => import("./pages/Designations"));
const AddDesignation = React.lazy(() => import("./pages/AddDesignation"));
const LeaveTypes = React.lazy(() => import("./pages/LeaveTypes"));
const Shifts = React.lazy(() => import("./pages/Shifts"));
const ApprovalFlows = React.lazy(() => import("./pages/ApprovalFlows"));
const PendingApprovals = React.lazy(() => import("./pages/PendingApprovals"));
const CompleteProfile = React.lazy(() => import("./pages/CompleteProfile"));
const Documentation = React.lazy(() => import("./pages/Documentation"));
const Expenses = React.lazy(() => import("./pages/Expenses"));
const Projects = React.lazy(() => import("./pages/Projects"));
const Hiring = React.lazy(() => import("./pages/Hiring"));

const queryClient = new QueryClient();
const App = () => (
  <React.StrictMode>
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <React.Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading...</div>}>
        <Routes>
          <Route path="/" element={<RoleBasedHome />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
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
                <RequireAuth permissions={["ATTENDANCE_VIEW_ALL", "ATTENDANCE_VIEW_SELF"]}>
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
              path="/shifts"
              element={
                <RequireAuth permissions={["SHIFT_VIEW"]}>
                  <RequireProfile>
                    <Shifts />
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
              path="/payroll/employee-breakdown"
              element={
                <RequireAuth>
                  <RequireProfile>
                    <PayrollEmployeeBreakdown />
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
              path="/change-password"
              element={
                <RequireAuth>
                  <ChangePassword />
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
            <Route
              path="/approval-flows"
              element={
                <RequireAuth permissions={["APPROVAL_FLOW_VIEW"]}>
                  <RequireProfile>
                    <ApprovalFlows />
                  </RequireProfile>
                </RequireAuth>
              }
            />
            <Route
              path="/documentation"
              element={
                <RequireAuth>
                  <RequireProfile>
                    <Documentation />
                  </RequireProfile>
                </RequireAuth>
              }
            />
            <Route
              path="/expenses"
              element={
                <RequireAuth permissions={["EXPENSE_VIEW", "EXPENSE_MANAGE"]}>
                  <RequireProfile>
                    <Expenses />
                  </RequireProfile>
                </RequireAuth>
              }
            />
            <Route
              path="/business-development"
              element={
                <RequireAuth permissions={["PROJECT_VIEW", "PROJECT_MANAGE"]}>
                  <RequireProfile>
                    <Projects />
                  </RequireProfile>
                </RequireAuth>
              }
            />
            <Route
              path="/hiring"
              element={
                <RequireAuth permissions={["HIRING_VIEW", "HIRING_MANAGE"]}>
                  <RequireProfile>
                    <Hiring />
                  </RequireProfile>
                </RequireAuth>
              }
            />
            <Route path="/projects" element={<Navigate to="/business-development" replace />} />
            <Route
              path="/approvals"
              element={
                <RequireAuth permissions={["LEAVE_ACTION", "ATTENDANCE_MANAGE"]}>
                  <RequireProfile>
                    <PendingApprovals />
                  </RequireProfile>
                </RequireAuth>
              }
            />
          </Route>
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        </React.Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </React.StrictMode>
);

export default App;
