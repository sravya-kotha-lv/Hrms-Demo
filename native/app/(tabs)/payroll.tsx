import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Link } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

const MOCK_PAYSLIPS = [
  { month: 'January 2025', amount: '$4,500', status: 'Paid' },
  { month: 'December 2024', amount: '$4,500', status: 'Paid' },
  { month: 'November 2024', amount: '$4,200', status: 'Paid' },
];

export default function PayrollScreen() {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <ThemedText type="title">Payroll</ThemedText>
        <ThemedText style={styles.subtitle}>
          Salary & payslip management
        </ThemedText>
      </View>

      <Link href="/payroll-modal" asChild>
        <View style={styles.addButton}>
          <MaterialIcons name="receipt-long" size={22} color="#fff" />
          <ThemedText style={styles.addButtonText}>View Payslip</ThemedText>
        </View>
      </Link>

      <View style={styles.summaryCard}>
        <MaterialIcons name="account-balance-wallet" size={36} color="#7c3aed" />
        <View style={styles.summaryInfo}>
          <ThemedText style={styles.summaryLabel}>Net Salary (This Month)</ThemedText>
          <ThemedText style={styles.summaryValue}>$4,500.00</ThemedText>
          <ThemedText style={styles.summaryDate}>Paid on Feb 1, 2025</ThemedText>
        </View>
      </View>

      <ThemedText style={styles.sectionTitle}>Payslip History</ThemedText>
      <View style={styles.list}>
        {MOCK_PAYSLIPS.map((slip, i) => (
          <Link key={i} href="/payroll-modal" asChild>
            <View style={styles.payslipCard}>
              <View style={styles.payslipIcon}>
                <MaterialIcons name="description" size={24} color="#7c3aed" />
              </View>
              <View style={styles.payslipInfo}>
                <ThemedText style={styles.payslipMonth}>{slip.month}</ThemedText>
                <ThemedText style={styles.payslipAmount}>{slip.amount}</ThemedText>
              </View>
              <View style={styles.paidBadge}>
                <ThemedText style={styles.paidText}>{slip.status}</ThemedText>
              </View>
              <MaterialIcons name="chevron-right" size={24} color="#9ca3af" />
            </View>
          </Link>
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
    backgroundColor: '#7c3aed',
    padding: 14,
    borderRadius: 12,
    marginBottom: 24,
    gap: 8,
  },
  addButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 24,
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
    backgroundColor: 'rgba(124, 58, 237, 0.08)',
    gap: 20,
  },
  summaryInfo: { flex: 1 },
  summaryLabel: { fontSize: 14, opacity: 0.7 },
  summaryValue: { fontSize: 28, fontWeight: '700', marginTop: 4 },
  summaryDate: { fontSize: 13, marginTop: 4, opacity: 0.6 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  list: { gap: 12 },
  payslipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  payslipIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(124, 58, 237, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  payslipInfo: { flex: 1 },
  payslipMonth: { fontSize: 16, fontWeight: '600' },
  payslipAmount: { fontSize: 18, fontWeight: '700', marginTop: 2, color: '#7c3aed' },
  paidBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(22, 163, 74, 0.2)',
    marginRight: 8,
  },
  paidText: { fontSize: 12, fontWeight: '600', color: '#16a34a' },
});
