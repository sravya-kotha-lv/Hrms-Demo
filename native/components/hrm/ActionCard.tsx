import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

type ActionCardProps = {
  title: string;
  subtitle?: string;
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  href: string;
};

export function ActionCard({ title, subtitle, icon, href }: ActionCardProps) {
  return (
    <Link href={href} asChild>
      <Pressable
        style={({ pressed }) => [
          styles.card,
          pressed && styles.cardPressed,
        ]}
      >
        <View style={styles.iconContainer}>
          <MaterialIcons name={icon} size={24} color="#2563eb" />
        </View>
        <View style={styles.content}>
          <ThemedText style={styles.title}>{title}</ThemedText>
          {subtitle && (
            <ThemedText style={styles.subtitle}>{subtitle}</ThemedText>
          )}
        </View>
        <MaterialIcons name="chevron-right" size={24} color="#9ca3af" />
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  cardPressed: {
    opacity: 0.9,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
    opacity: 0.6,
  },
});
