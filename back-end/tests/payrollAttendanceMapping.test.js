const test = require("node:test");
const assert = require("node:assert/strict");

const { __test__ } = require("../src/modules/payroll/payrollAttendance.service");

const {
  buildDateKeys,
  buildAttendanceMap,
  buildHolidayMap,
  buildLeaveIndex,
  buildWeekOffResolver
} = __test__;

test("buildDateKeys returns full inclusive range", () => {
  const keys = buildDateKeys("2026-02-01", "2026-02-04");
  assert.deepEqual(keys, ["2026-02-01", "2026-02-02", "2026-02-03", "2026-02-04"]);
});

test("attendance and holiday maps are keyed by employee/date and date", () => {
  const timeZone = "Asia/Kolkata";
  const attendanceRows = [
    {
      _id: "a1",
      employeeId: "emp1",
      date: new Date("2026-02-04T09:00:00.000Z"),
      totalMinutes: 510
    }
  ];
  const holidayRows = [{ _id: "h1", date: new Date("2026-02-05T00:00:00.000Z") }];

  const attendanceMap = buildAttendanceMap(attendanceRows, timeZone);
  const holidayMap = buildHolidayMap(holidayRows, timeZone);

  assert.equal(attendanceMap.has("emp1:2026-02-04"), true);
  assert.equal(holidayMap.has("2026-02-05"), true);
});

test("buildLeaveIndex marks paid and unpaid leaves correctly", () => {
  const leaveTypeCodeById = new Map([
    ["lt-paid", "CL"],
    ["lt-unpaid", "LOP"]
  ]);

  const leaveRows = [
    {
      _id: "leave-paid",
      employeeId: "emp1",
      leaveTypeId: "lt-paid",
      duration: "full_day",
      fromDate: new Date("2026-02-10T00:00:00.000Z"),
      toDate: new Date("2026-02-10T00:00:00.000Z")
    },
    {
      _id: "leave-unpaid-half",
      employeeId: "emp1",
      leaveTypeId: "lt-unpaid",
      duration: "half_day",
      fromDate: new Date("2026-02-11T00:00:00.000Z"),
      toDate: new Date("2026-02-11T00:00:00.000Z")
    }
  ];

  const leaveMap = buildLeaveIndex(
    leaveRows,
    leaveTypeCodeById,
    new Set(["LOP"]),
    "Asia/Kolkata",
    "2026-02-01",
    "2026-02-28"
  );

  const paid = leaveMap.get("emp1:2026-02-10");
  const unpaidHalf = leaveMap.get("emp1:2026-02-11");

  assert.equal(paid.isPaid, true);
  assert.equal(paid.units, 1);
  assert.equal(unpaidHalf.isPaid, false);
  assert.equal(unpaidHalf.units, 0.5);
});

test("buildWeekOffResolver prefers shift-specific list and falls back to default", () => {
  const resolveWeekOffDays = buildWeekOffResolver([
    { shiftId: null, weekOffDays: ["sunday"] },
    { shiftId: "shift-a", weekOffDays: ["saturday", "sunday"] }
  ]);

  assert.deepEqual(resolveWeekOffDays("shift-a"), ["saturday", "sunday"]);
  assert.deepEqual(resolveWeekOffDays("shift-b"), ["sunday"]);
  assert.deepEqual(resolveWeekOffDays(null), ["sunday"]);
});
