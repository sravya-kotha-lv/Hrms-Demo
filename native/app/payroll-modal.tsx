import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

const PAYSLIP_ITEMS = [
  { label: 'Basic Salary', amount: '$4,000.00' },
  { label: 'Allowances', amount: '$500.00' },
  { label: 'Tax Deduction', amount: '-$800.00' },
  { label: 'Insurance', amount: '-$200.00' },
];

export default function PayrollModal() {
  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.closePressable}>
          <MaterialIcons name="close" size={24} color="#6b7280" />
        </Pressable>
        <ThemedText type="title">Payslip</ThemedText>
        <ThemedText style={styles.subtitle}>
          January 2025
        </ThemedText>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.summaryCard}>
          <ThemedText style={styles.netLabel}>Net Salary</ThemedText>
          <ThemedText style={styles.netAmount}>$4,500.00</ThemedText>
          <ThemedText style={styles.netDate}>Paid on Feb 1, 2025</ThemedText>
        </View>

        <ThemedText style={styles.sectionTitle}>Breakdown</ThemedText>
        <View style={styles.breakdown}>
          {PAYSLIP_ITEMS.map((item, i) => (
            <View key={i} style={styles.row}>
              <ThemedText style={styles.rowLabel}>{item.label}</ThemedText>
              <ThemedText
                style={[
                  styles.rowAmount,
                  item.amount.startsWith('-') && styles.negativeAmount,
                ]}
              >
                {item.amount}
              </ThemedText>
            </View>
          ))}
        </View>

        <View style={styles.actions}>
          <View style={styles.actionButton}>
            <MaterialIcons name="download" size={22} color="#7c3aed" />
            <ThemedText style={styles.actionText}>Download PDF</ThemedText>
          </View>
          <View style={styles.actionButton}>
            <MaterialIcons name="share" size={22} color="#7c3aed" />
            <ThemedText style={styles.actionText}>Share</ThemedText>
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  closePressable: {
    position: 'absolute',
    top: 50,
    right: 24,
    zIndex: 10,
  },
  subtitle: { fontSize: 16, marginTop: 4, opacity: 0.7 },
  content: { flex: 1, padding: 24 },
  summaryCard: {
    padding: 24,
    borderRadius: 16,
    marginBottom: 24,
    backgroundColor: 'rgba(124, 58, 237, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
  },
  netLabel: { fontSize: 14, opacity: 0.7 },
  netAmount: { fontSize: 32, fontWeight: '700', marginTop: 4, color: '#7c3aed' },
  netDate: { fontSize: 13, marginTop: 4, opacity: 0.6 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  breakdown: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    marginBottom: 24,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  rowLabel: { fontSize: 15 },
  rowAmount: { fontSize: 15, fontWeight: '600' },
  negativeAmount: { color: '#dc2626' },
  actions: { flexDirection: 'row', gap: 12 },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.5)',
    gap: 8,
  },
  actionText: { fontSize: 15, fontWeight: '600', color: '#7c3aed' },
});
