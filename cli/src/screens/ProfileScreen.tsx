import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  PermissionsAndroid,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { useNavigation } from '@react-navigation/native';
import { getApiWithToken, putApiWithToken } from '../services/api';
import { useAuth } from '../context/AuthContext';

type UploadPayload = {
  fileName: string;
  mimeType: string;
  base64Data: string;
};

const requestAndroidPermission = async (permission: string) => {
  const granted = await PermissionsAndroid.request(permission);
  return granted === PermissionsAndroid.RESULTS.GRANTED;
};

const requestPhotoPermission = async () => {
  if (Platform.OS !== 'android') return true;
  const perm =
    Platform.Version >= 33
      ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
      : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;
  return requestAndroidPermission(perm);
};

const requestCameraPermission = async () => {
  if (Platform.OS !== 'android') return true;
  return requestAndroidPermission(PermissionsAndroid.PERMISSIONS.CAMERA);
};

function ProfileScreen() {
  const navigation = useNavigation<any>();
  const { session, updateProfile } = useAuth();
  const token = session?.token || '';
  const safeAreaInsets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState<any>(null);
  const [profileImageUpload, setProfileImageUpload] = useState<UploadPayload | null>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('');
  const [stateValue, setStateValue] = useState('');
  const [country, setCountry] = useState('');
  const [zip, setZip] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyRelation, setEmergencyRelation] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');

  const loadProfile = async () => {
    setLoading(true);
    const res = await getApiWithToken<any>('/employees/me', token);
    setLoading(false);
    if (!res?.success) {
      setError(res?.message || 'Unable to load profile.');
      return;
    }
    const data = res.data || null;
    setProfile(data);
    setFirstName(data?.firstName || '');
    setLastName(data?.lastName || '');
    setPhone(data?.phone || '');
    setDob(data?.dob ? String(data.dob).slice(0, 10) : '');
    setGender(data?.gender || '');
    setLine1(data?.address?.line1 || '');
    setLine2(data?.address?.line2 || '');
    setCity(data?.address?.city || '');
    setStateValue(data?.address?.state || '');
    setCountry(data?.address?.country || '');
    setZip(data?.address?.zip || '');
    const contact = Array.isArray(data?.emergencyContacts) ? data.emergencyContacts[0] : null;
    setEmergencyName(contact?.name || '');
    setEmergencyRelation(contact?.relation || '');
    setEmergencyPhone(contact?.phone || '');
  };

  useEffect(() => {
    if (!token) return;
    loadProfile();
  }, [token]);

  const pickImage = async (mode: 'camera' | 'library') => {
    setError('');
    if (mode === 'camera') {
      const ok = await requestCameraPermission();
      if (!ok) {
        setError('Camera permission is required.');
        return;
      }
    } else {
      const ok = await requestPhotoPermission();
      if (!ok) {
        setError('Photo library permission is required.');
        return;
      }
    }

    const result =
      mode === 'camera'
        ? await launchCamera({
            mediaType: 'photo',
            includeBase64: true,
            maxWidth: 720,
            maxHeight: 720,
            quality: 0.7,
          })
        : await launchImageLibrary({
            mediaType: 'photo',
            includeBase64: true,
            maxWidth: 720,
            maxHeight: 720,
            quality: 0.7,
          });

    const asset = result.assets?.[0];
    if (!asset?.base64 || !asset?.type) return;
    setProfileImageUpload({
      base64Data: asset.base64,
      mimeType: asset.type,
      fileName: asset.fileName || `profile-${Date.now()}.jpg`,
    });
  };

  const handleSave = async () => {
    if (!phone || !dob || !gender || !line1 || !city || !stateValue || !country || !zip) {
      setError('Please fill all required fields.');
      return;
    }

    setSaving(true);
    setError('');
    const payload: Record<string, unknown> = {
      firstName,
      lastName,
      phone,
      dob,
      gender,
      address: {
        line1,
        line2,
        city,
        state: stateValue,
        country,
        zip,
      },
      emergencyContacts: emergencyName
        ? [
            {
              name: emergencyName,
              relation: emergencyRelation || 'Contact',
              phone: emergencyPhone || phone,
            },
          ]
        : [],
      departmentId: profile?.departmentId || undefined,
      designationId: profile?.designationId || undefined,
      dateOfJoining: profile?.dateOfJoining || undefined,
      employmentType: profile?.employmentType || undefined,
      bloodGroup: profile?.bloodGroup || undefined,
      aadhaarNumber: profile?.aadhaarNumber || undefined,
      panNumber: profile?.panNumber || undefined,
    };

    if (profileImageUpload) {
      payload.profileImageUpload = profileImageUpload;
    }

    const res = await putApiWithToken<any>('/employees/me/profile', payload, token);
    setSaving(false);
    if (!res?.success) {
      setError(res?.message || 'Unable to update profile.');
      return;
    }
    await loadProfile();
    updateProfile(res?.data || profile);
    setProfileImageUpload(null);
  };

  const profileImage =
    profileImageUpload?.base64Data
      ? `data:${profileImageUpload.mimeType};base64,${profileImageUpload.base64Data}`
      : profile?.profileImage || null;

  return (
    <LinearGradient
      colors={['#f3f5f9', '#f3f5f9', '#eef1f6']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: Math.max(safeAreaInsets.top, 16) },
        ]}
      >
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.headerButton}>
            <MaterialCommunityIcons name="chevron-left" size={22} color="#0f172a" />
          </Pressable>
          <Text style={styles.headerTitle}>My Profile</Text>
          <View style={styles.headerButton} />
        </View>

        {loading ? (
          <View style={styles.card}>
            <ActivityIndicator />
            <Text style={styles.helperText}>Loading profile...</Text>
          </View>
        ) : (
          <View style={styles.card}>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <View style={styles.photoRow}>
              <View style={styles.photoWrap}>
                {profileImage ? (
                  <Image source={{ uri: profileImage }} style={styles.photo} />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <MaterialCommunityIcons name="account" size={28} color="#64748b" />
                  </View>
                )}
              </View>
              <View style={styles.photoActions}>
                <Pressable style={styles.secondaryButton} onPress={() => pickImage('camera')}>
                  <Text style={styles.secondaryButtonText}>Camera</Text>
                </Pressable>
                <Pressable style={styles.secondaryButton} onPress={() => pickImage('library')}>
                  <Text style={styles.secondaryButtonText}>Gallery</Text>
                </Pressable>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Basic Details</Text>
            <View style={styles.formRow}>
              <TextInput
                style={styles.input}
                placeholder="First Name"
                value={firstName}
                onChangeText={setFirstName}
              />
              <TextInput
                style={styles.input}
                placeholder="Last Name"
                value={lastName}
                onChangeText={setLastName}
              />
            </View>
            <TextInput
              style={styles.input}
              placeholder="Phone"
              value={phone}
              onChangeText={setPhone}
            />
            <TextInput
              style={styles.input}
              placeholder="Date of Birth (YYYY-MM-DD)"
              value={dob}
              onChangeText={setDob}
            />
            <TextInput
              style={styles.input}
              placeholder="Gender"
              value={gender}
              onChangeText={setGender}
            />

            <Text style={styles.sectionTitle}>Address</Text>
            <TextInput
              style={styles.input}
              placeholder="Address Line 1"
              value={line1}
              onChangeText={setLine1}
            />
            <TextInput
              style={styles.input}
              placeholder="Address Line 2"
              value={line2}
              onChangeText={setLine2}
            />
            <View style={styles.formRow}>
              <TextInput style={styles.input} placeholder="City" value={city} onChangeText={setCity} />
              <TextInput
                style={styles.input}
                placeholder="State"
                value={stateValue}
                onChangeText={setStateValue}
              />
            </View>
            <View style={styles.formRow}>
              <TextInput
                style={styles.input}
                placeholder="Country"
                value={country}
                onChangeText={setCountry}
              />
              <TextInput
                style={styles.input}
                placeholder="PIN Code"
                value={zip}
                onChangeText={setZip}
              />
            </View>

            <Text style={styles.sectionTitle}>Emergency Contact</Text>
            <TextInput
              style={styles.input}
              placeholder="Contact Name"
              value={emergencyName}
              onChangeText={setEmergencyName}
            />
            <View style={styles.formRow}>
              <TextInput
                style={styles.input}
                placeholder="Relation"
                value={emergencyRelation}
                onChangeText={setEmergencyRelation}
              />
              <TextInput
                style={styles.input}
                placeholder="Phone"
                value={emergencyPhone}
                onChangeText={setEmergencyPhone}
              />
            </View>

            <Pressable style={styles.primaryButton} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Save Profile</Text>}
            </Pressable>
          </View>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 16, paddingBottom: 120, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
  },
  helperText: { fontSize: 12, color: '#64748b' },
  errorText: { fontSize: 12, color: '#dc2626' },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  photoWrap: { width: 72, height: 72, borderRadius: 36, overflow: 'hidden' },
  photo: { width: '100%', height: '100%' },
  photoPlaceholder: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoActions: { flex: 1, flexDirection: 'row', gap: 8 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#0f172a', marginTop: 6 },
  formRow: { flexDirection: 'row', gap: 10 },
  input: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 10,
    backgroundColor: '#ffffff',
    fontSize: 12,
  },
  primaryButton: {
    height: 44,
    borderRadius: 12,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: '#fff', fontWeight: '700' },
  secondaryButton: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  secondaryButtonText: { fontSize: 12, color: '#0f172a', fontWeight: '600' },
});

export default ProfileScreen;
