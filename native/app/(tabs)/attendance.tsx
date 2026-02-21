import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Link } from 'expo-router';
import { ScrollView, StyleSheet, View, ActivityIndicator } from 'react-native';
import { getApiWithToken, postApiWithToken, putApiWithToken } from "@/services/apiWrapper";
import { ThemedText } from '@/components/themed-text';
import { useState, useEffect, useMemo } from 'react';

interface AttendanceItem {
  name: string;
  status: 'Present' | 'Late' | 'Absent';
  time: string;
}

export default function AttendanceScreen() {

  const [attendance, setAttendance] = useState<AttendanceItem[]>([]);
  const [loading, setLoading] = useState(true);

  /* ================= FETCH ================= */

  const fetchAttendance = async () => {
    try {
      setLoading(true);

      const res = await getApiWithToken("/timesheets/attendance/matrix?month=${month}");

      if (res?.success) {
        // 🔹 map API to your UI format
        const formatted = (res.data?.employees || []).map((emp: any) => {
      const today = new Date().getDate();
      const cell = emp.days?.[today];

      return {
        name: `${emp.firstName} ${emp.lastName}`,
        status:
          cell?.status === "present"
            ? "Present"
            : cell?.status === "pending_checkout"
            ? "Late"
            : "Absent",
        checkInAt: cell?.checkInAt || null,
        checkOutAt: cell?.checkOutAt || null,
      };
    });

            setAttendance(formatted);
          }
        } catch (err) {
          console.log(err);
        } finally {
          setLoading(false);
        }
      };

  useEffect(() => {
    fetchAttendance();
  }, []);

  /* ================= BULK SUBMIT ================= */

  const submitAttendance = async (payload: any) => {
    try {
      await postApiWithToken(
        "/timesheets/attendance/matrix/bulk",
        payload
      );
      fetchAttendance();
    } catch (err) {
      console.log(err);
    }
  };

  /* ================= STATS ================= */

  const stats = useMemo(() => {
    return attendance.reduce(
      (acc, item) => {
        if (item.status === "Present") acc.present++;
        else if (item.status === "Late") acc.late++;
        else acc.absent++;
        return acc;
      },
      { present: 0, late: 0, absent: 0 }
    );
  }, [attendance]);

  /* ================= UI ================= */

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" />
        <ThemedText>Loading attendance...</ThemedText>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <ThemedText type="title">Attendance</ThemedText>
        <ThemedText style={styles.subtitle}>Today attendance overview</ThemedText>
      </View>

      <Link href="/attendance-modal" asChild>
        <View style={styles.addButton}>
          <MaterialIcons name="check-circle" size={22} color="#fff" />
          <ThemedText style={styles.addButtonText}>Mark Attendance</ThemedText>
        </View>
      </Link>

      {/* ================= STATS ================= */}

      <View style={styles.statsRow}>
        <View style={[styles.statBox, { backgroundColor: 'rgba(22, 163, 74, 0.15)' }]}>
          <ThemedText style={styles.statNumber}>{stats.present}</ThemedText>
          <ThemedText style={styles.statLabel}>Present</ThemedText>
        </View>
        <View style={[styles.statBox, { backgroundColor: 'rgba(234, 179, 8, 0.15)' }]}>
          <ThemedText style={styles.statNumber}>{stats.late}</ThemedText>
          <ThemedText style={styles.statLabel}>Late</ThemedText>
        </View>
        <View style={[styles.statBox, { backgroundColor: 'rgba(220, 38, 38, 0.15)' }]}>
          <ThemedText style={styles.statNumber}>{stats.absent}</ThemedText>
          <ThemedText style={styles.statLabel}>Absent</ThemedText>
        </View>
      </View>

      {/* ================= LIST ================= */}


      <ThemedText style={styles.sectionTitle}>Today Records</ThemedText>

<View style={styles.list}>
  {attendance.map((item: any, i) => {

    const checkIn = item.checkInAt
      ? new Date(item.checkInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "--";

    const checkOut = item.checkOutAt
      ? new Date(item.checkOutAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "--";

    return (
      <View key={i} style={styles.cardNew}>

        {/* Avatar */}
        <View style={styles.avatar}>
          <ThemedText style={styles.avatarText}>
            {item.name.charAt(0)}
          </ThemedText>
        </View>

        {/* Info */}
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.name}>{item.name}</ThemedText>

          <View style={styles.timeRow}>
            <ThemedText style={styles.timeLabel}>IN:</ThemedText>
            <ThemedText style={styles.timeValue}>{checkIn}</ThemedText>

         <ThemedText style={[styles.timeLabel, { marginLeft: 10 }]}>OUT:</ThemedText>
         <ThemedText style={styles.timeValue}>{checkOut}</ThemedText>
          </View>
          </View>

        {/* Status Badge */}
        <View
          style={[
            styles.badgeNew,
            item.status === "Present" && styles.badgePresent,
            item.status === "Late" && styles.badgeLate,
            item.status === "Absent" && styles.badgeAbsent,
          ]}
        >
          <ThemedText style={styles.badgeText}>{item.status}</ThemedText>
        </View>

      </View>
    );
  })}
</View>
    </ScrollView>
  );
}

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  header: { marginBottom: 20 },
  subtitle: { fontSize: 16, marginTop: 4, opacity: 0.7 },

  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12
  },

  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16a34a',
    padding: 14,
    borderRadius: 12,
    marginBottom: 24,
    gap: 8,
  },

  addButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },

  statBox: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },

  statNumber: { fontSize: 24, fontWeight: '700' },
  statLabel: { fontSize: 12, marginTop: 4, opacity: 0.7 },

  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },

  list: { gap: 12 },

  attendanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },

  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },

  avatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },

  info: { flex: 1 },

  name: { fontSize: 16, fontWeight: '600' },
  time: { fontSize: 13, marginTop: 2, opacity: 0.6 },

  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },

  badgePresent: { backgroundColor: 'rgba(22, 163, 74, 0.2)' },
  badgeLate: { backgroundColor: 'rgba(234, 179, 8, 0.2)' },
  badgeAbsent: { backgroundColor: 'rgba(220, 38, 38, 0.2)' },

  badgeText: { fontSize: 12, fontWeight: '600' },
  cardNew: {
  flexDirection: "row",
  alignItems: "center",
  padding: 16,
  borderRadius: 14,
  borderWidth: 1,
  borderColor: "rgba(0,0,0,0.06)",
  backgroundColor: "#fff",
},

timeRow: {
  flexDirection: "row",
  alignItems: "center",
  marginTop: 4,
},

timeLabel: {
  fontSize: 12,
  opacity: 0.6,
  marginRight: 4,
},

timeValue: {
  fontSize: 13,
  fontWeight: "600",
},

badgeNew: {
  paddingHorizontal: 12,
  paddingVertical: 6,
  borderRadius: 20,
},
});