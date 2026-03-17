import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { getApiWithToken, postApiWithToken } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { AttendanceDay } from '../types/attendance';

const isPresentLikeStatus = (status?: string | null) =>
  status === 'present' || status === 'half_day_present' || status === 'full_day_present';

function LeavesScreen() {
  const navigation = useNavigation<any>();
  const { session } = useAuth();
  const token = session?.token || '';
  const safeAreaInsets = useSafeAreaInsets();
  const now = new Date();

  const [loading, setLoading] = useState(true);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>(
    'all'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [applyOpen, setApplyOpen] = useState(false);

  const initialDaysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const [leaveTypeId, setLeaveTypeId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [reason, setReason] = useState('');
  const [duration, setDuration] = useState<'full_day' | 'half_day'>('full_day');
  const [halfDaySession, setHalfDaySession] = useState<'first_half' | 'second_half'>('first_half');
  const [calendarDays, setCalendarDays] = useState<Record<number, AttendanceDay>>({});
  const [calendarDaysInMonth, setCalendarDaysInMonth] = useState(initialDaysInMonth);
  const [targetMonth, setTargetMonth] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [leaveTypeMenuOpen, setLeaveTypeMenuOpen] = useState(false);
  const [leaveBalances, setLeaveBalances] = useState<any[]>([]);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [activeDateField, setActiveDateField] = useState<'from' | 'to' | null>(null);

  const loadData = async () => {
    setLoading(true);
    setBalanceLoading(true);
    const [leavesRes, typesRes, balanceRes] = await Promise.all([
      getApiWithToken<any>('/leaves/my', token),
      getApiWithToken<any>('/employees/leave-types', token),
      getApiWithToken<any>('/leave-balances/my', token),
    ]);
    setLoading(false);
    setBalanceLoading(false);
    if (!leavesRes?.success) setError(leavesRes?.message || 'Unable to load leaves.');
    setLeaves(leavesRes?.success ? leavesRes.data || [] : []);
    setLeaveTypes(typesRes?.success ? typesRes.data || [] : []);
    setLeaveBalances(balanceRes?.success ? balanceRes.data || [] : []);
  };

  const changeMonth = (offset: number) => {
    setTargetMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
  };

  const loadCalendar = useCallback(
    async (monthDate: Date) => {
      if (!token) return;
      setCalendarLoading(true);
      const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(
        2,
        '0'
      )}`;
      const response = await getApiWithToken<{
        employees?: Array<{ days?: Record<number, AttendanceDay> }>;
        daysInMonth?: number;
      }>(`/timesheets/attendance/matrix/my?month=${monthKey}`, token);
      setCalendarLoading(false);
      if (response?.success) {
        const row = response.data?.employees?.[0];
        setCalendarDays(row?.days || {});
        setCalendarDaysInMonth(
          Number(
            response.data?.daysInMonth ||
              new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate()
          )
        );
      } else {
        setCalendarDays({});
        setCalendarDaysInMonth(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate());
      }
    },
    [token]
  );

  useEffect(() => {
    if (token) loadData();
  }, [token]);

  useEffect(() => {
    if (token) {
      loadCalendar(targetMonth);
    }
  }, [token, targetMonth, loadCalendar]);

  useEffect(() => {
    if (!applyOpen) {
      setLeaveTypeMenuOpen(false);
      setActiveDateField(null);
    }
  }, [applyOpen]);

  const applyLeave = async () => {
    if (!leaveTypeId || !fromDate || !toDate || !reason) {
      setError('Please select a leave type, choose both dates, and add a reason.');
      return;
    }
    setSubmitting(true);
    setError('');
    const payload: any = {
      leaveTypeId,
      fromDate,
      toDate,
      reason,
      duration,
    };
    if (duration === 'half_day') payload.halfDaySession = halfDaySession;
    const res = await postApiWithToken<any>('/leaves/apply', payload, token);
    if (!res?.success) {
      setSubmitting(false);
      setError(res?.message || 'Unable to apply leave.');
      return;
    }
    setSubmitting(false);
    setReason('');
    setApplyOpen(false);
    loadData();
  };

  const pendingCount = leaves.filter((l) => l.status === 'pending').length;
  const approvedCount = leaves.filter((l) => l.status === 'approved').length;
  const rejectedCount = leaves.filter((l) => l.status === 'rejected').length;
  const onLeaveToday = leaves.filter((l) => l.status === 'approved').length;
  const primaryBalance = useMemo(() => {
    return leaveBalances.length > 0 ? leaveBalances[0] : null;
  }, [leaveBalances]);
  const filteredLeaves = useMemo(() => {
    const byStatus =
      statusFilter === 'all'
        ? leaves
        : leaves.filter((l) => l.status === statusFilter);
    if (!searchQuery.trim()) return byStatus;
    const query = searchQuery.trim().toLowerCase();
    return byStatus.filter((leave) => {
      const employee =
        leave?.employeeId?.firstName || leave?.employeeId?.lastName
          ? `${leave.employeeId?.firstName || ''} ${leave.employeeId?.lastName || ''}`.trim()
          : leave?.employeeId?.email || '';
      const leaveType = leave?.leaveTypeName || leave?.leaveTypeId?.name || '';
      return (
        employee.toLowerCase().includes(query) ||
        leaveType.toLowerCase().includes(query)
      );
    });
  }, [leaves, searchQuery, statusFilter]);

  const statusLabel =
    statusFilter === 'all'
      ? 'All Status'
      : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1);

  const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const monthLabel = targetMonth.toLocaleString(undefined, { month: 'long', year: 'numeric' });
  const firstDayOffset = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1).getDay();
  const monthCells = useMemo(() => {
    const cells: (number | null)[] = [];
    for (let idx = 0; idx < firstDayOffset + calendarDaysInMonth; idx++) {
      if (idx < firstDayOffset) {
        cells.push(null);
      } else {
        cells.push(idx - firstDayOffset + 1);
      }
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [calendarDaysInMonth, firstDayOffset]);

  const calendarRows = useMemo(() => {
    const rows: (number | null)[][] = [];
    for (let i = 0; i < monthCells.length; i += 7) {
      rows.push(monthCells.slice(i, i + 7));
    }
    return rows;
  }, [monthCells]);

  const getAttendanceStyle = (day: number) => {
    const cell = calendarDays[day];
    if (!cell) return styles.calendarNeutral;
    if (cell.holidayName) return styles.calendarHoliday;
    if (cell.isWeekOff) return styles.calendarWeekOff;
    if (cell.isOnLeave) return styles.calendarLeave;
    if (isPresentLikeStatus(cell.status)) return styles.calendarPresent;
    if (cell.status === 'absent') return styles.calendarAbsent;
    return styles.calendarNeutral;
  };

  const formatDateKey = (day: number) => {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const handleSelectDay = (day: number) => {
    const selected = formatDateKey(day);
    if (activeDateField === 'from') {
      setFromDate(selected);
      setActiveDateField('to');
      return;
    }
    if (activeDateField === 'to') {
      setToDate(selected);
      setActiveDateField(null);
      return;
    }
    if (!fromDate || (fromDate && toDate)) {
      setFromDate(selected);
      setToDate('');
      return;
    }
    if (fromDate && !toDate) {
      if (selected >= fromDate) {
        setToDate(selected);
      } else {
        setFromDate(selected);
      }
    }
  };

  const applicableDays = useMemo(() => {
    if (!fromDate || !toDate) return 0;
    const start = new Date(fromDate);
    const end = new Date(toDate);
    if (end < start) return 0;
    const diff = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
    return diff;
  }, [fromDate, toDate]);

  return (
    <LinearGradient
      colors={['#f3f5f9', '#f3f5f9', '#eef1f6']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: Math.max(safeAreaInsets.top, 16) },
        ]}
      >
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statTitle}>Pending Requests</Text>
            <Text style={[styles.statValue, styles.statOrange]}>{pendingCount}</Text>
            <Text style={styles.statSubtitle}>requires action</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statTitle}>Approved</Text>
            <Text style={[styles.statValue, styles.statGreen]}>{approvedCount}</Text>
            <Text style={styles.statSubtitle}>total</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statTitle}>Rejected</Text>
            <Text style={[styles.statValue, styles.statRed]}>{rejectedCount}</Text>
            <Text style={styles.statSubtitle}>total</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statTitle}>On Leave Today</Text>
            <Text style={[styles.statValue, styles.statBlue]}>{onLeaveToday}</Text>
            <Text style={styles.statSubtitle}>employees</Text>
          </View>
        </View>

        <View style={styles.toolbar}>
          <View style={styles.searchWrap}>
            <MaterialCommunityIcons name="magnify" size={18} color="#94a3b8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search leaves..."
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          <View style={styles.toolbarRow}>
            <View style={styles.filterWrap}>
              <Pressable
                style={styles.filterButton}
                onPress={() => setFilterOpen((v) => !v)}
              >
                <Text style={styles.filterText}>{statusLabel}</Text>
                <MaterialCommunityIcons name="chevron-down" size={16} color="#64748b" />
              </Pressable>
              {filterOpen && (
                <View style={styles.filterMenu}>
                  {(['all', 'pending', 'approved', 'rejected'] as const).map((key) => (
                    <Pressable
                      key={key}
                      style={[
                        styles.filterItem,
                        statusFilter === key && styles.filterItemActive,
                      ]}
                      onPress={() => {
                        setStatusFilter(key);
                        setFilterOpen(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.filterItemText,
                          statusFilter === key && styles.filterItemTextActive,
                        ]}
                      >
                        {key === 'all'
                          ? 'All Status'
                          : key.charAt(0).toUpperCase() + key.slice(1)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
            <Pressable style={styles.refreshButton} onPress={loadData}>
              <MaterialCommunityIcons name="refresh" size={16} color="#0f172a" />
              <Text style={styles.refreshText}>Refresh</Text>
            </Pressable>
            <Pressable style={styles.applyButton} onPress={() => setApplyOpen(true)}>
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>Apply Leave</Text>
              )}
            </Pressable>
          </View>
        </View>

        <View style={styles.tableCard}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderText, styles.colEmployee]}>Employee</Text>
            <Text style={[styles.tableHeaderText, styles.colType]}>Leave Type</Text>
            <Text style={[styles.tableHeaderText, styles.colDate]}>From</Text>
            <Text style={[styles.tableHeaderText, styles.colDate]}>To</Text>
            <Text style={[styles.tableHeaderText, styles.colTiny]}>Days</Text>
            <Text style={[styles.tableHeaderText, styles.colTiny]}>Duration</Text>
            <Text style={[styles.tableHeaderText, styles.colTiny]}>Status</Text>
            <Text style={[styles.tableHeaderText, styles.colTiny]}>Approval</Text>
            <Text style={[styles.tableHeaderText, styles.colTiny]}>Actions</Text>
          </View>
          {loading ? (
            <View style={styles.tableEmpty}>
              <ActivityIndicator />
            </View>
          ) : filteredLeaves.length === 0 ? (
            <View style={styles.tableEmpty}>
              <Text style={styles.emptyText}>No leave requests found</Text>
            </View>
          ) : (
            filteredLeaves.map((leave) => {
              const employee =
                leave?.employeeId?.firstName || leave?.employeeId?.lastName
                  ? `${leave.employeeId?.firstName || ''} ${leave.employeeId?.lastName || ''}`.trim()
                  : leave?.employeeId?.email || 'Employee';
              const leaveType = leave?.leaveTypeName || leave?.leaveTypeId?.name || 'Leave';
              const from = leave?.fromDate ? String(leave.fromDate).slice(0, 10) : '-';
              const to = leave?.toDate ? String(leave.toDate).slice(0, 10) : '-';
              const days = leave?.totalDays || '-';
              const durationLabel =
                leave?.duration === 'half_day' ? 'Half Day' : 'Full Day';
              const status = leave?.status || 'pending';
              return (
                <View key={leave._id} style={styles.tableRow}>
                  <Text style={[styles.tableCell, styles.colEmployee]} numberOfLines={1}>
                    {employee}
                  </Text>
                  <Text style={[styles.tableCell, styles.colType]} numberOfLines={1}>
                    {leaveType}
                  </Text>
                  <Text style={[styles.tableCell, styles.colDate]}>{from}</Text>
                  <Text style={[styles.tableCell, styles.colDate]}>{to}</Text>
                  <Text style={[styles.tableCell, styles.colSmall]}>{days}</Text>
                  <Text style={[styles.tableCell, styles.colSmall]}>{durationLabel}</Text>
                  <Text style={[styles.tableCell, styles.colSmall]}>{status}</Text>
                  <Text style={[styles.tableCell, styles.colSmall]}>-</Text>
                  <Text style={[styles.tableCell, styles.colSmall]}>-</Text>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
      

      <Modal visible={applyOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Apply Leave</Text>
              <Pressable style={styles.modalClose} onPress={() => setApplyOpen(false)}>
                <MaterialCommunityIcons name="close" size={18} color="#0f172a" />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.modalContent}
              showsVerticalScrollIndicator={false}
            >
                <View style={[styles.calendarCard, styles.attendanceLikeCard]}>
                  <View style={styles.calendarHeaderRowTop}>
                    <Text style={styles.cardTitle}>Leave Calendar</Text>
                    <View style={styles.calendarNavRow}>
                      <Pressable style={styles.calendarNavButton} onPress={() => changeMonth(-1)}>
                        <MaterialCommunityIcons name="chevron-left" size={16} color="#111827" />
                      </Pressable>
                      <Text style={styles.calendarTitle}>{monthLabel}</Text>
                      <Pressable style={styles.calendarNavButton} onPress={() => changeMonth(1)}>
                        <MaterialCommunityIcons name="chevron-right" size={16} color="#111827" />
                      </Pressable>
                    </View>
                  </View>
                  <View style={styles.weekRow}>
                    {weekDays.map((d) => (
                      <Text key={d} style={styles.weekText}>
                        {d}
                      </Text>
                    ))}
                  </View>
                  <View style={styles.calendarGrid}>
                    {calendarRows.map((week, wIdx) => (
                      <View key={`week-${wIdx}`} style={styles.attendanceWeekRow}>
                        {week.map((day, dIdx) => {
                          if (!day) {
                            return <View key={`empty-${wIdx}-${dIdx}`} style={styles.calendarEmpty} />;
                          }
                          const key = formatDateKey(day);
                          const isSelected =
                            key === fromDate ||
                            key === toDate ||
                            (fromDate && toDate && key > fromDate && key < toDate);
                          return (
                            <Pressable
                              key={key}
                              style={[
                                styles.dayCell,
                                getAttendanceStyle(day),
                                isSelected && styles.dayCellSelected,
                              ]}
                              onPress={() => handleSelectDay(day)}
                            >
                              <Text
                                style={[
                                  styles.dayText,
                                  isSelected && styles.dayTextSelected,
                                ]}
                              >
                                {day}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    ))}
                  </View>
                  {calendarLoading && (
                    <View style={styles.calendarLoading}>
                      <ActivityIndicator color="#2563eb" />
                    </View>
                  )}
                  <View style={styles.legendRow}>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: '#dbeafe' }]} />
                      <Text style={styles.legendText}>Selected</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: '#a2c3eb' }]} />
                      <Text style={styles.legendText}>Week off</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: '#d1fae5' }]} />
                      <Text style={styles.legendText}>Holiday</Text>
                    </View>
                  </View>
                </View>

              <View style={styles.requestCard}>
                <Text style={styles.cardTitle}>Leave Request</Text>
                {error ? <Text style={styles.errorText}>{error}</Text> : null}
                {primaryBalance && (
                  <View style={styles.leaveBalancePanel}>
                    <Text style={styles.leaveBalanceHeading}>Leave Balance</Text>
                    <Text style={styles.leaveBalanceValue}>
                      {primaryBalance?.remaining ?? 0}/{primaryBalance?.total ?? 0}
                    </Text>
                    <Text style={styles.leaveBalanceMeta}>
                      Available: {primaryBalance?.remaining ?? 0}
                    </Text>
                    <Text style={styles.leaveBalanceMeta}>
                      Pending: {primaryBalance?.pending ?? 0}
                    </Text>
                    <Text style={styles.leaveBalanceMeta}>
                      Used: {primaryBalance?.used ?? 0}
                    </Text>
                  </View>
                )}
                <Text style={styles.fieldLabel}>Leave Type</Text>
                <View style={styles.selectRow}>
                  <Pressable
                    style={[styles.selectInput, styles.leaveTypeTrigger]}
                    onPress={() => setLeaveTypeMenuOpen((v) => !v)}
                  >
                    <Text style={styles.selectText}>
                      {leaveTypes.find((l) => l._id === leaveTypeId)?.name || 'Select leave type'}
                    </Text>
                    <MaterialCommunityIcons name="chevron-down" size={18} color="#94a3b8" />
                  </Pressable>
                </View>
                {leaveTypeMenuOpen && (
                  <View style={styles.leaveTypeListWrapper}>
                    <ScrollView style={styles.leaveTypeList}>
                      {leaveTypes.map((type, index) => (
                        <Pressable
                          key={type._id || `${type.name}-${index}`}
                          style={[
                            styles.leaveTypeItem,
                            leaveTypeId === type._id && styles.leaveTypeItemActive,
                          ]}
                          onPress={() => {
                            setLeaveTypeId(type._id || '');
                            setLeaveTypeMenuOpen(false);
                          }}
                        >
                          <Text
                            style={[
                              styles.leaveTypeItemText,
                              leaveTypeId === type._id && styles.leaveTypeItemTextActive,
                            ]}
                          >
                            {type.name || 'Leave type'}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                )}

                <Text style={styles.fieldLabel}>Duration</Text>
                <Pressable
                  style={styles.selectInput}
                  onPress={() => setDuration((d) => (d === 'full_day' ? 'half_day' : 'full_day'))}
                >
                  <Text style={styles.selectText}>{duration === 'half_day' ? 'Half Day' : 'Full Day'}</Text>
                </Pressable>

                <View style={styles.dateRow}>
                  <View style={styles.dateField}>
                    <Text style={styles.fieldLabel}>From Date</Text>
                    <Pressable
                      style={styles.dateInput}
                      onPress={() => setActiveDateField('from')}
                    >
                      <Text style={styles.selectText}>{fromDate || 'dd-mm-yyyy'}</Text>
                      <MaterialCommunityIcons
                        name="calendar-month-outline"
                        size={18}
                        color="#94a3b8"
                      />
                    </Pressable>
                  </View>
                  <View style={styles.dateField}>
                    <Text style={styles.fieldLabel}>To Date</Text>
                    <Pressable
                      style={styles.dateInput}
                      onPress={() => setActiveDateField('to')}
                    >
                      <Text style={styles.selectText}>{toDate || 'dd-mm-yyyy'}</Text>
                      <MaterialCommunityIcons
                        name="calendar-month-outline"
                        size={18}
                        color="#94a3b8"
                      />
                    </Pressable>
                  </View>
                </View>
                <Text style={styles.dateHint}>
                  {activeDateField
                    ? `Pick a date on the calendar for the ${activeDateField} field.`
                    : 'Tap a date on the calendar above to set the From/To fields.'}
                </Text>

                <Text style={styles.fieldLabel}>Reason</Text>
                <TextInput
                  style={styles.reasonInput}
                  placeholder="Enter leave reason"
                  value={reason}
                  onChangeText={setReason}
                />

                <View style={styles.summaryBox}>
                  <Text style={styles.summaryText}>
                    Applicable leave days (excluding holidays/week-offs): {applicableDays}
                  </Text>
                </View>

                <Pressable style={styles.applyPrimary} onPress={applyLeave} disabled={submitting}>
                  {submitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.applyPrimaryText}>Apply Leave</Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 16, paddingBottom: 120, gap: 16 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 6,
    shadowColor: '#0f172a',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  statTitle: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  statValue: {
    fontSize: 26,
    fontWeight: '800',
  },
  statSubtitle: {
    fontSize: 11,
    color: '#94a3b8',
  },
  statOrange: { color: '#f59e0b' },
  statGreen: { color: '#16a34a' },
  statRed: { color: '#dc2626' },
  statBlue: { color: '#2563eb' },
  toolbar: {
    gap: 10,
  },
  toolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    justifyContent: 'space-between',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    backgroundColor: '#ffffff',
    shadowColor: '#0f172a',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: '#0f172a',
  },
  filterWrap: {
    flex: 1,
    position: 'relative',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    backgroundColor: '#ffffff',
  },
  filterText: {
    fontSize: 12,
    color: '#0f172a',
    fontWeight: '600',
  },
  filterMenu: {
    position: 'absolute',
    top: 44,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    zIndex: 20,
    elevation: 4,
  },
  filterItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  filterItemActive: {
    backgroundColor: '#e0edff',
  },
  filterItemText: {
    fontSize: 12,
    color: '#0f172a',
  },
  filterItemTextActive: {
    color: '#1d4ed8',
    fontWeight: '700',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 42,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  refreshText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0f172a',
  },
  errorText: { fontSize: 12, color: '#dc2626' },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#0f172a' },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  typePillActive: { backgroundColor: '#eef2ff', borderColor: '#c7d2fe' },
  typeText: { fontSize: 11, color: '#64748b', fontWeight: '600' },
  typeTextActive: { color: '#1d4ed8' },
  formRow: { flexDirection: 'row', gap: 10 },
  input: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 10,
    backgroundColor: '#ffffff',
    fontSize: 12,
  },
  textArea: { height: 70, textAlignVertical: 'top', paddingTop: 8 },
  toggleRow: { flexDirection: 'row', gap: 10 },
  toggle: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  toggleActive: { backgroundColor: '#eef2ff', borderColor: '#c7d2fe' },
  toggleText: { fontSize: 11, fontWeight: '600', color: '#64748b' },
  toggleTextActive: { fontSize: 11, fontWeight: '700', color: '#1d4ed8' },
  applyButton: {
    height: 42,
    width: 140,
    borderRadius: 12,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1d4ed8',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  primaryButtonText: { color: '#fff', fontWeight: '700' },
  tableCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 8,
  },
  tableHeaderText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  tableCell: {
    fontSize: 11,
    color: '#0f172a',
  },
  tableEmpty: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  colEmployee: { flex: 1.2 },
  colType: { flex: 1 },
  colDate: { flex: 0.8 },
  colTiny: { flex: 0.55, textAlign: 'center' },
  colSmall: { flex: 0.45, textAlign: 'center' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#f8fafc',
    borderRadius: 18,
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  modalClose: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  modalContent: {
    gap: 12,
    paddingBottom: 12,
  },
  calendarCard: {
    backgroundColor: '#e8ecff',
    borderRadius: 18,
    padding: 18,
    borderWidth: 0,
    gap: 10,
  },
  attendanceLikeCard: {
    backgroundColor: '#f7f8ff',
    borderWidth: 0,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  requestCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  calendarHeaderRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  calendarNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  calendarNavButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  calendarTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2933',
  },
  attendanceWeekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  calendarGrid: {
    marginTop: 10,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  weekText: {
    width: '14%',
    textAlign: 'center',
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '600',
  },
  calendarEmpty: {
    width: '13%',
    height: 48,
  },
  dayCell: {
    width: '13%',
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  dayText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2933',
  },
  dayTextSelected: {
    fontWeight: '700',
    color: '#0f172a',
  },
  dayCellSelected: {
    borderWidth: 2,
    borderColor: '#2563eb',
  },
  calendarLoading: {
    marginTop: 8,
    alignItems: 'center',
  },
  calendarPresent: {
    backgroundColor: '#9ee6b7',
  },
  calendarLeave: {
    backgroundColor: '#37e273',
  },
  calendarWeekOff: {
    backgroundColor: '#a2c3eb',
  },
  calendarAbsent: {
    backgroundColor: '#fcd2d2',
  },
  calendarNeutral: {
    backgroundColor: '#f1f5f9',
  },
  calendarHoliday: {
    backgroundColor: '#efd980',
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 10,
    color: '#64748b',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0f172a',
  },
  selectRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  selectInput: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
  },
  selectText: {
    fontSize: 12,
    color: '#0f172a',
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    height: 42,
  },
  dateHint: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 6,
    marginBottom: 8,
  },
  leaveTypeTrigger: {
    justifyContent: 'center',
  },
  leaveTypeListWrapper: {
    marginTop: 6,
  },
  leaveTypeList: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    maxHeight: 180,
    overflow: 'hidden',
  },
  leaveTypeItem: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  leaveTypeItemActive: {
    backgroundColor: '#eef2ff',
  },
  leaveTypeItemText: {
    fontSize: 12,
    color: '#0f172a',
  },
  leaveTypeItemTextActive: {
    fontWeight: '700',
    color: '#1d4ed8',
  },
  leaveBalancePanel: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    padding: 14,
    marginTop: 12,
    marginBottom: 6,
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  leaveBalanceHeading: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  leaveBalanceValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 4,
  },
  leaveBalanceMeta: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dateField: {
    flex: 1,
    gap: 6,
  },
  reasonInput: {
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    backgroundColor: '#f8fafc',
  },
  summaryBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 10,
    backgroundColor: '#ffffff',
  },
  summaryText: {
    fontSize: 11,
    color: '#64748b',
  },
  applyPrimary: {
    height: 44,
    borderRadius: 12,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyPrimaryText: {
    color: '#fff',
    fontWeight: '700',
  },
});

export default LeavesScreen;
