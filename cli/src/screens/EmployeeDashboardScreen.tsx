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
import { useRef } from 'react';
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
import { useResetScrollOnFocus } from '../utils/useResetScrollOnFocus';

const pressedStyle = {
  transform: [{ scale: 0.96 }],
  shadowOffset: { width: 2, height: 2 },
  shadowOpacity: 0.2,
};

type CheckInPolicy = {
  attendanceIpEnabled: boolean;
  attendanceSelfieRequired: boolean;
  attendanceGeoFenceEnabled: boolean;
  attendanceGeoRadiusMeters: number;
};

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HEADER_TITLE_FONT = Platform.select({
  android: 'sans-serif-medium',
  ios: 'System',
  default: 'sans-serif',
});
const HEADER_META_FONT = Platform.select({
  android: 'sans-serif-medium',
  ios: 'System',
  default: 'sans-serif',
});

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

const getOrganizationName = (...sources: any[]) => {
  for (const source of sources) {
    const candidates = [
      source?.organization?.name,
      source?.activeOrganization?.name,
      source?.organizationId?.name,
      source?.activeOrganizationId?.name,
      source?.organizationName,
      source?.activeOrganizationName,
      source?.organizationId?.displayName,
      source?.organizationId?.legalName,
      source?.activeOrganizationId?.displayName,
      source?.activeOrganizationId?.legalName,
      source?.organization?.displayName,
      source?.organization?.legalName,
      source?.activeOrganization?.displayName,
      source?.activeOrganization?.legalName,
      source?.organizationDisplayName,
      source?.organizationLegalName,
      source?.company?.name,
      source?.org?.name,
      source?.tenant?.name,
      source?.companyDisplayName,
      source?.companyLegalName,
      source?.companyName,
      source?.company?.displayName,
      source?.company?.legalName,
      source?.orgDisplayName,
      source?.orgLegalName,
      source?.orgName,
      source?.org?.displayName,
      source?.org?.legalName,
      source?.tenant?.displayName,
      source?.tenant?.legalName,
    ];

    for (const value of candidates) {
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
  }

  return 'Organization';
};

const getOrganizationId = (...sources: any[]) => {
  for (const source of sources) {
    const value =
      source?.organization?._id ||
      source?.activeOrganization?._id ||
      source?.organizationId?._id ||
      source?.activeOrganizationId?._id ||
      source?.organizationId ||
      source?.activeOrganizationId ||
      source?.companyId ||
      source?.orgId ||
      source?.tenantId;

    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
};

const today = new Date();
const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
const currentYear = today.getFullYear();

function EmployeeDashboardScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const scrollViewRef = useRef<ScrollView | null>(null);
  const {
    session,
    logout,
    loginSuccessMessage,
    clearLoginSuccessMessage,
    setLogoutSuccessMessage,
  } = useAuth();
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
  const [organizationProfile, setOrganizationProfile] = useState<any>(null);
  const [checkInPolicy, setCheckInPolicy] = useState<CheckInPolicy>({
    attendanceIpEnabled: false,
    attendanceSelfieRequired: false,
    attendanceGeoFenceEnabled: false,
    attendanceGeoRadiusMeters: 200,
  });
  const [policyWarning, setPolicyWarning] = useState('');
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [showLoginToast, setShowLoginToast] = useState(false);

  const weekStart = useMemo(() => getWeekStart(new Date()), []);
  useResetScrollOnFocus(scrollViewRef);
  
  const loadDashboard = async (silent = false) => {
    if (!silent) setLoading(true);
    if (silent) setRefreshing(true);
    try {
      const todayIso = toDateInput(new Date());
      const weekStartIso = toDateInput(weekStart);
      const organizationId = getOrganizationId(profile, session?.loginData, myProfile);

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
        organizationRes,
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
        organizationId ? getApiWithToken<any>(`/organizations/${organizationId}`, token) : Promise.resolve(null),
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

    const nextProfile = profileRes?.success ? profileRes.data || null : null;
    setMyProfile(nextProfile);
    let nextOrganizationProfile = organizationRes?.success ? organizationRes.data || null : null;
    if (!nextOrganizationProfile) {
      const nextOrganizationId = getOrganizationId(nextProfile);
      if (nextOrganizationId) {
        const fallbackOrganizationRes = await getApiWithToken<any>(`/organizations/${nextOrganizationId}`, token);
        nextOrganizationProfile = fallbackOrganizationRes?.success ? fallbackOrganizationRes.data || null : null;
      }
    }
    setOrganizationProfile(nextOrganizationProfile);

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

    } catch (error) {
      console.warn('Dashboard load failed', error);
      setPolicyWarning('Unable to load dashboard data. Pull to refresh.');
    } finally {
      if (!silent) setLoading(false);
      if (silent) setRefreshing(false);
    }
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
  const shiftStartText = attendanceToday?.shiftStartTime || myProfile?.shiftId?.startTime || null;
  const shiftEndText = attendanceToday?.shiftEndTime || myProfile?.shiftId?.endTime || null;
  const shiftNameText =
    attendanceToday?.shiftName ||
    myProfile?.shiftId?.name ||
    myProfile?.shiftId?.code ||
    'General Shift';
  const shiftTimeText =
    shiftStartText && shiftEndText ? `${shiftStartText} - ${shiftEndText}` : 'Not assigned';

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
  const organizationName = useMemo(
    () =>
      getOrganizationName(
        organizationProfile,
        myProfile?.organizationId,
        myProfile?.activeOrganizationId,
        myProfile,
        session?.loginData?.organizationId,
        session?.loginData?.activeOrganizationId,
        session?.loginData,
        profile
      ),
    [organizationProfile, myProfile, session?.loginData, profile]
  );
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

  useEffect(() => {
    if (!loginSuccessMessage) return;

    setShowLoginToast(true);
    const timer = setTimeout(() => {
      setShowLoginToast(false);
      clearLoginSuccessMessage();
    }, 2600);

    return () => clearTimeout(timer);
  }, [loginSuccessMessage, clearLoginSuccessMessage]);

  return (
    <LinearGradient
      colors={['#f3f5f9', '#f3f5f9', '#eef1f6']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <View style={styles.main}>
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: Math.max(safeAreaInsets.top, 16) },
          ]}
        >
          <View style={styles.shell}>
            <View style={styles.topBar}>
              <View style={styles.topBarLeft}>
                <Text
                  style={styles.topBarTitle}
                  numberOfLines={1}
                  ellipsizeMode="clip"
                  adjustsFontSizeToFit
                  minimumFontScale={0.82}
                >
                  Dashboard
                </Text>
              </View>
              <View style={styles.topBarCenter}>
                <View style={styles.topBarOrg}>
                  <Text
                    style={styles.topBarOrgText}
                    numberOfLines={2}
                    ellipsizeMode="tail"
                    adjustsFontSizeToFit
                    minimumFontScale={0.72}
                  >
                    {organizationName}
                  </Text>
                </View>
              </View>
              <View style={styles.topBarRight}>
                <Pressable
                  style={({ pressed }) => [styles.iconButton, pressed && styles.surfacePressed]}
                  onPress={() => {
                    setProfileMenuOpen(false);
                    const parentNavigation = navigation.getParent?.();
                    if (parentNavigation?.push) {
                      parentNavigation.push('Notifications');
                      return;
                    }
                    if (navigation.push) {
                      navigation.push('Notifications');
                      return;
                    }
                    navigation.navigate('Notifications');
                  }}
                >
                  <MaterialCommunityIcons name="bell-outline" size={18} color="#0f172a" />
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.avatar, pressed && styles.surfacePressed]}
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
                      <Text style={styles.cardSubText}>
                        Shift: {shiftNameText} ({shiftTimeText})
                      </Text>
                      <View style={styles.actionRow}>
                        <Pressable
                          style={({ pressed }) => [
                            styles.primaryAction,
                            isCheckedIn && styles.primaryActionInactive,
                            pressed && styles.surfacePressed,
                            isCheckedIn && styles.primaryDisabled,
                          ]}
                          onPress={handleCheckIn}
                          disabled={checkinLoading || isCheckedIn}
                        >
                          <LinearGradient
                            colors={isCheckedIn ? ['#ffffff', '#f7f9fd'] : ['#5a7bea', '#456bde', '#3559cc']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 0, y: 1 }}
                            style={styles.primaryActionInner}
                          >
                            {checkinLoading ? (
                              <ActivityIndicator color={isCheckedIn ? '#94a3b8' : '#fff'} />
                            ) : (
                              <MaterialCommunityIcons
                                name="login"
                                size={16}
                                color={isCheckedIn ? '#94a3b8' : '#fff'}
                              />
                            )}
                            <Text style={[styles.primaryActionText, isCheckedIn && styles.primaryActionTextInactive]}>Check In</Text>
                          </LinearGradient>
                        </Pressable>
                        <Pressable
                          style={({ pressed }) => [
                            styles.secondaryAction,
                            isCheckedIn && styles.secondaryActionActive,
                            pressed && styles.surfacePressed,
                            !isCheckedIn && styles.secondaryDisabled,
                          ]}
                          onPress={handleCheckOut}
                          disabled={checkoutLoading || !isCheckedIn}
                        >
                          <LinearGradient
                            colors={isCheckedIn ? ['#5a7bea', '#456bde', '#3559cc'] : ['#ffffff', '#f7f9fd']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 0, y: 1 }}
                            style={styles.secondaryActionInner}
                          >
                            {checkoutLoading ? (
                              <ActivityIndicator color={isCheckedIn ? '#fff' : '#64748b'} />
                            ) : (
                              <MaterialCommunityIcons
                                name="logout"
                                size={16}
                                color={isCheckedIn ? '#fff' : '#0f172a'}
                              />
                            )}
                            <Text style={[styles.secondaryActionText, isCheckedIn && styles.secondaryActionTextActive]}>Check Out</Text>
                          </LinearGradient>
                        </Pressable>
                      </View>
                      <View style={styles.actionRow}>
                        <Pressable
                          style={({ pressed }) => [styles.secondaryAction, pressed && styles.surfacePressed]}
                          onPress={() => navigation.navigate('Leaves', { openApplyModal: true })}
                        >
                          <LinearGradient
                            colors={['#ffffff', '#f7f9fd']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 0, y: 1 }}
                            style={styles.secondaryActionInner}
                          >
                            <Text style={styles.secondaryActionText}>Apply Leave</Text>
                          </LinearGradient>
                        </Pressable>
                        <Pressable
                          style={({ pressed }) => [styles.secondaryAction, pressed && styles.surfacePressed]}
                          onPress={() => navigation.navigate('Timesheets')}
                        >
                          <LinearGradient
                            colors={['#ffffff', '#f7f9fd']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 0, y: 1 }}
                            style={styles.secondaryActionInner}
                          >
                            <Text style={styles.secondaryActionText}>Timesheet</Text>
                          </LinearGradient>
                        </Pressable>
                      </View>
                    </View>

                    <View style={styles.statsGrid}>
                      <View style={styles.statCard}>
                        <Text style={styles.statLabel}>Leave Balance</Text>
                        <Text style={[styles.statValue, styles.statValueBlue]}>{totalLeaveRemaining.toFixed(1)}</Text>
                        <Text style={styles.cardSubText}>Total remaining</Text>
                      </View>
                      <View style={styles.statCard}>
                        <Text style={styles.statLabel}>Team</Text>
                        <Text style={[styles.statValue, styles.statValueGreen]}>{onlineList.length}</Text>
                        <Text style={styles.cardSubText}>Online now</Text>
                      </View>
                      <View style={styles.statCard}>
                        <Text style={styles.statLabel}>Pending Requests</Text>
                        <Text style={[styles.statValue, styles.statValueAmber]}>{pendingLeaves + pendingTimesheets}</Text>
                        <View style={styles.pendingRequestMeta}>
                          <View style={styles.pendingRequestMetaItem}>
                            <Text style={styles.pendingRequestMetaLabel}>Leaves : </Text>
                            <Text style={styles.pendingRequestMetaValue}>{pendingLeaves}</Text>
                          </View>
                          <View style={styles.pendingRequestMetaItem}>
                            <Text style={styles.pendingRequestMetaLabel}>Timesheets : </Text>
                            <Text style={styles.pendingRequestMetaValue}>{pendingTimesheets}</Text>
                          </View>
                        </View>
                      </View>
                      <View style={styles.statCard}>
                        <Text style={styles.statLabel}>On Leave Today</Text>
                        <Text style={[styles.statValue, styles.statValueRed]}>{onLeaveList.length}</Text>
                        <Text style={styles.cardSubText}>Employees</Text>
                      </View>
                    </View>
                  </>
                )}

                {activeTab === 'overview' && (
                  <>
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
              <View style={styles.profileMenuDivider} />
              <Pressable
                style={styles.profileMenuItem}
                onPress={() => {
                  setProfileMenuOpen(false);
                  setLogoutSuccessMessage('Logout successful. See you again soon.');
                  logout();
                }}
              >
                <Text style={styles.profileMenuLogout}>Log out</Text>
              </Pressable>
            </View>
          </>
        )}

        {showLoginToast && loginSuccessMessage ? (
          <View pointerEvents="none" style={styles.loginToastWrap}>
            <View style={styles.loginToast}>
              <MaterialCommunityIcons name="check-circle" size={16} color="#22c55e" />
              <Text style={styles.loginToastText}>{loginSuccessMessage}</Text>
            </View>
          </View>
        ) : null}
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
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    shadowColor: '#c6d1e4',
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 4, height: 8 },
    elevation: 4,
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 88,
    flexShrink: 0,
  },
  topBarCenter: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  topBarOrg: {
    width: '100%',
    maxWidth: 224,
    minHeight: 34,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ffffff',
    shadowOpacity: 0.9,
    shadowRadius: 4,
    shadowOffset: { width: -2, height: -2 },
    elevation: 1,
  },
  topBarOrgText: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '600',
    fontFamily: HEADER_META_FONT,
    color: '#526071',
    textAlign: 'center',
    includeFontPadding: false,
  },
  topBarTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontFamily: HEADER_TITLE_FONT,
    fontWeight: '700',
    letterSpacing: 0.2,
    includeFontPadding: false,
    color: '#0f172a',
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  iconButton: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    shadowColor: '#d4ddec',
    shadowOpacity: 0.18,
    shadowRadius: 5,
    shadowOffset: { width: 2, height: 3 },
    elevation: 1,
  },
  avatar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 4,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    shadowColor: '#d4ddec',
    shadowOpacity: 0.18,
    shadowRadius: 5,
    shadowOffset: { width: 2, height: 3 },
    elevation: 1,
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  avatarImage: {
    width: 18,
    height: 18,
    borderRadius: 9,
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
    borderRadius: 14,
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
    shadowColor: '#c6d1e4',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 4, height: 7 },
    elevation: 3,
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
    shadowColor: '#dcc27d',
    shadowOpacity: 0.14,
    shadowRadius: 8,
    shadowOffset: { width: 2, height: 4 },
    elevation: 2,
  },
  warningText: {
    flex: 1,
    fontSize: 11,
    color: '#92400e',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    shadowColor: '#c6d1e4',
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 4, height: 8 },
    elevation: 4,
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
    color: '#6b7280',
  },
  bigStatus: {
    marginTop: 6,
    fontSize: 19,
    fontWeight: '700',
    color: '#0f172a',
  },
  pillLate: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#fee2e2',
    shadowColor: '#f0c4c4',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 1, height: 2 },
    elevation: 1,
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
    height: 42,
    borderRadius: 12,
    backgroundColor: '#456bde',
    shadowColor: '#2f58c7',
    shadowOpacity: 0.26,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  primaryDisabled: {
    opacity: 1,
  },
  primaryActionInactive: {
    backgroundColor: '#f3f6fb',
    shadowColor: '#d6deeb',
    shadowOpacity: 0.16,
    shadowRadius: 7,
    shadowOffset: { width: 2, height: 4 },
    elevation: 2,
  },
  primaryActionInner: {
    flex: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  primaryActionText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  primaryActionTextInactive: {
    color: '#94a3b8',
  },
  secondaryAction: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    shadowColor: '#d4ddec',
    shadowOpacity: 0.18,
    shadowRadius: 7,
    shadowOffset: { width: 2, height: 4 },
    elevation: 2,
  },
  secondaryActionActive: {
    backgroundColor: '#456bde',
    shadowColor: '#2f58c7',
    shadowOpacity: 0.26,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  secondaryDisabled: {
    opacity: 0.5,
  },
  secondaryActionInner: {
    flex: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  secondaryActionText: {
    color: '#0f172a',
    fontWeight: '600',
    fontSize: 12,
  },
  secondaryActionTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  statCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    minHeight: 116,
    width: '48%',
    marginBottom: 10,
    shadowColor: '#c6d1e4',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 4, height: 8 },
    elevation: 3,
  },
  surfacePressed: {
    ...pressedStyle,
  },
  statLabel: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '700',
  },
  statValue: {
    marginTop: 6,
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  statValueBlue: {
    color: '#3b63db',
  },
  statValueGreen: {
    color: '#16934f',
  },
  statValueAmber: {
    color: '#d48a00',
  },
  statValueRed: {
    color: '#d94b4b',
  },
  pendingRequestMeta: {
    marginTop: 8,
    gap: 6,
  },
  pendingRequestMetaItem: {
    minHeight: 30,
    paddingVertical: 4,
    paddingHorizontal: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 2,
  },
  pendingRequestMetaLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  pendingRequestMetaValue: {
    fontSize: 12,
    color: '#0f172a',
    fontWeight: '700',
  },
  noticeCard: {
    marginTop: 12,
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    padding: 12,
    shadowColor: '#d4ddec',
    shadowOpacity: 0.16,
    shadowRadius: 6,
    shadowOffset: { width: 2, height: 4 },
    elevation: 1,
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
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    shadowColor: '#d4ddec',
    shadowOpacity: 0.14,
    shadowRadius: 6,
    shadowOffset: { width: 2, height: 4 },
    elevation: 1,
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
  loginToastWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 90,
    alignItems: 'center',
    zIndex: 80,
  },
  loginToast: {
    minHeight: 44,
    maxWidth: 360,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#0f172a',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  loginToastText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#0f172a',
  },
});

export default EmployeeDashboardScreen;
