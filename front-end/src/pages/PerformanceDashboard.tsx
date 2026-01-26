import React from "react";
import { Bar, Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend
);

const PerformanceDashboard = () => {
  const summaryCards = [
    { title: "Total Reviews", value: 124, color: "text-blue-600" },
    { title: "Pending Self Reviews", value: 18, color: "text-orange-500" },
    { title: "Pending Manager Reviews", value: 9, color: "text-red-500" },
    { title: "Avg Performance Score", value: "4.2 / 5", color: "text-green-600" },
  ];

  const barData = {
    labels: ["HR", "IT", "Finance", "Sales", "Marketing"],
    datasets: [
      {
        label: "Average Rating",
        data: [4.1, 4.5, 3.9, 4.3, 4.0],
        backgroundColor: "#0F5BD3",
      },
    ],
  };

  const lineData = {
    labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
    datasets: [
      {
        label: "Performance Trend",
        data: [3.8, 4.0, 4.1, 4.2, 4.3, 4.2],
        borderColor: "#0F5BD3",
        backgroundColor: "rgba(15,91,211,0.1)",
        tension: 0.4,
        fill: true,
      },
    ],
  };

  return (
    <div className="p-6 bg-[#F4F6F9] min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">
          Performance Dashboard
        </h1>
        <button className="bg-[#0F5BD3] text-white px-4 py-2 rounded-lg shadow hover:opacity-90">
          + Create Review Cycle
        </button>
      </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {summaryCards.map((card, index) => (
                <div key={index} className="bg-white p-6 rounded-lg shadow">
                  <p className="text-gray-600 text-sm mb-2">{card.title}</p>
                  <p className={`text-3xl font-bold ${card.color}`}>{card.value}</p>
                </div>
              ))}
            </div>
      
            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Bar Chart */}
              <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-lg font-semibold mb-4 text-gray-800">Department Ratings</h2>
                <Bar data={barData} options={{ responsive: true, maintainAspectRatio: true }} />
              </div>
      
              {/* Line Chart */}
              <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-lg font-semibold mb-4 text-gray-800">Performance Trend</h2>
                <Line data={lineData} options={{ responsive: true, maintainAspectRatio: true }} />
              </div>
            </div>
          </div>
        );
      };
      
      export default PerformanceDashboard;
