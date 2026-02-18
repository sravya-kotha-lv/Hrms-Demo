import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Link } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

const MOCK_LEAVES = [
  { id: '1', name: 'John Doe', type: 'Sick Leave', days: 2, status: 'Approved' },
  { id: '2', name: 'Jane Smith', type: 'Annual Leave', days: 5, status: 'Pending' },
  { id: '3', name: 'Mike Wilson', type: 'Personal', days: 1, status: 'Rejected' },
];

export default function LeavesScreen() {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <ThemedText type="title">Leaves</ThemedText>
        <ThemedText style={styles.subtitle}>Manage leave requests</ThemedText>
      </View>

      <Link href="/leave-modal" asChild>
        <View style={styles.addButton}>
          <MaterialIcons name="event-busy" size={22} color="#fff" />
          <ThemedText style={styles.addButtonText}>Apply for Leave</ThemedText>
        </View>
      </Link>

      <View style={styles.balanceCard}>
        <MaterialIcons name="beach-access" size={32} color="#2563eb" />
        <View style={styles.balanceInfo}>
          <ThemedText style={styles.balanceLabel}>Leave Balance</ThemedText>
          <ThemedText style={styles.balanceValue}>18 days remaining</ThemedText>
        </View>
      </View>

      <ThemedText style={styles.sectionTitle}>Recent Requests</ThemedText>
      <View style={styles.list}>
        {MOCK_LEAVES.map((leave) => (
          <View key={leave.id} style={styles.leaveCard}>
            <View style={styles.leaveHeader}>
              <ThemedText style={styles.leaveName}>{leave.name}</ThemedText>
              <View
                style={[
                  styles.statusBadge,
                  leave.status === 'Approved' && styles.badgeApproved,
                  leave.status === 'Pending' && styles.badgePending,
                  leave.status === 'Rejected' && styles.badgeRejected,
                ]}
              >
                <ThemedText style={styles.statusText}>{leave.status}</ThemedText>
              </View>
            </View>
            <ThemedText style={styles.leaveType}>{leave.type}</ThemedText>
            <ThemedText style={styles.leaveDays}>{leave.days} day(s)</ThemedText>
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
    backgroundColor: '#dc2626',
    padding: 14,
    borderRadius: 12,
    marginBottom: 24,
    gap: 8,
  },
  addButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  balanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.3)',
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    gap: 16,
  },
  balanceInfo: { flex: 1 },
  balanceLabel: { fontSize: 14, opacity: 0.7 },
  balanceValue: { fontSize: 20, fontWeight: '700', marginTop: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  list: { gap: 12 },
  leaveCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  leaveHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leaveName: { fontSize: 16, fontWeight: '600' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeApproved: { backgroundColor: 'rgba(22, 163, 74, 0.2)' },
  badgePending: { backgroundColor: 'rgba(234, 179, 8, 0.2)' },
  badgeRejected: { backgroundColor: 'rgba(220, 38, 38, 0.2)' },
  statusText: { fontSize: 12, fontWeight: '600' },
  leaveType: { fontSize: 14, marginTop: 8, opacity: 0.8 },
  leaveDays: { fontSize: 13, marginTop: 4, opacity: 0.6 },
});
