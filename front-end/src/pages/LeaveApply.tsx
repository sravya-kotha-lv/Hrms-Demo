import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { postApiWithToken, getApiWithToken } from "@/services/apiWrapper";
import { toast } from "sonner";
import { DateRange } from "react-day-picker";

type LeaveType = {
  _id: string;
  name: string;
  code?: string;
};

type LeaveBalance = {
  leaveTypeId: string;
  total: number;
  used: number;
  pending?: number;
  remaining: number;
  cycleStartYear?: number;
};

type CalendarLeave = {
  _id: string;
  leaveTypeId: string;
  fromDate: string;
  toDate: string;
  status: "pending" | "approved";
};

type DayMeta = {
  date: Date;
  excluded: boolean;
};

const dateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseDateInput = (value: string) => {
  if (!value) return undefined;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
};

const datesInRange = (from: Date, to: Date) => {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  const dates: Date[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    dates.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
};

const getApplicableLeaveDays = ({
  from,
  to,
  weekOffDays,
  holidayKeys,
  sandwichRuleEnabled
}: {
  from?: Date;
  to?: Date;
  weekOffDays: number[];
  holidayKeys: Set<string>;
  sandwichRuleEnabled: boolean;
}) => {
  if (!from || !to) return 0;
  const dayMeta: DayMeta[] = datesInRange(from, to).map((d) => ({
    date: d,
    excluded: weekOffDays.includes(d.getDay()) || holidayKeys.has(dateKey(d))
  }));

  if (!sandwichRuleEnabled) {
    return dayMeta.filter((d) => !d.excluded).length;
  }

  const firstWorkingIdx = dayMeta.findIndex((d) => !d.excluded);
  const lastWorkingIdx = dayMeta.length - 1 - [...dayMeta].reverse().findIndex((d) => !d.excluded);
  if (firstWorkingIdx === -1 || lastWorkingIdx === -1) return 0;

  return dayMeta.filter((d, index) => !d.excluded || (index > firstWorkingIdx && index < lastWorkingIdx)).length;
};

const LeaveApply = () => {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [myLeaves, setMyLeaves] = useState<CalendarLeave[]>([]);
  const [weekOffDays, setWeekOffDays] = useState<number[]>([]);
  const [holidayKeys, setHolidayKeys] = useState<Set<string>>(new Set());
  const [sandwichRuleEnabled, setSandwichRuleEnabled] = useState(false);
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [reason, setReason] = useState("");
  const [selectedRange, setSelectedRange] = useState<DateRange | undefined>();
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [isMobile, setIsMobile] = useState(false);

  const loadContext = async () => {
    try {
      setLoading(true);
      const res = await getApiWithToken("/leaves/apply-context", null, {
        requiredPermissions: ["LEAVE_APPLY"]
      });
      if (res?.skipped) return;
      if (!res?.success) {
        toast.error(res?.message || "Failed to load leave apply data");
        return;
      }

      const data = res.data || {};
      setLeaveTypes(data.leaveTypes || []);
      setMyLeaves(data.myLeaves || []);
      setWeekOffDays(data.weekOffDays || []);
      setSandwichRuleEnabled(Boolean(data.sandwichRuleEnabled));
      setBalances(data.balances || []);
      setHolidayKeys(new Set((data.holidays || []).map((h: any) => dateKey(new Date(h.date)))));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContext();
  }, []);

  useEffect(() => {
    const updateMobile = () => setIsMobile(window.innerWidth < 768);
    updateMobile();
    window.addEventListener("resize", updateMobile);
    return () => window.removeEventListener("resize", updateMobile);
  }, []);

  const approvedDates = useMemo(() => {
    const result: Date[] = [];
    (myLeaves || [])
      .filter((l) => l.status === "approved")
      .forEach((l) => {
        result.push(...datesInRange(new Date(l.fromDate), new Date(l.toDate)));
      });
    return result;
  }, [myLeaves]);

  const pendingDates = useMemo(() => {
    const result: Date[] = [];
    (myLeaves || [])
      .filter((l) => l.status === "pending")
      .forEach((l) => {
        result.push(...datesInRange(new Date(l.fromDate), new Date(l.toDate)));
      });
    return result;
  }, [myLeaves]);

  const selectedBalance = useMemo(() => {
    if (!leaveTypeId) return null;
    const candidates = balances.filter((b) => b.leaveTypeId?.toString() === leaveTypeId);
    if (!candidates.length) return null;
    return candidates.sort((a, b) => (b.cycleStartYear || 0) - (a.cycleStartYear || 0))[0];
  }, [leaveTypeId, balances]);

  const disabledMatcher = (date: Date) => {
    const weekOff = weekOffDays.includes(date.getDay());
    const holiday = holidayKeys.has(dateKey(date));
    return weekOff || holiday;
  };

  const applicableDays = useMemo(() => {
    return getApplicableLeaveDays({
      from: selectedRange?.from,
      to: selectedRange?.to,
      weekOffDays,
      holidayKeys,
      sandwichRuleEnabled
    });
  }, [selectedRange, weekOffDays, holidayKeys, sandwichRuleEnabled]);

  const onRangeChange = (range: DateRange | undefined) => {
    setSelectedRange(range);
    setFromDate(range?.from ? dateKey(range.from) : "");
    setToDate(range?.to ? dateKey(range.to) : "");
  };

  const onFromDateChange = (value: string) => {
    setFromDate(value);
    const from = parseDateInput(value);
    const to = parseDateInput(toDate);
    setSelectedRange({ from, to });
  };

  const onToDateChange = (value: string) => {
    setToDate(value);
    const from = parseDateInput(fromDate);
    const to = parseDateInput(value);
    setSelectedRange({ from, to });
  };

  const submit = async () => {
    if (!leaveTypeId || !fromDate || !toDate) {
      toast.error("Leave type and both dates are required");
      return;
    }
    if (applicableDays <= 0) {
      toast.error("Selected dates only include holidays/week-offs");
      return;
    }

    try {
      setSubmitting(true);
      const res = await postApiWithToken(
        "/leaves/apply",
        { leaveTypeId, fromDate, toDate, reason },
        null,
        { requiredPermissions: ["LEAVE_APPLY"] }
      );
      if (res?.skipped) return;
      if (res?.success) {
        toast.success("Leave applied successfully");
        setSelectedRange(undefined);
        setFromDate("");
        setToDate("");
        setReason("");
        await loadContext();
      } else {
        toast.error(res?.message || "Failed to apply leave");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MainLayout
      title="Apply Leave"
      breadcrumb={[{ label: "Home", href: "/" }, { label: "Leave", href: "/leave" }, { label: "Apply" }]}
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <Card className="lg:col-span-7 min-w-0">
          <CardHeader>
            <CardTitle>Leave Calendar</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading calendar...</p>
            ) : (
              <>
                <div className="w-full overflow-x-auto">
                  <Calendar
                    mode="range"
                    selected={selectedRange}
                    onSelect={onRangeChange}
                    numberOfMonths={isMobile ? 1 : 2}
                    disabled={disabledMatcher}
                    classNames={{
                      months: "flex flex-col sm:flex-row flex-wrap gap-4",
                      month: "space-y-4 min-w-[270px]"
                    }}
                    modifiers={{
                      weekOff: (date) => weekOffDays.includes(date.getDay()),
                      holiday: (date) => holidayKeys.has(dateKey(date)),
                      approved: approvedDates,
                      pending: pendingDates
                    }}
                    modifiersClassNames={{
                      weekOff: "bg-sky-100 text-sky-700 border border-sky-300 rounded-md !opacity-100",
                      holiday: "bg-rose-100 text-rose-700 border border-rose-300 rounded-md !opacity-100",
                      approved: "bg-green-100 text-green-700 font-semibold rounded-md",
                      pending: "bg-orange-100 text-orange-700 font-semibold rounded-md"
                    }}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs mt-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-3 w-3 rounded bg-green-100 border border-green-300" />
                    Approved leave
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-3 w-3 rounded bg-orange-100 border border-orange-300" />
                    Pending leave
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-3 w-3 rounded bg-sky-100 border border-sky-300" />
                    Week off
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-3 w-3 rounded bg-rose-100 border border-rose-300" />
                    Holiday
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-5 min-w-0 lg:max-w-[620px] lg:justify-self-end">
          <CardHeader>
            <CardTitle>Leave Request</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="md:col-span-2 space-y-2">
                <Label>Leave Type</Label>
                <Select value={leaveTypeId} onValueChange={setLeaveTypeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select leave type" />
                  </SelectTrigger>
                  <SelectContent>
                    {leaveTypes.map((lt) => (
                      <SelectItem key={lt._id} value={lt._id}>
                        {lt.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Leave Balance</p>
                <p className="text-lg font-semibold">
                  {selectedBalance ? `${selectedBalance.remaining}/${selectedBalance.total}` : "-/-"}
                </p>
                {selectedBalance && (
                  <div className="text-xs text-muted-foreground mt-1 space-y-1">
                    <p>Available: {selectedBalance.remaining}</p>
                    <p>Pending: {selectedBalance.pending || 0}</p>
                    <p>Used: {selectedBalance.used}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>From Date</Label>
                <Input type="date" value={fromDate} onChange={(e) => onFromDateChange(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>To Date</Label>
                <Input type="date" value={toDate} onChange={(e) => onToDateChange(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Reason</Label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Optional reason"
              />
            </div>

            <div className="rounded-lg border p-3 text-sm">
              Applicable leave days {sandwichRuleEnabled ? "(sandwich rule enabled):" : "(excluding holidays/week-offs):"}{" "}
              <span className="font-semibold">{applicableDays}</span>
            </div>

            <div className="flex justify-start sm:justify-end">
              <Button onClick={submit} disabled={submitting || loading}>
                {submitting ? "Applying..." : "Apply Leave"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default LeaveApply;
