import { describe, expect, it } from "vitest";
import {
  getAttendanceDisplayStatus,
  hasAttendanceActivity,
  isThresholdQualifiedAttendance
} from "@/pages/attendanceMatrixStatus";

describe("attendance matrix status", () => {
  it("shows half day when half-day leave exists and attendance crossed the half-day threshold", () => {
    expect(
      getAttendanceDisplayStatus({
        isHoliday: false,
        isWeekOff: false,
        isOnLeave: true,
        leaveType: "Sick",
        leaveDuration: "half_day",
        attendanceStatus: "half_day_present",
        checkInAt: "2026-04-02T03:56:24.000Z",
        checkOutAt: "2026-04-02T06:28:00.000Z",
        snapshotGenerated: false
      })
    ).toBe("Half Day");
  });

  it("shows absent plus leave when half-day leave exists but attendance is below threshold", () => {
    expect(
      getAttendanceDisplayStatus({
        isHoliday: false,
        isWeekOff: false,
        isOnLeave: true,
        leaveType: "Sick",
        leaveDuration: "half_day",
        attendanceStatus: "absent",
        checkInAt: "2026-04-02T03:56:24.000Z",
        checkOutAt: "2026-04-02T04:28:00.000Z",
        snapshotGenerated: false
      })
    ).toBe("Absent + Leave");
  });

  it("shows absent plus leave when half-day leave exists and there is no attendance", () => {
    expect(
      getAttendanceDisplayStatus({
        isHoliday: false,
        isWeekOff: false,
        isOnLeave: true,
        leaveType: "Sick",
        leaveDuration: "half_day",
        attendanceStatus: "absent",
        checkInAt: null,
        checkOutAt: null,
        snapshotGenerated: false
      })
    ).toBe("Absent + Leave");
  });

  it("shows present when half-day leave exists and attendance crossed the full-day threshold", () => {
    expect(
      getAttendanceDisplayStatus({
        isHoliday: false,
        isWeekOff: false,
        isOnLeave: true,
        leaveType: "Sick",
        leaveDuration: "half_day",
        attendanceStatus: "full_day_present",
        checkInAt: "2026-04-02T00:56:24.000Z",
        checkOutAt: "2026-04-02T10:28:00.000Z",
        snapshotGenerated: false
      })
    ).toBe("Present");
  });

  it("keeps pending checkout visible even with half-day leave", () => {
    expect(
      getAttendanceDisplayStatus({
        isHoliday: false,
        isWeekOff: false,
        isOnLeave: true,
        leaveType: "Sick",
        leaveDuration: "half_day",
        attendanceStatus: "pending_checkout",
        checkInAt: "2026-04-02T03:56:24.000Z",
        checkOutAt: null,
        snapshotGenerated: false
      })
    ).toBe("Pending Checkout");
  });

  it("detects activity from punch timestamps even if computed status is absent", () => {
    expect(
      hasAttendanceActivity({
        attendanceStatus: "absent",
        checkInAt: "2026-04-02T03:56:24.000Z",
        checkOutAt: "2026-04-02T06:28:00.000Z"
      })
    ).toBe(true);
  });

  it("treats only threshold-qualified attendance as present for overrides", () => {
    expect(isThresholdQualifiedAttendance("absent")).toBe(false);
    expect(isThresholdQualifiedAttendance("half_day_present")).toBe(true);
  });
});
