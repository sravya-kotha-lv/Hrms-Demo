import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActionCard } from '@/components/hrm/ActionCard';
import HRMLogo from '@/components/hrm/HRMLogo';
import { StatCard } from '@/components/hrm/StatCard';
import { ThemedText } from '@/components/themed-text';

export default function DashboardScreen() {
  const router = useRouter();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 10, paddingTop: 0, paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{paddingBottom:20 }}>
        <HRMLogo size="md" />
      </View>
      <ThemedText type="title">Dashboard</ThemedText>
      <ThemedText style={{ fontSize: 16, marginTop: 4, opacity: 0.7 }}>
        Welcome back! Here&apos;s your HR overview
      </ThemedText>

      <View style={styles.statsRow}>
        <StatCard
          title="Employees"
          value={156}
          icon="people"
          color="#2563eb"
          onPress={() => router.push('/employee-modal')}
        />
        <StatCard
          title="Present Today"
          value={142}
          icon="event-available"
          color="#16a34a"
          onPress={() => router.push('/attendance-modal')}
        />
      </View>

      <View style={styles.statsRow}>
        <StatCard
          title="On Leave"
          value={8}
          icon="event-busy"
          color="#dc2626"
          onPress={() => router.push('/leave-modal')}
        />
        <StatCard
          title="Pending Payroll"
          value="12"
          icon="payments"
          color="#7c3aed"
          onPress={() => router.push('/payroll-modal')}
        />
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>Quick Actions</ThemedText>
        <ActionCard
          title="Add Employee"
          subtitle="Register new team member"
          icon="person-add"
          href="/employee-modal"
        />
        <ActionCard
          title="Mark Attendance"
          subtitle="Record daily attendance"
          icon="check-circle"
          href="/attendance-modal"
        />
        <ActionCard
          title="Apply for Leave"
          subtitle="Submit leave request"
          icon="event-busy"
          href="/leave-modal"
        />
        <ActionCard
          title="View Payroll"
          subtitle="Salary & payslips"
          icon="receipt-long"
          href="/payroll-modal"
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
  },
  logo: {
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    marginTop: 4,
    opacity: 0.7,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
});
