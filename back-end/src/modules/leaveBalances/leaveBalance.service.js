const LeaveBalance = require("./leaveBalance.model");
const LeaveType = require("../leaveTypes/leaveType.model");
const Organization = require("../organizations/organization.model");
const Employee = require("../employees/employee.model");

/**
 * Get leave cycle start year based on org configuration
 */
const getCycleStartYear = (date, startMonth) => {
  return date.getMonth() + 1 < startMonth
    ? date.getFullYear() - 1
    : date.getFullYear();
};

/**
 * Round value to nearest 0.5
 */
const roundHalf = (value) => Math.round(value * 2) / 2;

/**
 * Initialize leave balance when employee is created
 */
exports.initializeForEmployee = async (employee, organizationId) => {
  // 1️⃣ fetch organization (for leave cycle)
  const org = await Organization.findById(organizationId);
  if (!org) return;

  // 2️⃣ determine leave cycle year
  const doj = new Date(employee.dateOfJoining);
  const cycleStartYear = getCycleStartYear(
    doj,
    org.leaveCycleStartMonth
  );

  const joinDay = doj.getDate();
  const joinMonthIndex = doj.getMonth();
  const cycleStartMonthIndex = org.leaveCycleStartMonth - 1;

  // 3️⃣ fetch active leave types
  const leaveTypes = await LeaveType.find({
    organizationId,
    status: "active"
  });

  if (!leaveTypes.length) return;

  // 4️⃣ prepare bulk insert
  const bulkOps = leaveTypes.map((lt) => {
    const monthlyQuota = lt.daysPerYear / 12;

    let remainingMonths =
      12 - (joinMonthIndex - cycleStartMonthIndex);

    if (remainingMonths < 1) remainingMonths = 1;

    let joiningMonthLeave = monthlyQuota;
    if (joinDay > 15) joiningMonthLeave = monthlyQuota / 2;

    let total =
      joiningMonthLeave +
      monthlyQuota * (remainingMonths - 1);

    total = roundHalf(total);

    return {
      updateOne: {
        filter: {
          organizationId,
          employeeId: employee._id,
          leaveTypeId: lt._id,
          cycleStartYear
        },
        update: {
          $setOnInsert: {
            total,
            used: 0,
            remaining: total
          }
        },
        upsert: true
      }
    };
  });

  // 5️⃣ create leave balances
  await LeaveBalance.bulkWrite(bulkOps);
};


const mongoose = require("mongoose");

exports.getEmployeeBalance = async (organizationId, id, type = "USER") => {

  let employeeQuery = { organizationId };

  if (type === "EMPLOYEE") {
    // employeeId comes from URL → real ObjectId
    employeeQuery._id = id;
  } else {
    // userId comes from token → STRING is OK
    employeeQuery.userId = id;
  }

  const employee = await Employee.findOne(employeeQuery);

  if (!employee) {
    throw new Error("Employee not found");
  }

  const balances = await LeaveBalance.find({
    organizationId,
    employeeId: employee._id
  }).populate("leaveTypeId", "name code");

  return balances.map((b) => ({
    leaveTypeId: b.leaveTypeId._id,
    leaveType: b.leaveTypeId.name,
    code: b.leaveTypeId.code,
    total: b.total,
    used: b.used,
    remaining: b.remaining
  }));
};
