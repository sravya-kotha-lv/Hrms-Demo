const test = require("node:test");
const assert = require("node:assert/strict");

const { __private__ } = require("../src/modules/timesheets/timesheet.service");

test("no-op override is detected when absent is saved without any punches", () => {
  assert.equal(
    __private__.isNoOpAttendanceOverride({
      existingAttendance: null,
      targetStatus: "absent"
    }),
    true
  );

  assert.equal(
    __private__.isNoOpAttendanceOverride({
      existingAttendance: {
        checkInAt: null,
        checkOutAt: null
      },
      targetStatus: "absent"
    }),
    true
  );
});

test("override is allowed when attendance has punches or when target status is present", () => {
  assert.equal(
    __private__.isNoOpAttendanceOverride({
      existingAttendance: {
        checkInAt: new Date("2026-04-13T04:00:00.000Z"),
        checkOutAt: null
      },
      targetStatus: "absent"
    }),
    false
  );

  assert.equal(
    __private__.isNoOpAttendanceOverride({
      existingAttendance: null,
      targetStatus: "present"
    }),
    false
  );
});

test("no-op override is detected when present is saved for an already present day", () => {
  assert.equal(
    __private__.isNoOpAttendanceOverride({
      existingAttendance: {
        checkInAt: new Date("2026-04-13T01:00:00.000Z"),
        checkOutAt: new Date("2026-04-13T10:30:00.000Z"),
        totalMinutes: 570
      },
      targetStatus: "present",
      minHalfDayHours: 4,
      minWorkHoursPerDay: 8
    }),
    true
  );

  assert.equal(
    __private__.isNoOpAttendanceOverride({
      existingAttendance: {
        checkInAt: new Date("2026-04-13T01:00:00.000Z"),
        checkOutAt: new Date("2026-04-13T05:00:00.000Z"),
        totalMinutes: 240
      },
      targetStatus: "present",
      minHalfDayHours: 4,
      minWorkHoursPerDay: 8
    }),
    false
  );
});
