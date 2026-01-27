import React, { useState } from "react";

const ProfilePage = () => {
  const [isEditOpen, setIsEditOpen] = useState(false);

  const user = {
    name: "Alexandra Smith",
    role: "Senior HR Manager",
    department: "Human Resources",
    email: "alexandra@hrms.com",
    phone: "+1 234 567 890",
    location: "New York, USA",
    joiningDate: "12 March 2022",
    employeeId: "HRM1023",
    status: "Active",
    salary: "$5,200 / month",
  };

  return (
    <div className="p-6 bg-[#F4F6F9] min-h-screen">
      {/* Header */}
      <div className="bg-white rounded-xl shadow p-6 mb-6 flex justify-between items-center">
        <div className="flex items-center gap-6">
          <img
            src="https://i.pravatar.cc/150?img=5"
            alt="profile"
            className="w-24 h-24 rounded-full border-4 border-[#0F5BD3]"
          />
          <div>
            <h2 className="text-2xl font-bold text-gray-800">{user.name}</h2>
            <p className="text-gray-500">{user.role}</p>
            <span className="bg-green-100 text-green-600 px-3 py-1 rounded-full text-xs mt-2 inline-block">
              {user.status}
            </span>
          </div>
        </div>

        <button
          onClick={() => setIsEditOpen(true)}
          className="bg-[#0F5BD3] text-white px-5 py-2 rounded-lg shadow hover:opacity-90"
        >
          Edit Profile
        </button>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Personal Info */}
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">
            Personal Information
          </h3>

          <div className="space-y-3 text-sm text-gray-600">
            <p><span className="font-medium text-gray-800">Email:</span> {user.email}</p>
            <p><span className="font-medium text-gray-800">Phone:</span> {user.phone}</p>
            <p><span className="font-medium text-gray-800">Location:</span> {user.location}</p>
          </div>
        </div>

        {/* Job Info */}
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">
            Employment Details
          </h3>

          <div className="space-y-3 text-sm text-gray-600">
            <p><span className="font-medium text-gray-800">Employee ID:</span> {user.employeeId}</p>
            <p><span className="font-medium text-gray-800">Department:</span> {user.department}</p>
            <p><span className="font-medium text-gray-800">Joining Date:</span> {user.joiningDate}</p>
            <p><span className="font-medium text-gray-800">Salary:</span> {user.salary}</p>
          </div>
        </div>
      </div>

      {/* Documents Section */}
      <div className="bg-white rounded-xl shadow p-6 mt-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">
          Documents
        </h3>

        <div className="flex gap-4">
          <button className="border border-[#0F5BD3] text-[#0F5BD3] px-4 py-2 rounded-lg hover:bg-[#0F5BD3] hover:text-white transition">
            Download Offer Letter
          </button>
          <button className="border border-[#0F5BD3] text-[#0F5BD3] px-4 py-2 rounded-lg hover:bg-[#0F5BD3] hover:text-white transition">
            Download ID Proof
          </button>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {isEditOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-lg">
            <h3 className="text-lg font-semibold mb-4">Edit Profile</h3>

            <div className="space-y-4">
              <input
                type="text"
                defaultValue={user.name}
                className="w-full border p-2 rounded-lg"
              />
              <input
                type="email"
                defaultValue={user.email}
                className="w-full border p-2 rounded-lg"
              />
              <input
                type="text"
                defaultValue={user.phone}
                className="w-full border p-2 rounded-lg"
              />
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setIsEditOpen(false)}
                className="px-4 py-2 rounded-lg border"
              >
                Cancel
              </button>
              <button className="bg-[#0F5BD3] text-white px-4 py-2 rounded-lg">
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
