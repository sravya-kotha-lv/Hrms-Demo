import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
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
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { getApiWithToken, postApiWithToken } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { AttendanceDay } from '../types/attendance';

const isPresentLikeStatus = (status?: string | null) =>
  status === 'present' || status === 'half_day_present' || status === 'full_day_present';

const toIsoDateString = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const DURATION_OPTIONS = [
  { value: 'full_day', label: 'Full Day' },
  { value: 'half_day', label: 'Half Day' },
] as const;

const SESSION_OPTIONS = [
  { value: 'first_half', label: 'First Half' },
  { value: 'second_half', label: 'Second Half' },
] as const;

const FONT_REGULAR = Platform.select({ android: 'sans-serif', ios: 'System', default: 'sans-serif' });
const FONT_MEDIUM = Platform.select({ android: 'sans-serif-medium', ios: 'System', default: 'sans-serif' });

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
  const [fromDateInput, setFromDateInput] = useState('');
  const [toDateInput, setToDateInput] = useState('');
  const [reason, setReason] = useState('');
  const [duration, setDuration] = useState<'full_day' | 'half_day'>('full_day');
  const [halfDaySession, setHalfDaySession] = useState<'first_half' | 'second_half'>('first_half');
  const [durationMenuOpen, setDurationMenuOpen] = useState(false);
  const [sessionMenuOpen, setSessionMenuOpen] = useState(false);
  const [calendarDays, setCalendarDays] = useState<Record<number, AttendanceDay>>({});
  const [calendarDaysInMonth, setCalendarDaysInMonth] = useState(initialDaysInMonth);
  const [targetMonth, setTargetMonth] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [leaveTypeMenuOpen, setLeaveTypeMenuOpen] = useState(false);
  const [leaveBalances, setLeaveBalances] = useState<any[]>([]);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [activeDateField, setActiveDateField] = useState<'from' | 'to' | null>(null);
  const [miniCalendarField, setMiniCalendarField] = useState<'from' | 'to' | null>(null);
  const [selectedLeave, setSelectedLeave] = useState<any | null>(null);
  const [detailsVisible, setDetailsVisible] = useState(false);

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
      setDurationMenuOpen(false);
      setSessionMenuOpen(false);
      setMiniCalendarField(null);
    }
  }, [applyOpen]);

  useFocusEffect(
    useCallback(() => {
      const state = navigation.getState();
      const currentRoute = state.routes?.[state.index];
      const shouldOpenModal = currentRoute?.params?.openApplyModal;
      if (shouldOpenModal) {
        setApplyOpen(true);
        navigation.setParams({ openApplyModal: undefined });
      }
    }, [navigation])
  );

  useEffect(() => {
    if (duration === 'full_day') {
      setSessionMenuOpen(false);
    }
  }, [duration]);

  useEffect(() => {
    if (duration !== 'half_day') return;

    if (fromDate) {
      setToDate(fromDate);
      setToDateInput(fromDateInput);
    } else {
      setToDate('');
      setToDateInput('');
    }

    if (activeDateField === 'to') {
      setActiveDateField('from');
    }
  }, [duration, fromDate, fromDateInput, activeDateField]);

  const applyLeave = async () => {
    const effectiveToDate = duration === 'half_day' ? fromDate : toDate;

    if (!leaveTypeId || !fromDate || !effectiveToDate || !reason) {
      setError(
        duration === 'half_day'
          ? 'Please select a leave type, choose the date, and add a reason.'
          : 'Please select a leave type, choose both dates, and add a reason.'
      );
      return;
    }
    setSubmitting(true);
    setError('');
    const payload: any = {
      leaveTypeId,
      fromDate,
      toDate: effectiveToDate,
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
    setDurationMenuOpen(false);
    setSessionMenuOpen(false);
    setApplyOpen(false);
    loadData();
  };

  const pendingCount = leaves.filter((l) => l.status === 'pending').length;
  const approvedCount = leaves.filter((l) => l.status === 'approved').length;
  const rejectedCount = leaves.filter((l) => l.status === 'rejected').length;
  const onLeaveToday = leaves.filter((l) => l.status === 'approved').length;
  const selectedLeaveType =
    leaveTypes.find((type) => String(type?._id || '') === String(leaveTypeId || '')) || null;

  const selectedBalance = (() => {
    if (!leaveBalances.length) return null;
    if (!leaveTypeId) return leaveBalances[0];

    const normalizedLeaveTypeId = String(leaveTypeId);
    const match = leaveBalances.find((balance) => {
      const rawLeaveTypeId = balance?.leaveTypeId;
      const balanceLeaveTypeId =
        typeof rawLeaveTypeId === 'object' && rawLeaveTypeId !== null
          ? String(rawLeaveTypeId._id || rawLeaveTypeId.id || '')
          : String(rawLeaveTypeId || '');
      return balanceLeaveTypeId === normalizedLeaveTypeId;
    });

    return match || null;
  })();
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

  const formatDateKey = (day: number, monthDate: Date = targetMonth) => {
    const y = monthDate.getFullYear();
    const m = String(monthDate.getMonth() + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const handleSelectDay = (day: number) => {
    const selected = formatDateKey(day);
    const displayText = formatDisplayDate(selected);
    if (miniCalendarField) {
      setMiniCalendarField(null);
    }
    if (activeDateField === 'from') {
      setDateField('from', selected, { displayText });
      setActiveDateField('to');
      return;
    }
    if (activeDateField === 'to') {
      setDateField('to', selected, { displayText });
      setActiveDateField(null);
      return;
    }
    if (!fromDate || (fromDate && toDate)) {
      setDateField('from', selected, { displayText });
      setDateField('to', '', { displayText: '' });
      return;
    }
    if (fromDate && !toDate) {
      if (selected >= fromDate) {
        setDateField('to', selected, { displayText });
      } else {
        setDateField('from', selected, { displayText });
      }
    }
  };

  const openDetails = (leave: any) => {
    setSelectedLeave(leave);
    setDetailsVisible(true);
  };

  const closeDetails = () => {
    setDetailsVisible(false);
    setSelectedLeave(null);
  };

  const openFieldCalendar = (field: 'from' | 'to') => {
    setActiveDateField(field);
    setMiniCalendarField(field);
  };

  const closeMiniCalendar = () => {
    setMiniCalendarField(null);
  };

  const applicableDays = useMemo(() => {
    if (!fromDate || !toDate) return 0;
    const start = new Date(fromDate);
    const end = new Date(toDate);
    if (end < start) return 0;
    const diff = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
    return diff;
  }, [fromDate, toDate]);

  const formatTableDate = (value?: string) => {
    if (!value) return '-';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return String(value).slice(0, 10);
    return parsed.toLocaleDateString(undefined, {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const detailEmployeeName = selectedLeave
    ? [
        selectedLeave?.employeeId?.firstName,
        selectedLeave?.employeeId?.lastName,
      ].filter(Boolean).join(' ') ||
      selectedLeave?.employeeName ||
      selectedLeave?.employeeId?.email ||
      'Employee'
    : '';
  const detailLeaveType = selectedLeave?.leaveTypeName || selectedLeave?.leaveTypeId?.name || 'Leave';
  const detailFrom = selectedLeave ? formatTableDate(selectedLeave.fromDate) : '-';
  const detailTo = selectedLeave ? formatTableDate(selectedLeave.toDate) : '-';
  const detailDays = selectedLeave?.totalDays ?? '-';
  const detailDuration = selectedLeave?.duration === 'half_day' ? 'Half Day' : 'Full Day';
  const detailStatus = selectedLeave?.status ? selectedLeave.status.charAt(0).toUpperCase() + selectedLeave.status.slice(1) : 'Pending';
  const detailApproval =
    selectedLeave?.approvalStatus ||
    selectedLeave?.approvedBy?.name ||
    'Single-step';
  const detailReason = selectedLeave?.reason || selectedLeave?.leaveReason || '-';
  const currentUserProfileImage =
    session?.profile?.profileImage ||
    session?.profile?.profilePhoto ||
    session?.loginData?.profileImage ||
    session?.loginData?.profilePhoto ||
    null;

  const formatDisplayDate = (value?: string) => {
    if (!value) return '';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    const day = String(parsed.getDate()).padStart(2, '0');
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const year = parsed.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const parseDisplayDate = (value: string) => {
    const normalized = value.trim();
    const match = normalized.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (!match) return null;
    const [, dayPart, monthPart, yearPart] = match;
    const day = Number(dayPart);
    const month = Number(monthPart);
    const year = Number(yearPart);
    if (!day || !month || !year) return null;
    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() !== year ||
      date.getMonth() + 1 !== month ||
      date.getDate() !== day
    ) {
      return null;
    }
    return toIsoDateString(date);
  };

  const setDateField = (
    field: 'from' | 'to',
    isoValue: string,
    options?: { displayText?: string }
  ) => {
    const displayText =
      options?.displayText ?? (isoValue ? formatDisplayDate(isoValue) : '');
    if (field === 'from') {
      setFromDate(isoValue);
      setFromDateInput(displayText);
      if (duration === 'half_day') {
        setToDate(isoValue);
        setToDateInput(displayText);
      }
      return;
    }
    setToDate(isoValue);
    setToDateInput(displayText);
  };

  const handleDateInputChange = (field: 'from' | 'to', text: string) => {
    if (field === 'from') {
      setFromDateInput(text);
    } else {
      setToDateInput(text);
    }
    const trimmed = text.trim();
    if (!trimmed) {
      setDateField(field, '', { displayText: '' });
      return;
    }
    const iso = parseDisplayDate(trimmed);
    if (iso) {
      setDateField(field, iso, { displayText: formatDisplayDate(iso) });
    }
  };

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
                <Text
                  style={styles.filterText}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  allowFontScaling={false}
                >
                  {statusLabel}
                </Text>
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
                        allowFontScaling={false}
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
          <View style={styles.tableIntro}>
            <Text style={styles.tableTitle}>Leave Requests</Text>
            <Text style={styles.tableHint}>Swipe left or right to view all columns.</Text>
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
            <View style={styles.tableViewport}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator
                directionalLockEnabled
                alwaysBounceHorizontal={false}
                bounces={false}
                decelerationRate="fast"
                scrollEventThrottle={16}
                overScrollMode="never"
                keyboardShouldPersistTaps="handled"
                persistentScrollbar
                style={styles.tableScroll}
                contentContainerStyle={styles.tableHorizontalScroll}
              >
                <View style={styles.tableContent}>
                  <View style={styles.tableHeaderRow}>
                    <Text style={[styles.tableHeaderText, styles.colEmployee]}>Employee</Text>
                    <Text style={[styles.tableHeaderText, styles.colType]}>Leave Type</Text>
                    <Text style={[styles.tableHeaderText, styles.colDate]}>From</Text>
                    <Text style={[styles.tableHeaderText, styles.colDate]}>To</Text>
                    <Text style={[styles.tableHeaderText, styles.colDays]}>Days</Text>
                    <Text style={[styles.tableHeaderText, styles.colDuration]}>Duration</Text>
                    <Text style={[styles.tableHeaderText, styles.colStatus]}>Status</Text>
                    <Text style={[styles.tableHeaderText, styles.colApproval]}>Approval</Text>
                    <Text style={[styles.tableHeaderText, styles.colActions]}>Actions</Text>
                  </View>
                  <View>
                    {filteredLeaves.map((leave) => {
                      const employee =
                        leave?.employeeId?.firstName || leave?.employeeId?.lastName
                          ? `${leave.employeeId?.firstName || ''} ${leave.employeeId?.lastName || ''}`.trim()
                          : leave?.employeeId?.email || 'Employee';
                      const leaveType = leave?.leaveTypeName || leave?.leaveTypeId?.name || 'Leave';
                      const from = formatTableDate(leave?.fromDate);
                      const to = formatTableDate(leave?.toDate);
                      const days = leave?.totalDays || '-';
                      const durationLabel = leave?.duration === 'half_day' ? 'Half Day' : 'Full Day';
                      const status = leave?.status || 'pending';
                      const approvalLabel = leave?.approvalStatus || leave?.approvedBy?.name || 'Single-step';
                      const employeeInitial = (employee.trim()[0] || 'U').toUpperCase();
                      const employeeProfileImage =
                        leave?.employeeId?.profileImage ||
                        leave?.employeeId?.profilePhoto ||
                        leave?.employeeProfileImage ||
                        leave?.profileImage ||
                        currentUserProfileImage ||
                        null;
                      const employeeIdText =
                        leave?.employeeId?.employeeCode ||
                        leave?.employeeId?.code ||
                        leave?.employeeCode ||
                        (leave?.employeeId?.employeeId != null
                          ? String(leave.employeeId.employeeId)
                          : undefined) ||
                        (leave?.employeeId?._id != null
                          ? String(leave.employeeId._id)
                          : undefined) ||
                        leave?.employeeId?.email ||
                        session?.profile?.employeeCode ||
                        (session?.profile?.employeeId != null
                          ? String(session.profile.employeeId)
                          : undefined) ||
                        session?.profile?.email ||
                        'SELF';
                      return (
                        <View key={leave._id} style={styles.tableRow}>
                          <View style={styles.colEmployee}>
                            <View style={styles.employeeCell}>
                              <View style={styles.employeeBadge}>
                                {employeeProfileImage ? (
                                  <Image
                                    source={{ uri: employeeProfileImage }}
                                    style={styles.employeeBadgeImage}
                                  />
                                ) : (
                                  <Text style={styles.employeeBadgeText}>{employeeInitial}</Text>
                                )}
                              </View>
                              <View style={styles.employeeMeta}>
                                <Text style={styles.tableCell} numberOfLines={1}>
                                  {employee}
                                </Text>
                              <Text style={styles.employeeHint}>{employeeIdText}</Text>
                              </View>
                            </View>
                          </View>
                          <Text style={[styles.tableCell, styles.colType]} numberOfLines={1}>
                            {leaveType}
                          </Text>
                          <Text style={[styles.tableCell, styles.colDate]}>{from}</Text>
                          <Text style={[styles.tableCell, styles.colDate]}>{to}</Text>
                          <Text style={[styles.tableCell, styles.colDays]}>{days}</Text>
                          <Text style={[styles.tableCell, styles.colDuration]}>{durationLabel}</Text>
                          <View style={styles.colStatus}>
                            <View
                              style={[
                                styles.statusPill,
                                status === 'approved'
                                  ? styles.statusApproved
                                  : status === 'rejected'
                                    ? styles.statusRejected
                                    : styles.statusPending,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.statusPillText,
                                  status === 'approved'
                                    ? styles.statusApprovedText
                                    : status === 'rejected'
                                      ? styles.statusRejectedText
                                      : styles.statusPendingText,
                                ]}
                              >
                                {status.charAt(0).toUpperCase() + status.slice(1)}
                              </Text>
                            </View>
                          </View>
                          <Text style={[styles.tableCell, styles.colApproval]} numberOfLines={1}>
                            {approvalLabel}
                          </Text>
                          <View style={styles.colActions}>
                            <Pressable
                              style={styles.actionTrigger}
                              onPress={() => openDetails(leave)}
                              hitSlop={6}
                            >
                              <MaterialCommunityIcons name="dots-horizontal" size={20} color="#64748b" />
                            </Pressable>
                            
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              </ScrollView>
            </View>
            
          )}
          {!loading && filteredLeaves.length > 0 ? (
            <View style={styles.tableFooter}>
              <Text style={styles.tableFooterText}>
                Showing {filteredLeaves.length} of {leaves.length} leave records
              </Text>
              <Text style={styles.tableFooterText}>You have reached the end</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
      
      <Modal visible={detailsVisible} transparent animationType="fade">
        <Pressable style={styles.detailsBackdrop} onPress={closeDetails}>
          <Pressable style={styles.detailsCard} onPress={(event) => event.stopPropagation()}>
            <View style={styles.detailsHeader}>
              <Text style={styles.detailsTitle}>Leave Details</Text>
              <Pressable style={styles.detailsClose} onPress={closeDetails}>
                <MaterialCommunityIcons name="close" size={18} color="#64748b" />
              </Pressable>
            </View>
            <View style={styles.detailsBody}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Employee</Text>
                <Text style={styles.detailValue}>{detailEmployeeName}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Leave Type</Text>
                <Text style={styles.detailValue}>{detailLeaveType}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>From</Text>
                <Text style={styles.detailValue}>{detailFrom}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>To</Text>
                <Text style={styles.detailValue}>{detailTo}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Days</Text>
                <Text style={styles.detailValue}>{detailDays}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Duration</Text>
                <Text style={styles.detailValue}>{detailDuration}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Status</Text>
                <Text style={styles.detailValue}>{detailStatus}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Approval</Text>
                <Text style={styles.detailValue}>{detailApproval}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Reason</Text>
                <Text style={styles.detailValue}>{detailReason}</Text>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

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
                <View style={styles.leaveBalancePanel}>
                  <Text style={styles.leaveBalanceHeading}>
                    {selectedLeaveType?.name ? `${selectedLeaveType.name} Balance` : 'Leave Balance'}
                  </Text>
                  <Text style={styles.leaveBalanceValue}>
                    {selectedBalance?.remaining ?? 0}/{selectedBalance?.total ?? 0}
                  </Text>
                  <Text style={styles.leaveBalanceMeta}>
                    Available: {selectedBalance?.remaining ?? 0}
                  </Text>
                  <Text style={styles.leaveBalanceMeta}>
                    Pending: {selectedBalance?.pending ?? 0}
                  </Text>
                  <Text style={styles.leaveBalanceMeta}>
                    Used: {selectedBalance?.used ?? 0}
                  </Text>
                </View>
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
                  <View style={styles.selectDropdownWrapper}>
                    <ScrollView style={[styles.selectDropdown, styles.selectDropdownScroll]}>
                      {leaveTypes.map((type, index) => (
                        <Pressable
                          key={type._id || `${type.name}-${index}`}
                          style={[
                            styles.selectDropdownItem,
                            leaveTypeId === type._id && styles.selectDropdownItemActive,
                          ]}
                          onPress={() => {
                            setLeaveTypeId(type._id || '');
                            setLeaveTypeMenuOpen(false);
                          }}
                        >
                          <Text
                            style={[
                              styles.selectDropdownItemText,
                              leaveTypeId === type._id && styles.selectDropdownItemTextActive,
                            ]}
                          >
                            {type.name || 'Leave type'}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                )}

                <View style={styles.formRow}>
                  <View style={styles.fieldColumn}>
                    <Text style={styles.fieldLabel}>Duration</Text>
                    <View style={styles.selectRow}>
                      <Pressable
                        style={styles.selectInput}
                        onPress={() => setDurationMenuOpen((v) => !v)}
                        hitSlop={6}
                      >
                        <Text style={styles.selectText}>
                          {duration === 'half_day' ? 'Half Day' : 'Full Day'}
                        </Text>
                        <MaterialCommunityIcons name="chevron-down" size={18} color="#94a3b8" />
                      </Pressable>
                    </View>
                    {durationMenuOpen && (
                      <View style={styles.selectDropdownWrapper}>
                        <View style={styles.selectDropdown}>
                          {DURATION_OPTIONS.map((option) => (
                            <Pressable
                              key={option.value}
                              style={[
                                styles.selectDropdownItem,
                                duration === option.value && styles.selectDropdownItemActive,
                              ]}
                              onPress={() => {
                                setDuration(option.value);
                                setDurationMenuOpen(false);
                              }}
                            >
                              <Text
                                style={[
                                  styles.selectDropdownItemText,
                                  duration === option.value &&
                                    styles.selectDropdownItemTextActive,
                                ]}
                              >
                                {option.label}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>
                    )}
                  </View>
                  {duration === 'half_day' && (
                    <View style={styles.fieldColumn}>
                      <Text style={styles.fieldLabel}>Session</Text>
                      <View style={styles.selectRow}>
                        <Pressable
                          style={styles.selectInput}
                          onPress={() => setSessionMenuOpen((v) => !v)}
                          hitSlop={6}
                        >
                          <Text style={styles.selectText}>
                            {SESSION_OPTIONS.find((option) => option.value === halfDaySession)?.label ??
                              'Session'}
                          </Text>
                          <MaterialCommunityIcons name="chevron-down" size={18} color="#94a3b8" />
                        </Pressable>
                      </View>
                      {sessionMenuOpen && (
                        <View style={styles.selectDropdownWrapper}>
                          <View style={styles.selectDropdown}>
                            {SESSION_OPTIONS.map((option) => (
                              <Pressable
                                key={option.value}
                                style={[
                                  styles.selectDropdownItem,
                                  halfDaySession === option.value &&
                                    styles.selectDropdownItemActive,
                                ]}
                                onPress={() => {
                                  setHalfDaySession(option.value);
                                  setSessionMenuOpen(false);
                                }}
                              >
                                <Text
                                  style={[
                                    styles.selectDropdownItemText,
                                    halfDaySession === option.value &&
                                      styles.selectDropdownItemTextActive,
                                  ]}
                                >
                                  {option.label}
                                </Text>
                              </Pressable>
                            ))}
                          </View>
                        </View>
                      )}
                    </View>
                  )}
                </View>

                <View style={styles.dateRow}>
                  <View style={styles.dateField}>
                    <Text style={styles.fieldLabel}>From Date</Text>
                    <View style={styles.dateInput}>
                      <TextInput
                        style={styles.dateTextInput}
                        placeholder="dd-mm-yyyy"
                        placeholderTextColor="#94a3b8"
                        value={fromDateInput}
                        onChangeText={(text) => handleDateInputChange('from', text)}
                        keyboardType="number-pad"
                        maxLength={10}
                        onFocus={() => setActiveDateField('from')}
                      />
                    <Pressable onPress={() => openFieldCalendar('from')} hitSlop={6}>
                        <MaterialCommunityIcons
                          name="calendar-month-outline"
                          size={18}
                          color="#94a3b8"
                        />
                      </Pressable>
                    </View>
                  </View>
                  {duration !== 'half_day' && (
                    <View style={styles.dateField}>
                      <Text style={styles.fieldLabel}>To Date</Text>
                      <View style={styles.dateInput}>
                        <TextInput
                          style={styles.dateTextInput}
                          placeholder="dd-mm-yyyy"
                          placeholderTextColor="#94a3b8"
                          value={toDateInput}
                          onChangeText={(text) => handleDateInputChange('to', text)}
                          keyboardType="number-pad"
                          maxLength={10}
                          onFocus={() => setActiveDateField('to')}
                        />
                        <Pressable onPress={() => openFieldCalendar('to')} hitSlop={6}>
                          <MaterialCommunityIcons
                            name="calendar-month-outline"
                            size={18}
                            color="#94a3b8"
                          />
                        </Pressable>
                      </View>
                    </View>
                  )}
                </View>
                <Text style={styles.dateHint}>
                  {duration === 'half_day'
                    ? 'Tap a date on the calendar above to set the leave date.'
                    : activeDateField
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

      <Modal visible={miniCalendarField !== null} transparent animationType="fade">
        <Pressable style={styles.miniCalendarBackdrop} onPress={closeMiniCalendar}>
          <Pressable
            style={styles.miniCalendarCard}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={styles.miniCalendarHeader}>
              <View style={styles.miniCalendarNavRow}>
                <Pressable
                  style={styles.miniCalendarNavButton}
                  onPress={() => changeMonth(-1)}
                >
                  <MaterialCommunityIcons name="chevron-left" size={16} color="#64748b" />
                </Pressable>
                <Text style={styles.miniCalendarTitle}>{monthLabel}</Text>
                <Pressable
                  style={styles.miniCalendarNavButton}
                  onPress={() => changeMonth(1)}
                >
                  <MaterialCommunityIcons name="chevron-right" size={16} color="#64748b" />
                </Pressable>
              </View>
              <Pressable style={styles.miniCalendarClose} onPress={closeMiniCalendar}>
                <MaterialCommunityIcons name="arrow-down" size={16} color="#64748b" />
              </Pressable>
            </View>
            <View style={[styles.weekRow, styles.miniWeekRow]}>
              {weekDays.map((d) => (
                <Text key={d} style={[styles.weekText, styles.miniWeekText]}>
                  {d}
                </Text>
              ))}
            </View>
            <View style={styles.miniCalendarGrid}>
              {calendarRows.map((week, wIdx) => (
                <View key={`mini-week-${wIdx}`} style={styles.miniWeekRow}>
                  {week.map((day, dIdx) => {
                    if (!day) {
                      return <View key={`mini-empty-${wIdx}-${dIdx}`} style={styles.miniCalendarEmpty} />;
                    }
                    const key = formatDateKey(day);
                    const isSelected =
                      key === fromDate ||
                      key === toDate ||
                      (fromDate && toDate && key > fromDate && key < toDate);
                    return (
                      <Pressable
                        key={`mini-day-${key}`}
                        style={[
                          styles.miniDayCell,
                          getAttendanceStyle(day),
                          isSelected && styles.dayCellSelected,
                        ]}
                        onPress={() => {
                          handleSelectDay(day);
                          closeMiniCalendar();
                        }}
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
          </Pressable>
        </Pressable>
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
    zIndex: 30,
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
    minWidth: 120,
  },
  filterText: {
    fontSize: 12,
    color: '#0f172a',
    fontWeight: '600',
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: FONT_MEDIUM,
  },
  filterMenu: {
    position: 'absolute',
    top: 44,
    left: 0,
    minWidth: 140,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    zIndex: 20,
    elevation: 4,
  },
  filterItem: {
    paddingHorizontal: 12,
    minHeight: 40,
    justifyContent: 'center',
  },
  filterItemActive: {
    backgroundColor: '#e0edff',
  },
  filterItemText: {
    fontSize: 12,
    color: '#0f172a',
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: FONT_REGULAR,
  },
  filterItemTextActive: {
    color: '#1d4ed8',
    fontWeight: '700',
    fontFamily: FONT_MEDIUM,
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
    overflow: 'hidden',
  },
  tableIntro: {
    gap: 4,
    paddingHorizontal: 4,
  },
  tableTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  tableHint: {
    fontSize: 11,
    color: '#64748b',
  },
  tableViewport: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#eef2f7',
    backgroundColor: '#ffffff',
    width: '100%',
  },
  tableScroll: {
    width: '100%',
  },
  tableHorizontalScroll: {
    minWidth: 1280,
  },
  tableContent: {
    minWidth: 1280,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 10,
    paddingTop: 2,
    paddingHorizontal: 8,
    backgroundColor: '#f8fafc',
  },
  tableHeaderText: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '700',
    textTransform: 'uppercase',
    lineHeight: 14,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 58,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  tableCell: {
    fontSize: 12,
    color: '#0f172a',
    lineHeight: 16,
  },
  tableEmpty: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  colEmployee: { width: 210 },
  colType: { width: 110 },
  colDate: { width: 92 },
  colDays: { width: 70, textAlign: 'center' },
  colDuration: { width: 104 },
  colStatus: { width: 110, alignItems: 'flex-start', justifyContent: 'center' },
  colApproval: { width: 120, textAlign: 'center' },
  colActions: {
    width: 84,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  actionTrigger: {
    padding: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  actionLabel: {
    fontSize: 10,
    color: '#64748b',
  },
  employeeCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  employeeBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  employeeBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b',
  },
  employeeBadgeImage: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
  },
  employeeMeta: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  employeeHint: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusApproved: {
    backgroundColor: '#dcfce7',
    borderColor: '#86efac',
  },
  statusApprovedText: {
    color: '#166534',
  },
  statusRejected: {
    backgroundColor: '#fee2e2',
    borderColor: '#fca5a5',
  },
  statusRejectedText: {
    color: '#b91c1c',
  },
  statusPending: {
    backgroundColor: '#fef3c7',
    borderColor: '#fcd34d',
  },
  statusPendingText: {
    color: '#92400e',
  },
  tableActionsText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 1,
  },
  tableFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingTop: 8,
    paddingHorizontal: 4,
  },
  tableFooterText: {
    fontSize: 10,
    color: '#94a3b8',
  },
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
  detailsBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  detailsCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 12,
  },
  detailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  detailsClose: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsBody: {
    gap: 10,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  detailLabel: {
    fontSize: 12,
    color: '#475569',
    width: '40%',
  },
  detailValue: {
    fontSize: 12,
    color: '#0f172a',
    fontWeight: '600',
    width: '60%',
  },
  miniCalendarBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  miniCalendarCard: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  miniCalendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  miniCalendarNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  miniCalendarTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  miniCalendarClose: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniWeekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  miniWeekText: {
    fontSize: 10,
  },
  miniCalendarGrid: {
    marginTop: 8,
  },
  miniCalendarNavButton: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  miniCalendarEmpty: {
    width: '13%',
    height: 36,
  },
  miniDayCell: {
    width: '13%',
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
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
  fieldColumn: {
    flex: 1,
    gap: 6,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  dateTextInput: {
    flex: 1,
    fontSize: 12,
    color: '#0f172a',
    paddingVertical: 0,
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
  selectDropdownWrapper: {
    marginTop: 6,
  },
  selectDropdown: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },
  selectDropdownScroll: {
    maxHeight: 180,
  },
  selectDropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  selectDropdownItemActive: {
    backgroundColor: '#eef2ff',
  },
  selectDropdownItemText: {
    fontSize: 12,
    color: '#0f172a',
  },
  selectDropdownItemTextActive: {
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
