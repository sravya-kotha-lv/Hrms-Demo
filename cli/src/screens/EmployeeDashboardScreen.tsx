import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  PermissionsAndroid,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { getApiWithToken, postApiWithToken } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { launchCamera } from 'react-native-image-picker';
import Geolocation from 'react-native-geolocation-service';
import AttendanceTab from '../components/AttendanceTab';
import { AttendanceDay } from '../types/attendance';
type CheckInPolicy = {
  attendanceIpEnabled: boolean;
  attendanceSelfieRequired: boolean;
  attendanceGeoFenceEnabled: boolean;
  attendanceGeoRadiusMeters: number;
};

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const toDateInput = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getWeekStart = (value: Date) => {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff);
  return d;
};

const formatDate = (value: string | Date) =>
  new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

const formatDateLong = (value: string | Date) =>
  new Date(value).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });

const formatTime = (value: string | Date) =>
  new Date(value).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

const today = new Date();
const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
const currentYear = today.getFullYear();

function EmployeeDashboardScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { session, logout } = useAuth();
  const token = session?.token || '';
  const profile = session?.profile || session?.loginData || null;
  const permissions = session?.permissions || [];
  const safeAreaInsets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<'overview' | 'attendance' | 'planning'>('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const [weeklyStatus, setWeeklyStatus] = useState<string | null>(null);
  const [weeklyHours, setWeeklyHours] = useState(0);
  const [weeklyEntries, setWeeklyEntries] = useState<any[]>([]);
  const [onlineList, setOnlineList] = useState<any[]>([]);
  const [onLeaveList, setOnLeaveList] = useState<any[]>([]);
  const [attendanceToday, setAttendanceToday] = useState<any | null>(null);
  const [leaveBalances, setLeaveBalances] = useState<any[]>([]);
  const [myLeaves, setMyLeaves] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [upcomingHolidays, setUpcomingHolidays] = useState<any[]>([]);
  const [weekOffDays, setWeekOffDays] = useState<number[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<{ birthdays: any[]; anniversaries: any[] }>({
    birthdays: [],
    anniversaries: [],
  });
  const [matrixDays, setMatrixDays] = useState<Record<number, AttendanceDay>>({});
  const [daysInMonth, setDaysInMonth] = useState<number>(31);
  const [myProfile, setMyProfile] = useState<any>(profile || null);
  const [checkInPolicy, setCheckInPolicy] = useState<CheckInPolicy>({
    attendanceIpEnabled: false,
    attendanceSelfieRequired: false,
    attendanceGeoFenceEnabled: false,
    attendanceGeoRadiusMeters: 200,
  });
  const [policyWarning, setPolicyWarning] = useState('');
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const weekStart = useMemo(() => getWeekStart(new Date()), []);
  
  const loadDashboard = async (silent = false) => {
    if (!silent) setLoading(true);
    if (silent) setRefreshing(true);
    const todayIso = toDateInput(new Date());
    const weekStartIso = toDateInput(weekStart);

    const [
      weeklyRes,
      attendanceRes,
      leaveRes,
      balanceRes,
      onlineRes,
      onLeaveRes,
      notifRes,
      holidayRes,
      weekOffRes,
      matrixRes,
      profileRes,
      eventsRes,
      checkInPolicyRes,
    ] = await Promise.all([
      getApiWithToken<any>(`/timesheets/weekly/my?weekStart=${weekStartIso}`, token),
      getApiWithToken<any>(`/timesheets/attendance/my?date=${todayIso}`, token),
      getApiWithToken<any>('/leaves/my', token),
      getApiWithToken<any>('/leave-balances/my', token),
      getApiWithToken<any>('/timesheets/online', token),
      getApiWithToken<any>('/timesheets/on-leave', token),
      getApiWithToken<any>('/notifications/my?limit=6', token),
      getApiWithToken<any>(`/holidays?year=${currentYear}`, token),
      getApiWithToken<any>('/week-offs', token),
      getApiWithToken<any>(`/timesheets/attendance/matrix/my?month=${currentMonth}`, token),
      getApiWithToken<any>('/employees/me', token),
      getApiWithToken<any>('/employees/upcoming-events?days=7', token),
      getApiWithToken<any>('/timesheets/checkin-policy', token),
    ]);

    if (weeklyRes?.success && weeklyRes?.data) {
      setWeeklyStatus(weeklyRes.data.status || 'draft');
      const entries = weeklyRes.data.entries || [];
      setWeeklyEntries(entries);
      const total = entries.reduce((sum: number, e: any) => sum + (Number(e?.hours) || 0), 0);
      setWeeklyHours(total);
    } else {
      setWeeklyStatus(null);
      setWeeklyHours(0);
      setWeeklyEntries([]);
    }

    if (attendanceRes?.success) {
      const record = (attendanceRes.data || [])[0];
      setAttendanceToday(record || null);
    } else {
      setAttendanceToday(null);
    }

    setMyLeaves(leaveRes?.success ? leaveRes.data || [] : []);
    setLeaveBalances(balanceRes?.success ? balanceRes.data || [] : []);
    setOnlineList(onlineRes?.success ? onlineRes.data || [] : []);
    setOnLeaveList(onLeaveRes?.success ? onLeaveRes.data || [] : []);
    setNotifications(notifRes?.success ? notifRes.data?.items || [] : []);

    if (holidayRes?.success) {
      const now = new Date();
      const upcoming = (holidayRes.data || [])
        .filter((h: any) => h?.date && new Date(h.date) >= new Date(now.getFullYear(), now.getMonth(), now.getDate()))
        .slice(0, 6);
      setUpcomingHolidays(upcoming);
    } else {
      setUpcomingHolidays([]);
    }

    setWeekOffDays(weekOffRes?.success ? weekOffRes.data?.weekOffDays || [] : []);
    setUpcomingEvents(
      eventsRes?.success
        ? {
            birthdays: eventsRes.data?.birthdays || [],
            anniversaries: eventsRes.data?.anniversaries || [],
          }
        : { birthdays: [], anniversaries: [] }
    );

    if (matrixRes?.success) {
      const row = matrixRes.data?.employees?.[0];
      setMatrixDays(row?.days || {});
      setDaysInMonth(Number(matrixRes.data?.daysInMonth || 31));
    } else {
      setMatrixDays({});
      setDaysInMonth(31);
    }

    setMyProfile(profileRes?.success ? profileRes.data || null : null);

    if (checkInPolicyRes?.success && checkInPolicyRes?.data) {
      const nextPolicy = {
        attendanceIpEnabled: Boolean(checkInPolicyRes.data.attendanceIpEnabled),
        attendanceSelfieRequired: Boolean(checkInPolicyRes.data.attendanceSelfieRequired),
        attendanceGeoFenceEnabled: Boolean(checkInPolicyRes.data.attendanceGeoFenceEnabled),
        attendanceGeoRadiusMeters: Number(checkInPolicyRes.data.attendanceGeoRadiusMeters || 200),
      };
      setCheckInPolicy(nextPolicy);
      if (nextPolicy.attendanceSelfieRequired || nextPolicy.attendanceGeoFenceEnabled) {
        setPolicyWarning('Check-in requires selfie or location permission.');
      } else {
        setPolicyWarning('');
      }
    }

    if (!silent) setLoading(false);
    if (silent) setRefreshing(false);
  };

  useEffect(() => {
    if (!token) return undefined;
    loadDashboard();
    const timer = setInterval(() => {
      loadDashboard(true);
    }, 30000);
    return () => clearInterval(timer);
  }, [weekStart, token]);

  const pendingLeaves = useMemo(
    () => (myLeaves || []).filter((l: any) => l?.status === 'pending').length,
    [myLeaves]
  );

  const pendingTimesheets = useMemo(() => (weeklyStatus === 'submitted' ? 1 : 0), [weeklyStatus]);

  const missingProfileFields = useMemo(() => {
    if (!myProfile) return [];
    const missing: string[] = [];
    if (!myProfile.phone) missing.push('Phone');
    if (!myProfile.dob) missing.push('Date of birth');
    if (!myProfile.gender) missing.push('Gender');
    if (!myProfile.address?.line1) missing.push('Address');
    if (!Array.isArray(myProfile.emergencyContacts) || myProfile.emergencyContacts?.length === 0) {
      missing.push('Emergency contact');
    }
    return missing;
  }, [myProfile]);

  const totalLeaveRemaining = useMemo(
    () => (leaveBalances || []).reduce((sum: number, b: any) => sum + Number(b?.remaining || 0), 0),
    [leaveBalances]
  );

  const weeklyProgress = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayKey = toDateInput(todayStart);
    const sundayStart = new Date(todayStart);
    sundayStart.setDate(todayStart.getDate() - todayStart.getDay());

    let todayLiveHours = 0;
    if (attendanceToday?.checkInAt) {
      const inAt = new Date(attendanceToday.checkInAt);
      const outAt = attendanceToday?.checkOutAt ? new Date(attendanceToday.checkOutAt) : now;
      todayLiveHours = Math.max(0, (outAt.getTime() - inAt.getTime()) / (1000 * 60 * 60));
    }

    const dayRows = Array.from({ length: 7 }, (_, idx) => {
      const dayDate = new Date(sundayStart);
      dayDate.setDate(sundayStart.getDate() + idx);
      dayDate.setHours(0, 0, 0, 0);
      const dayKey = toDateInput(dayDate);

      const dayName = dayNames[dayDate.getDay()];
      const entryForDay = (weeklyEntries || []).find((e: any) => {
        if (!e?.date) return false;
        return toDateInput(new Date(e.date)) === dayKey;
      });
      const timesheetHours = Number(entryForDay?.hours || 0);

      const matrixCell =
        dayDate.getMonth() === today.getMonth() && dayDate.getFullYear() === today.getFullYear()
          ? matrixDays[dayDate.getDate()]
          : null;

      let attendanceHours = 0;
      if (matrixCell?.checkInAt) {
        const inAt = new Date(matrixCell.checkInAt);
        const outAt = matrixCell?.checkOutAt ? new Date(matrixCell.checkOutAt) : now;
        attendanceHours = Math.max(0, (outAt.getTime() - inAt.getTime()) / (1000 * 60 * 60));
      }

      const completedHours =
        dayKey === todayKey
          ? Math.max(timesheetHours, attendanceHours, todayLiveHours)
          : Math.max(timesheetHours, attendanceHours);

      const entryNotes = entryForDay?.notes || entryForDay?.note || '';
      return {
        dayName,
        date: dayDate,
        timesheetHours,
        attendanceHours,
        completedHours,
        notes: entryNotes,
      };
    });

    const completedIncludingToday = dayRows
      .filter((d) => toDateInput(new Date(d.date)) <= todayKey)
      .reduce((sum, d) => sum + Number(d.completedHours || 0), 0);

    const todayTimesheetHours =
      dayRows.find((d) => toDateInput(new Date(d.date)) === todayKey)?.timesheetHours || 0;

    return {
      completedIncludingToday,
      todayTimesheetHours,
      todayLiveHours,
      dayRows,
    };
  }, [weeklyEntries, attendanceToday, matrixDays]);

  const weekEndDate = useMemo(() => {
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);
    return end;
  }, [weekStart]);
  const weeklyRangeLabel = `${toDateInput(weekStart)} - ${toDateInput(weekEndDate)}`;
  const weekStatusLabel =
    weeklyStatus && weeklyStatus.length > 0
      ? `${weeklyStatus[0].toUpperCase()}${weeklyStatus.slice(1)}`
      : 'Draft';
  const requiredWeeklyHours = 56;
  const timesheetDays = weeklyProgress.dayRows;
  const workedHoursText = `${weeklyHours.toFixed(2)} / ${requiredWeeklyHours}`;

  const hasCheckedInToday = Boolean(attendanceToday?.checkInAt);
  const isCheckedIn = hasCheckedInToday && !attendanceToday?.checkOutAt;

  const checkInTimeText = attendanceToday?.checkInAt ? formatTime(attendanceToday.checkInAt) : '-';
  const checkOutTimeText = attendanceToday?.checkOutAt
    ? formatTime(attendanceToday.checkOutAt)
    : '-';

  const lateFlag = useMemo(() => Number(attendanceToday?.lateByMinutes || 0) > 0, [attendanceToday]);

  type PermissionValue = typeof PermissionsAndroid.PERMISSIONS[keyof typeof PermissionsAndroid.PERMISSIONS];
  const requestAndroidPermission = async (permission: PermissionValue) => {
    const granted = await PermissionsAndroid.request(permission);
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  };

  const requestLocationPermission = async () => {
    if (Platform.OS !== 'android') return true;
    return requestAndroidPermission(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
  };

  const requestCameraPermission = async () => {
    if (Platform.OS !== 'android') return true;
    return requestAndroidPermission(PermissionsAndroid.PERMISSIONS.CAMERA);
  };

  const getCurrentLocation = async () =>
    new Promise<{ latitude: number; longitude: number }>((resolve, reject) => {
      Geolocation.getCurrentPosition(
        (position) =>
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          }),
        (error) => reject(error),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
      );
    });

  const captureSelfie = async () => {
    const ok = await requestCameraPermission();
    if (!ok) {
      setPolicyWarning('Camera permission is required for selfie check-in.');
      return null;
    }
    const result = await launchCamera({
      mediaType: 'photo',
      includeBase64: true,
      maxWidth: 720,
      maxHeight: 720,
      quality: 0.7,
      cameraType: 'front',
    });
    const asset = result.assets?.[0];
    if (!asset?.base64 || !asset?.type) return null;
    return `data:${asset.type};base64,${asset.base64}`;
  };

  const handleCheckIn = async () => {
    const payload: Record<string, unknown> = {};
    if (checkInPolicy.attendanceGeoFenceEnabled) {
      const ok = await requestLocationPermission();
      if (!ok) {
        setPolicyWarning('Location permission is required for check-in.');
        return;
      }
      try {
        const location = await getCurrentLocation();
        payload.latitude = location.latitude;
        payload.longitude = location.longitude;
      } catch {
        setPolicyWarning('Unable to get current location.');
        return;
      }
    }
    if (checkInPolicy.attendanceSelfieRequired) {
      const selfie = await captureSelfie();
      if (!selfie) {
        setPolicyWarning('Selfie capture cancelled.');
        return;
      }
      payload.selfieImage = selfie;
    }
    setCheckinLoading(true);
    const res = await postApiWithToken('/timesheets/check-in', payload, token);
    setCheckinLoading(false);
    if (res?.success) {
      loadDashboard();
      setPolicyWarning('');
    } else if (res?.message) {
      setPolicyWarning(res.message);
    }
  };

  const handleCheckOut = async () => {
    setCheckoutLoading(true);
    const res = await postApiWithToken('/timesheets/check-out', {}, token);
    setCheckoutLoading(false);
    if (res?.success) {
      loadDashboard();
    }
  };

  const employeeName = [myProfile?.firstName, myProfile?.lastName].filter(Boolean).join(' ');
  const organizationName = useMemo(() => {
    return (
      myProfile?.organization?.name ||
      myProfile?.activeOrganization?.name ||
      session?.loginData?.organization?.name ||
      session?.loginData?.activeOrganization?.name ||
      'Organization'
    );
  }, [myProfile, session?.loginData]);
  const profileInitials =
    (myProfile?.firstName?.[0] || '') + (myProfile?.lastName?.[0] || '');
  const avatarLabel =
    profileInitials.trim() || myProfile?.email?.[0]?.toUpperCase() || 'U';
  const profileImage = myProfile?.profileImage || myProfile?.profilePhoto || null;
  
  useEffect(() => {
    const nextTab = (route?.params?.initialTab || 'overview') as
      | 'overview'
      | 'attendance'
      | 'planning';
    setActiveTab(nextTab);
  }, [route?.params?.initialTab]);

  return (
    <LinearGradient
      colors={['#f3f5f9', '#f3f5f9', '#eef1f6']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <View style={styles.main}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: Math.max(safeAreaInsets.top, 16) },
          ]}
        >
          <View style={styles.shell}>
            <View style={styles.topBar}>
              <View style={styles.topBarLeft}>
                <Text style={styles.topBarTitle}>Dashboard</Text>
              </View>
              <View style={styles.topBarCenter}>
                <Text style={styles.topBarOrg} numberOfLines={1}>
                  {organizationName}
                </Text>
              </View>
              <View style={styles.topBarRight}>
                <Pressable
                  style={styles.iconButton}
                  onPress={() => navigation.navigate('Notifications')}
                >
                  <MaterialCommunityIcons name="bell-outline" size={18} color="#0f172a" />
                </Pressable>
                <Pressable
                  style={styles.avatar}
                  onPress={() => setProfileMenuOpen((current) => !current)}
                >
                  {profileImage ? (
                    <Image source={{ uri: profileImage }} style={styles.avatarImage} />
                  ) : (
                    <Text style={styles.avatarText}>{avatarLabel}</Text>
                  )}
                  <MaterialCommunityIcons
                    name="chevron-down"
                    size={14}
                    color="#0f172a"
                    style={styles.avatarChevron}
                  />
                </Pressable>
              </View>
            </View>
            <View style={styles.tabs}>
              <Pressable
                style={[styles.tab, activeTab === 'overview' && styles.tabActive]}
                onPress={() => setActiveTab('overview')}
              >
                <Text style={activeTab === 'overview' ? styles.tabTextActive : styles.tabText}>
                  Overview
                </Text>
              </Pressable>
              <Pressable
                style={[styles.tab, activeTab === 'attendance' && styles.tabActive]}
                onPress={() => setActiveTab('attendance')}
              >
                <Text style={activeTab === 'attendance' ? styles.tabTextActive : styles.tabText}>
                  Attendance
                </Text>
              </Pressable>
              <Pressable
                style={[styles.tab, activeTab === 'planning' && styles.tabActive]}
                onPress={() => setActiveTab('planning')}
              >
                <Text style={activeTab === 'planning' ? styles.tabTextActive : styles.tabText}>
                  Planning
                </Text>
              </Pressable>
            </View>

            {loading ? (
              <View style={styles.loadingCard}>
                <ActivityIndicator />
                <Text style={styles.loadingText}>Loading dashboard...</Text>
              </View>
            ) : (
              <>
                {activeTab === 'overview' && (
                  <>
                    {policyWarning ? (
                      <View style={styles.warningCard}>
                        <MaterialCommunityIcons name="alert-circle-outline" size={16} color="#b45309" />
                        <Text style={styles.warningText}>{policyWarning}</Text>
                      </View>
                    ) : null}

                    <View style={styles.card}>
                      <View style={styles.cardHeader}>
                        <Text style={styles.cardTitle}>Today Status</Text>
                        {lateFlag && (
                          <View style={styles.pillLate}>
                            <Text style={styles.pillLateText}>Late</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.bigStatus}>
                        {isCheckedIn ? 'Checked In' : hasCheckedInToday ? 'Checked Out' : 'Not Checked In'}
                      </Text>
                      <Text style={styles.cardSubText}>
                        Check-in: {checkInTimeText} • Check-out: {checkOutTimeText}
                      </Text>
                      <View style={styles.actionRow}>
                        <Pressable
                          style={[styles.primaryAction, isCheckedIn && styles.primaryDisabled]}
                          onPress={handleCheckIn}
                          disabled={checkinLoading || isCheckedIn}
                        >
                          {checkinLoading ? (
                            <ActivityIndicator color="#fff" />
                          ) : (
                            <MaterialCommunityIcons name="login" size={16} color="#fff" />
                          )}
                          <Text style={styles.primaryActionText}>Check In</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.secondaryAction, !isCheckedIn && styles.secondaryDisabled]}
                          onPress={handleCheckOut}
                          disabled={checkoutLoading || !isCheckedIn}
                        >
                          {checkoutLoading ? (
                            <ActivityIndicator />
                          ) : (
                            <MaterialCommunityIcons name="logout" size={16} color="#0f172a" />
                          )}
                          <Text style={styles.secondaryActionText}>Check Out</Text>
                        </Pressable>
                      </View>
                      <View style={styles.actionRow}>
                        <Pressable
                          style={styles.secondaryAction}
                          onPress={() => navigation.navigate('Leaves')}
                        >
                          <Text style={styles.secondaryActionText}>Apply Leave</Text>
                        </Pressable>
                        <Pressable
                          style={styles.secondaryAction}
                          onPress={() => navigation.navigate('Timesheets')}
                        >
                          <Text style={styles.secondaryActionText}>Timesheet</Text>
                        </Pressable>
                      </View>
                    </View>

                    <View style={styles.statsGrid}>
                      <View style={styles.statCard}>
                        <Text style={styles.statLabel}>Leave Balance</Text>
                        <Text style={styles.statValue}>{totalLeaveRemaining.toFixed(1)}</Text>
                        <Text style={styles.cardSubText}>Total remaining</Text>
                      </View>
                      <View style={styles.statCard}>
                        <Text style={styles.statLabel}>Weekly Timesheet</Text>
                        <Text style={styles.statValue}>{weeklyProgress.completedIncludingToday.toFixed(1)}h</Text>
                        <Text style={styles.cardSubText}>
                          {weeklyStatus ? `Status: ${weeklyStatus}` : 'No weekly sheet'}
                        </Text>
                      </View>
                      <View style={styles.statCard}>
                        <Text style={styles.statLabel}>Team</Text>
                        <Text style={styles.statValue}>{onlineList.length}</Text>
                        <Text style={styles.cardSubText}>Online now</Text>
                      </View>
                      <View style={styles.statCard}>
                        <Text style={styles.statLabel}>Pending Requests</Text>
                        <Text style={styles.statValue}>{pendingLeaves + pendingTimesheets}</Text>
                        <Text style={styles.cardSubText}>
                          Leaves: {pendingLeaves} • Timesheet: {pendingTimesheets}
                        </Text>
                      </View>
                    </View>
                  </>
                )}

                {activeTab === 'overview' && (
                  <>
                    <View style={styles.card}>
                      <View style={styles.cardHeader}>
                        <Text style={styles.cardTitle}>On Leave Today</Text>
                        <MaterialCommunityIcons name="chevron-down" size={18} color="#64748b" />
                      </View>
                      <View style={styles.leaveTableHeader}>
                        <Text style={styles.leaveTableHeading}>Employee</Text>
                        <Text style={styles.leaveTableHeading}>Leave Type</Text>
                        <Text style={styles.leaveTableHeading}>From</Text>
                        <Text style={styles.leaveTableHeading}>To</Text>
                      </View>
                      {onLeaveList.length === 0 ? (
                        <Text style={styles.cardSubText}>No one is on leave today.</Text>
                      ) : (
                        onLeaveList.map((leave: any) => {
                          const employeeName =
                            [
                              leave?.employee?.firstName,
                              leave?.employee?.lastName,
                            ].filter(Boolean).join(' ') ||
                            leave?.employeeName ||
                            'Employee';
                          return (
                            <View key={leave?._id || `${leave?.employeeId}-${leave?.from}`} style={styles.leaveTableRow}>
                              <Text style={styles.leaveTableValue}>{employeeName}</Text>
                              <Text style={styles.leaveTableValue}>{leave?.leaveType || 'Leave'}</Text>
                              <Text style={styles.leaveTableValue}>
                                {leave?.from || leave?.startDate ? toDateInput(new Date(leave?.from || leave?.startDate)) : '-'}
                              </Text>
                              <Text style={styles.leaveTableValue}>
                                {leave?.to || leave?.endDate ? toDateInput(new Date(leave?.to || leave?.endDate)) : '-'}
                              </Text>
                            </View>
                          );
                        })
                      )}
                    </View>

                    <View style={[styles.card, styles.timesheetCard]}>
                      <View style={styles.timesheetCardHeader}>
                        <Text style={styles.cardTitle}>Weekly Timesheet</Text>
                        <View style={styles.timesheetNav}>
                          <Pressable style={styles.timesheetNavButton} disabled>
                            <MaterialCommunityIcons name="chevron-left" size={16} color="#64748b" />
                          </Pressable>
                          <Pressable style={styles.timesheetNavButton} disabled>
                            <MaterialCommunityIcons name="chevron-right" size={16} color="#64748b" />
                          </Pressable>
                        </View>
                      </View>
                      <View style={styles.timesheetWorkedRow}>
                        <Text style={styles.timesheetWorkedLabel}>Worked hours:</Text>
                        <View style={styles.timesheetWorkedBadge}>
                          <Text style={styles.timesheetWorkedValue}>{workedHoursText}</Text>
                        </View>
                      </View>
                      <Text style={styles.timesheetRangeText}>{weeklyRangeLabel}</Text>
                      <View style={styles.timesheetStatusPill}>
                        <Text style={styles.timesheetStatusText}>{weekStatusLabel}</Text>
                      </View>
                      <View style={styles.timesheetTableHeader}>
                        <View style={styles.timesheetTableField}>
                          <Text style={styles.timesheetTableHeaderText}>Field</Text>
                        </View>
                        {timesheetDays.map((day) => (
                          <View key={`header-${toDateInput(day.date)}`} style={styles.timesheetTableDayCell}>
                            <Text style={styles.timesheetDayLabel}>{day.dayName}</Text>
                            <Text style={styles.timesheetDayDate}>
                              {formatDate(day.date)}
                            </Text>
                          </View>
                        ))}
                      </View>
                      <View style={styles.timesheetTableRow}>
                        <View style={styles.timesheetTableField}>
                          <Text style={styles.timesheetFieldLabel}>Hours</Text>
                        </View>
                        {timesheetDays.map((day) => (
                          <View key={`hours-${toDateInput(day.date)}`} style={styles.timesheetTableCell}>
                            <Text style={styles.timesheetCellValue}>
                              {Number(day.timesheetHours || 0).toFixed(2)}
                            </Text>
                          </View>
                        ))}
                      </View>
                      <View style={styles.timesheetTableRow}>
                        <View style={styles.timesheetTableField}>
                          <Text style={styles.timesheetFieldLabel}>Notes</Text>
                        </View>
                        {timesheetDays.map((day) => (
                          <View key={`notes-${toDateInput(day.date)}`} style={styles.timesheetTableCell}>
                            <Text style={styles.timesheetCellNote}>
                              {day.notes || '-'}
                            </Text>
                          </View>
                        ))}
                      </View>
                      <Text style={styles.timesheetFooterText}>
                        Full day: 8h • Half day: 4h • Minimum weekly hours: {requiredWeeklyHours}h
                      </Text>
                      <View style={styles.timesheetActions}>
                        <Pressable
                          style={styles.timesheetButtonOutline}
                          onPress={() => navigation.navigate('Timesheets')}
                        >
                          <Text style={styles.timesheetButtonOutlineText}>Save Draft</Text>
                        </Pressable>
                        <Pressable
                          style={styles.timesheetButtonPrimary}
                          onPress={() => navigation.navigate('Timesheets')}
                        >
                          <Text style={styles.timesheetButtonPrimaryText}>Submit Timesheet</Text>
                        </Pressable>
                      </View>
                    </View>

                    <View style={styles.card}>
                      <View style={styles.cardHeader}>
                        <Text style={styles.cardTitle}>Latest Notifications</Text>
                        <MaterialCommunityIcons name="bell-outline" size={18} color="#64748b" />
                      </View>
                      {notifications.length === 0 ? (
                        <Text style={styles.cardSubText}>No notifications</Text>
                      ) : (
                        notifications.map((n: any) => (
                          <View key={n?._id || Math.random()} style={styles.noticeCard}>
                            <Text style={styles.noticeTitle}>{n?.title || ''}</Text>
                            <Text style={styles.noticeText}>{n?.message || ''}</Text>
                          </View>
                        ))
                      )}
                    </View>

                    <View style={styles.card}>
                      <View style={styles.cardHeader}>
                        <Text style={styles.cardTitle}>Team Snapshot</Text>
                        <View style={styles.pill}>
                          <Text style={styles.pillText}>Today</Text>
                        </View>
                      </View>
                      <View style={styles.snapshotRow}>
                        <Text style={styles.snapshotLabel}>Online now:</Text>
                        <Text style={styles.snapshotValue}>{onlineList.length}</Text>
                      </View>
                      <View style={styles.snapshotRow}>
                        <Text style={styles.snapshotLabel}>On leave today:</Text>
                        <Text style={styles.snapshotValue}>{onLeaveList.length}</Text>
                      </View>
                    </View>

                    <View style={styles.card}>
                      <View style={styles.cardHeader}>
                        <Text style={styles.cardTitle}>Next 7 Days Events</Text>
                        <MaterialCommunityIcons name="calendar-month-outline" size={18} color="#64748b" />
                      </View>
                      <Text style={styles.sectionTitle}>Birthdays</Text>
                      {(upcomingEvents.birthdays || []).length === 0 && (
                        <Text style={styles.cardSubText}>No upcoming birthdays</Text>
                      )}
                      {(upcomingEvents.birthdays || []).slice(0, 4).map((e: any) => (
                        <View key={`b-${e?.employeeId || Math.random()}-${e?.eventDate || ''}`} style={styles.eventRow}>
                          <Text style={styles.eventName}>{e?.name || ''}</Text>
                          <Text style={styles.eventMeta}>
                            {e?.eventDate ? formatDate(e.eventDate) : ''} ({e?.daysAway === 0 ? 'Today' : `${e?.daysAway || 0}d`})
                          </Text>
                        </View>
                      ))}
                      <Text style={styles.sectionTitle}>Anniversaries</Text>
                      {(upcomingEvents.anniversaries || []).length === 0 && (
                        <Text style={styles.cardSubText}>No upcoming anniversaries</Text>
                      )}
                      {(upcomingEvents.anniversaries || []).slice(0, 4).map((e: any) => (
                        <View key={`a-${e?.employeeId || Math.random()}-${e?.eventDate || ''}`} style={styles.eventRow}>
                          <Text style={styles.eventName}>{e?.name || ''}</Text>
                          <Text style={styles.eventMeta}>
                            {e?.eventDate ? formatDate(e.eventDate) : ''} ({e?.years || 0}y)
                          </Text>
                        </View>
                      ))}
                    </View>
                  </>
                )}

                {activeTab === 'attendance' && (
                  <AttendanceTab
                    matrixDays={matrixDays}
                    daysInMonth={daysInMonth}
                    onRefresh={() => loadDashboard()}
                    referenceDate={today}
                    dayNames={dayNames}
                    formatTime={formatTime}
                    employeeName={employeeName || 'Employee'}
                  />
                )}
                
                {activeTab === 'planning' && (
                  <>
                    <View style={styles.card}>
                      <Text style={styles.cardTitle}>Leave Balances</Text>
                      {leaveBalances.length === 0 && (
                        <Text style={styles.cardSubText}>No balances found</Text>
                      )}
                      {leaveBalances.map((b: any) => (
                        <View key={b?.leaveTypeId || Math.random()} style={styles.noticeCard}>
                          <View style={styles.leaveRow}>
                            <Text style={styles.noticeTitle}>{b?.leaveType || ''}</Text>
                            <Text style={styles.noticeText}>
                              {Number(b?.remaining || 0).toFixed(1)}/{Number(b?.total || 0).toFixed(1)}
                            </Text>
                          </View>
                          <Text style={styles.cardSubText}>
                            Used: {Number(b?.used || 0).toFixed(1)} | Pending:{' '}
                            {Number(b?.pending || 0).toFixed(1)}
                          </Text>
                        </View>
                      ))}
                    </View>

                    <View style={styles.card}>
                      <Text style={styles.cardTitle}>Upcoming Holidays</Text>
                      {upcomingHolidays.length === 0 && (
                        <Text style={styles.cardSubText}>No upcoming holidays</Text>
                      )}
                      {upcomingHolidays.map((h: any) => (
                        <View key={h?._id || Math.random()} style={styles.eventRow}>
                          <Text style={styles.eventName}>{h?.name || ''}</Text>
                          <Text style={styles.eventMeta}>{h?.date ? formatDate(h.date) : ''}</Text>
                        </View>
                      ))}
                      <Text style={styles.sectionTitle}>Week Off Days</Text>
                      <View style={styles.weekOffRow}>
                        {weekOffDays.length === 0 ? (
                          <Text style={styles.cardSubText}>Not configured</Text>
                        ) : (
                          weekOffDays.map((d) => (
                            <View key={d} style={styles.weekOffPill}>
                              <Text style={styles.weekOffText}>{dayNames[d]}</Text>
                            </View>
                          ))
                        )}
                      </View>
                    </View>
                  </>
                )}

              </>
            )}

            {refreshing && (
              <View style={styles.refreshBar}>
                <ActivityIndicator size="small" />
                <Text style={styles.refreshText}>Refreshing</Text>
              </View>
            )}
          </View>
        </ScrollView>

        {profileMenuOpen && (
          <>
            <Pressable
              style={styles.profileBackdrop}
              onPress={() => setProfileMenuOpen(false)}
            />
            <View style={styles.profileMenu}>
              <Text style={styles.profileMenuHeader}>My Account</Text>
              <View style={styles.profileMenuDivider} />
              <Pressable
                style={styles.profileMenuItem}
                onPress={() => {
                  setProfileMenuOpen(false);
                  navigation.navigate('Profile');
                }}
              >
                <Text style={styles.profileMenuText}>Profile</Text>
              </Pressable>
              <Pressable
                style={styles.profileMenuItem}
                onPress={() => {
                  setProfileMenuOpen(false);
                  navigation.navigate('ChangePassword');
                }}
              >
                <Text style={styles.profileMenuText}>Change Password</Text>
              </Pressable>
              <Pressable
                style={styles.profileMenuItem}
                onPress={() => {
                  setProfileMenuOpen(false);
                  navigation.navigate('RoleSwitch');
                }}
              >
                <Text style={styles.profileMenuText}>Switch role</Text>
                <MaterialCommunityIcons name="chevron-right" size={16} color="#64748b" />
              </Pressable>
              <View style={styles.profileMenuDivider} />
              <Pressable
                style={styles.profileMenuItem}
                onPress={() => {
                  setProfileMenuOpen(false);
                  logout();
                }}
              >
                <Text style={styles.profileMenuLogout}>Log out</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  main: {
    flex: 1,
    minWidth: 0,
  },
  calendarCellPressable: {
    minHeight: 64,
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  calendarShortLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  legendCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  legendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
    minWidth: 100,
  },
  legendDot: {
    fontSize: 12,
    fontWeight: 'bold',
    width: 16,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  // Web color matches (Tailwind equivalents)
  calendarPresent: {
    backgroundColor: '#d1fae5', // emerald-100
    borderColor: '#10b981', // emerald-500
  },
  calendarPending: {
    backgroundColor: '#fed7aa', // orange-100
    borderColor: '#f59e0b', // orange-500
  },
  calendarAbsent: {
    backgroundColor: '#fee2e2', // rose-100
    borderColor: '#ef4444', // rose-500
  },
  calendarLeave: {
    backgroundColor: '#e0e7ff', // violet-100 -> indigo-100
    borderColor: '#8b5cf6', // violet-500
  },
  calendarWeekOff: {
    backgroundColor: '#e0f2fe', // sky-100
    borderColor: '#0ea5e9', // sky-500
  },
  calendarHoliday: {
    backgroundColor: '#fef3c7', // amber-100
    borderColor: '#f59e0b', // amber-500
  },
  calendarNeutral: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 120,
  },
  shell: {
    gap: 14,
  },
  dashboardHeader: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
  },
  dashboardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  organizationLabel: {
    marginTop: 4,
    fontSize: 11,
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  topBarCenter: {
    flex: 1,
    alignItems: 'center',
  },
  topBarOrg: {
    maxWidth: 220,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  topBarTitle: {
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  avatar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  avatarImage: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  avatarChevron: {
    marginLeft: 2,
  },
  profileBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    zIndex: 55,
  },
  profileMenu: {
    position: 'absolute',
    top: 72,
    right: 16,
    width: 200,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
    zIndex: 60,
  },
  profileMenuHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
  },
  profileMenuDivider: {
    height: 1,
    backgroundColor: '#e2e8f0',
  },
  profileMenuItem: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  profileMenuText: {
    fontSize: 12,
    color: '#0f172a',
    fontWeight: '600',
  },
  profileMenuLogout: {
    fontSize: 12,
    color: '#dc2626',
    fontWeight: '700',
  },
  tabs: {
    flexDirection: 'row',
    gap: 10,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#f1f5ff',
    borderColor: '#c7d2fe',
  },
  tabText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  tabTextActive: {
    fontSize: 12,
    color: '#1d4ed8',
    fontWeight: '700',
  },
  loadingCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  loadingText: {
    color: '#64748b',
    fontSize: 12,
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#fcd34d',
  },
  warningText: {
    flex: 1,
    fontSize: 11,
    color: '#92400e',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  cardSubText: {
    marginTop: 6,
    fontSize: 12,
    color: '#64748b',
  },
  bigStatus: {
    marginTop: 6,
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  pillLate: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#fee2e2',
  },
  pillLateText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#dc2626',
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  pillText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  primaryAction: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#5b7cfa',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  primaryDisabled: {
    opacity: 0.6,
  },
  primaryActionText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  secondaryAction: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  secondaryDisabled: {
    opacity: 0.5,
  },
  secondaryActionText: {
    color: '#0f172a',
    fontWeight: '600',
    fontSize: 12,
  },
  statsGrid: {
    gap: 10,
  },
  statCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  statValue: {
    marginTop: 6,
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  noticeCard: {
    marginTop: 12,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
  },
  noticeTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  noticeText: {
    marginTop: 4,
    fontSize: 11,
    color: '#64748b',
  },
  linkText: {
    marginTop: 6,
    fontSize: 12,
    color: '#2563eb',
    fontWeight: '600',
  },
  snapshotRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
  },
  snapshotLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  snapshotValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  sectionTitle: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  eventRow: {
    marginTop: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  eventName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0f172a',
  },
  eventMeta: {
    marginTop: 4,
    fontSize: 11,
    color: '#64748b',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10,
  },
  summaryItem: {
    width: '48%',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  summaryLabel: {
    fontSize: 11,
    color: '#64748b',
  },
  summaryValue: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  leaveTableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 6,
  },
  leaveTableHeading: {
    flex: 1,
    fontSize: 10,
    fontWeight: '600',
    color: '#94a3b8',
  },
  leaveTableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  leaveTableValue: {
    flex: 1,
    fontSize: 12,
    color: '#0f172a',
  },
  timesheetCard: {
    marginTop: 12,
  },
  timesheetCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timesheetNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timesheetNavButton: {
    padding: 6,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  timesheetWorkedRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timesheetWorkedLabel: {
    fontSize: 11,
    color: '#64748b',
  },
  timesheetWorkedBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#e0f2fe',
  },
  timesheetWorkedValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  timesheetRangeText: {
    marginTop: 4,
    fontSize: 11,
    color: '#475569',
  },
  timesheetStatusPill: {
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#c7d2fe',
    backgroundColor: '#eef2ff',
  },
  timesheetStatusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  timesheetTableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  timesheetTableField: {
    width: '15%',
    justifyContent: 'center',
  },
  timesheetTableHeaderText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  timesheetTableDayCell: {
    width: '11%',
    alignItems: 'center',
  },
  timesheetDayLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#0f172a',
  },
  timesheetDayDate: {
    fontSize: 10,
    color: '#64748b',
  },
  timesheetTableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    alignItems: 'center',
  },
  timesheetFieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  timesheetTableCell: {
    width: '11%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timesheetCellValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  timesheetCellNote: {
    fontSize: 9,
    color: '#475569',
    textAlign: 'center',
  },
  timesheetFooterText: {
    marginTop: 10,
    fontSize: 10,
    color: '#94a3b8',
  },
  timesheetActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  timesheetButtonOutline: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  timesheetButtonOutlineText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0f172a',
  },
  timesheetButtonPrimary: {
    flex: 1,
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  timesheetButtonPrimaryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  attendanceTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  attendanceTip: {
    marginTop: 6,
    fontSize: 12,
    color: '#475569',
  },
  attendanceCalendarCard: {
    marginTop: 12,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  attendanceCalendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  attendanceCalendarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  attendanceCalendarIntro: {
    flex: 1,
  },
  monthChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#eef2ff',
  },
  monthChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0f172a',
  },
  refreshChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#c7d2fe',
    backgroundColor: '#ffffff',
  },
  refreshChipText: {
    fontSize: 12,
    color: '#1d4ed8',
    fontWeight: '700',
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  weekDayLabel: {
    fontSize: 10,
    color: '#94a3b8',
    width: '14%',
    textAlign: 'center',
    fontWeight: '600',
  },
  attendanceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 6,
    marginTop: 10,
  },
  attendanceCellBase: {
    width: '13.6%',
    minHeight: 96,
    borderRadius: 14,
    padding: 6,
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  attendanceCellPlaceholder: {
    width: '13.6%',
    minHeight: 96,
    marginBottom: 6,
  },
  attendanceCellDay: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  attendanceCellStatus: {
    fontSize: 9,
    fontWeight: '600',
    color: '#0f172a',
    marginTop: 4,
  },
  attendanceCellDetail: {
    fontSize: 9,
    color: '#0f172a',
    marginTop: 2,
    lineHeight: 12,
  },
  calendarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  calendarDayName: {
    width: '13%',
    textAlign: 'center',
    fontSize: 10,
    color: '#64748b',
  },
  leaveRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  weekOffRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  weekOffPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  weekOffText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  refreshBar: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  refreshText: {
    fontSize: 11,
    color: '#64748b',
  },
});

export default EmployeeDashboardScreen;
