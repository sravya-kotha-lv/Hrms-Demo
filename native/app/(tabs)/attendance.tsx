import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Link } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

const MOCK_ATTENDANCE = [
  { name: 'John Doe', status: 'Present', time: '9:00 AM' },
  { name: 'Jane Smith', status: 'Present', time: '8:45 AM' },
  { name: 'Mike Wilson', status: 'Late', time: '9:30 AM' },
  { name: 'Sarah Lee', status: 'Absent', time: '-' },
];

export default function AttendanceScreen() {
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

      <View style={styles.statsRow}>
        <View style={[styles.statBox, { backgroundColor: 'rgba(22, 163, 74, 0.15)' }]}>
          <ThemedText style={styles.statNumber}>142</ThemedText>
          <ThemedText style={styles.statLabel}>Present</ThemedText>
        </View>
        <View style={[styles.statBox, { backgroundColor: 'rgba(234, 179, 8, 0.15)' }]}>
          <ThemedText style={styles.statNumber}>6</ThemedText>
          <ThemedText style={styles.statLabel}>Late</ThemedText>
        </View>
        <View style={[styles.statBox, { backgroundColor: 'rgba(220, 38, 38, 0.15)' }]}>
          <ThemedText style={styles.statNumber}>8</ThemedText>
          <ThemedText style={styles.statLabel}>Absent</ThemedText>
        </View>
      </View>

      <ThemedText style={styles.sectionTitle}>Recent Records</ThemedText>
      <View style={styles.list}>
        {MOCK_ATTENDANCE.map((item, i) => (
          <View key={i} style={styles.attendanceCard}>
            <View style={styles.avatar}>
              <ThemedText style={styles.avatarText}>{item.name.charAt(0)}</ThemedText>
            </View>
            <View style={styles.info}>
              <ThemedText style={styles.name}>{item.name}</ThemedText>
              <ThemedText style={styles.time}>{item.time}</ThemedText>
            </View>
            <View
              style={[
                styles.badge,
                item.status === 'Present' && styles.badgePresent,
                item.status === 'Late' && styles.badgeLate,
                item.status === 'Absent' && styles.badgeAbsent,
              ]}
            >
              <ThemedText style={styles.badgeText}>{item.status}</ThemedText>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  header: { marginBottom: 20 },
  subtitle: { fontSize: 16, marginTop: 4, opacity: 0.7 },
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
});
