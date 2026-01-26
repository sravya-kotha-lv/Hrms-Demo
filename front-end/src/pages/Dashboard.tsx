import { MainLayout } from "@/components/layout/MainLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import { WorkingFormatChart } from "@/components/dashboard/WorkingFormatChart";
import { JobStatisticsChart } from "@/components/dashboard/JobStatisticsChart";
import { TrainingCostChart } from "@/components/dashboard/TrainingCostChart";
import { RequestsPanel } from "@/components/dashboard/RequestsPanel";
import { Users, Calendar, UserPlus, DollarSign, Filter, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

const employeeChartData = [
  { value: 120 }, { value: 135 }, { value: 125 }, { value: 140 }, 
  { value: 155 }, { value: 165 }, { value: 175 }
];

const leaveChartData = [
  { value: 25 }, { value: 22 }, { value: 28 }, { value: 24 }, 
  { value: 20 }, { value: 18 }, { value: 15 }
];

const newEmployeeChartData = [
  { value: 5 }, { value: 8 }, { value: 6 }, { value: 12 }, 
  { value: 10 }, { value: 15 }, { value: 18 }
];

const Dashboard = () => {
  return (
    <MainLayout
      title="Dashboard"
      breadcrumb={[{ label: "Home", href: "/" }, { label: "Dashboard" }]}
    >
      {/* Action Bar */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Overview</h2>
          <p className="text-sm text-muted-foreground">Welcome back! Here's your HR summary.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2">
            <Filter className="w-4 h-4" />
            Filter
          </Button>
          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <StatCard
          title="Total Employees"
          value="248"
          change={12.5}
          changeLabel="from last month"
          icon={<Users className="w-6 h-6" />}
          link={{ label: "View Employees", href: "/employees" }}
          chartData={employeeChartData}
          chartColor="#0F5BD3"
          delay={0.1}
        />
        <StatCard
          title="Number of Leaves"
          value="15"
          change={-8.2}
          changeLabel="from last month"
          icon={<Calendar className="w-6 h-6" />}
          link={{ label: "View Leaves", href: "/leave" }}
          chartData={leaveChartData}
          chartColor="#DC2626"
          delay={0.2}
        />
        <StatCard
          title="New Employees"
          value="18"
          change={24.3}
          changeLabel="from last month"
          icon={<UserPlus className="w-6 h-6" />}
          link={{ label: "View Reports", href: "/reports" }}
          chartData={newEmployeeChartData}
          chartColor="#16A34A"
          delay={0.3}
        />
        <StatCard
          title="Payroll Cost"
          value="$125K"
          change={5.8}
          changeLabel="from last month"
          icon={<DollarSign className="w-6 h-6" />}
          link={{ label: "View Payroll", href: "/payroll" }}
          delay={0.35}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <WorkingFormatChart />
        <JobStatisticsChart />
      </div>

      {/* Training Cost & Requests */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <TrainingCostChart />
        </div>
        <div>
          <RequestsPanel />
        </div>
      </div>
    </MainLayout>
  );
};

export default Dashboard;
