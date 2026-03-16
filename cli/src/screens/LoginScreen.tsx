import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  ScrollView,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import { getApiWithToken, postApiWithoutToken } from '../services/api';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';

const isEmployeeRole = (role: any) => {
  const slug = String(role?.slug || '').toLowerCase();
  const name = String(role?.name || '').toLowerCase();
  return slug === 'employee' || name === 'employee';
};

function LoginScreen() {
  const navigation = useNavigation<any>();
  const { setSession, sessionExpiredMessage, clearSessionExpiredMessage } = useAuth();
  const safeAreaInsets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 900;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (sessionExpiredMessage) {
      setNotice(sessionExpiredMessage);
      clearSessionExpiredMessage();
    }
  }, [sessionExpiredMessage, clearSessionExpiredMessage]);

  const handleLogin = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password;
    setError('');

    if (!trimmedEmail || !trimmedPassword) {
      setError('Email and password are required.');
      return;
    }

    try {
      setSubmitting(true);
      const { json, token } = await postApiWithoutToken<any>('/users/login', {
        email: trimmedEmail,
        password: trimmedPassword,
      });

      if (!json?.success) {
        setError(json?.message || 'Login failed.');
        return;
      }

      if (json?.data?.mustChangePassword) {
        setError('Please change your password on the web portal first.');
        return;
      }

      if (!token) {
        setError('Login token missing. Please contact admin.');
        return;
      }

      const roles = json?.data?.roles || [];
      const activeRole = json?.data?.activeRole || roles[0] || null;
      const hasEmployeeRole =
        isEmployeeRole(activeRole) || roles.some((role: any) => isEmployeeRole(role));

      if (!hasEmployeeRole) {
        setError('Only employee access is supported in this app.');
        return;
      }

      const [profileRes, permissionRes] = await Promise.all([
        getApiWithToken<any>('/users/me/profile', token),
        getApiWithToken<any>('/users/me/permissions', token),
      ]);

      const profile = profileRes?.success ? profileRes.data : null;
      const permissions = permissionRes?.success ? permissionRes.data || [] : [];

      setSession({
        token,
        loginData: {
          ...json.data,
          activeRole,
        },
        profile,
        permissions,
      });
      // Navigation will switch via session state in AppNavigator.
    } catch {
      setError('Login failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <LinearGradient
      colors={['#0c63f9', '#214fc6', '#b0cce0']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: Math.max(safeAreaInsets.top, 12) },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.layout, isWide && styles.layoutWide]}>
          {isWide && (
            <View style={styles.leftPanel}>
              <Text style={styles.leftEyebrow}>UPANAYA HRMS PLATFORM</Text>

              <Text style={styles.leftTitle}>
                Human resources,{'\n'}reimagined for real operations
              </Text>

              <View style={styles.featureRow}>
                <View style={styles.featureCard}>
                  <MaterialCommunityIcons name="clock-outline" size={18} color="#fff" />
                  <Text style={styles.featureTitle}>Attendance Engine</Text>
                  <Text style={styles.featureText}>Real-time</Text>
                </View>

                <View style={styles.featureCard}>
                  <MaterialCommunityIcons name="shield-check-outline" size={18} color="#fff" />
                  <Text style={styles.featureTitle}>Access Governance</Text>
                  <Text style={styles.featureText}>Role-based</Text>
                </View>
              </View>
            </View>
          )}

          <View style={[styles.cardWrap, isWide && styles.cardWrapWide]}>
            <LinearGradient
              colors={['#ffffff', '#fefeff', '#fcfdff']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.card}
            >
              <Text style={styles.cardEyebrow}>WELCOME BACK</Text>

              <Text style={styles.cardTitle}>Sign in to Upanaya HRMS</Text>

              <Text style={styles.cardSubtitle}>
                Manage attendance, leaves, approvals, and people operations in one place.
              </Text>

              {notice ? <View style={styles.noticeBox}><Text style={styles.noticeText}>{notice}</Text></View> : null}
              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <View style={styles.form}>
                <TextInput
                  style={styles.input}
                  placeholder="Work email"
                  placeholderTextColor="#9aa4b2"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />

                <View style={styles.passwordWrap}>
                  <TextInput
                    style={[styles.input, styles.passwordInput]}
                    placeholder="Password"
                    placeholderTextColor="#9aa4b2"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                  />
                  <Pressable
                    onPress={() => setShowPassword((current) => !current)}
                    style={styles.eyeButton}
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <MaterialCommunityIcons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={18}
                      color="#64748b"
                    />
                  </Pressable>
                </View>

                <Pressable
                  onPress={() => navigation.navigate('ForgotPassword')}
                  style={styles.forgotPressable}
                >
                  <Text style={styles.forgot}>Forgot password?</Text>
                </Pressable>

                <Pressable
                  style={[styles.primaryButton, submitting && styles.buttonDisabled]}
                  onPress={handleLogin}
                  disabled={submitting}
                >
                  <View style={styles.buttonContent}>
                    {submitting ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <MaterialCommunityIcons name="login" size={16} color="#fff" />
                    )}
                    <Text style={styles.primaryButtonText}>
                      {submitting ? 'Signing in...' : 'Login'}
                    </Text>
                  </View>
                </Pressable>

                <Pressable style={styles.secondaryButton} disabled>
                  <View style={styles.buttonContent}>
                    <MaterialCommunityIcons name="camera-outline" size={16} color="#1e293b" />
                    <Text style={styles.secondaryButtonText}>Login with Selfie</Text>
                  </View>
                </Pressable>
              </View>

              <View style={styles.miniCards}>
                <View style={styles.miniCard}>
                  <MaterialCommunityIcons name="account-group-outline" size={18} color="#2563eb" />
                  <Text style={styles.miniCardTitle}>Employees</Text>
                </View>

                <View style={styles.miniCard}>
                  <MaterialCommunityIcons name="calendar-check-outline" size={18} color="#2563eb" />
                  <Text style={styles.miniCardTitle}>Attendance</Text>
                </View>

                <View style={styles.miniCard}>
                  <MaterialCommunityIcons name="shield-check-outline" size={18} color="#2563eb" />
                  <Text style={styles.miniCardTitle}>Secure</Text>
                </View>
              </View>
            </LinearGradient>
          </View>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: 24,
  },
  layout: {
    flex: 1,
    paddingHorizontal: 16,
  },
  layoutWide: {
    flexDirection: 'row',
    gap: 24,
    paddingHorizontal: 24,
  },
  leftPanel: {
    flex: 1,
    justifyContent: 'center',
  },
  leftEyebrow: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    letterSpacing: 2,
    fontWeight: '700',
  },
  leftTitle: {
    marginTop: 16,
    fontSize: 34,
    fontWeight: '800',
    color: '#fff',
    lineHeight: 40,
  },
  featureRow: {
    flexDirection: 'row',
    marginTop: 30,
    gap: 16,
  },
  featureCard: {
    flex: 1,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  featureTitle: {
    color: '#fff',
    marginTop: 6,
    fontWeight: '600',
  },
  featureText: {
    color: '#e2e8f0',
    fontSize: 12,
  },
  cardWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  cardWrapWide: {
    width: 420,
  },
  card: {
    borderRadius: 22,
    padding: 20,
    elevation: 8,
  },
  cardEyebrow: {
    color: '#2563eb',
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: '700',
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 6,
    color: '#0f172a',
  },
  cardSubtitle: {
    marginTop: 6,
    fontSize: 13,
    color: '#64748b',
  },
  form: {
    marginTop: 16,
    gap: 12,
  },
  noticeBox: {
    marginTop: 12,
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#fef3c7',
  },
  noticeText: {
    color: '#92400e',
    fontSize: 12,
    fontWeight: '600',
  },
  errorText: {
    marginTop: 12,
    color: '#dc2626',
    fontSize: 12,
  },
  input: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
  },
  passwordWrap: {
    position: 'relative',
    justifyContent: 'center',
  },
  passwordInput: {
    paddingRight: 44,
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
    height: 44,
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  forgot: {
    textAlign: 'right',
    color: '#2563eb',
    fontSize: 12,
  },
  forgotPressable: {
    alignSelf: 'flex-end',
  },
  primaryButton: {
    backgroundColor: '#456bde',
    borderRadius: 12,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  secondaryButton: {
    borderRadius: 12,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#cbd5f5',
    backgroundColor: '#f8fafc',
  },
  secondaryButtonText: {
    fontWeight: '600',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  miniCards: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 8,
  },
  miniCard: {
    flex: 1,
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  miniCardTitle: {
    fontSize: 11,
    marginTop: 4,
    color: '#64748b',
  },
});

export default LoginScreen;
