import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
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
import { getApiWithToken, putApiWithToken } from '../services/api';
import { useAuth } from '../context/AuthContext';

type UploadPayload = {
  fileName: string;
  mimeType: string;
  base64Data: string;
};

const GENDER_OPTIONS = ['Male', 'Female', 'Other'];
const BLOOD_GROUP_OPTIONS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const RELATION_OPTIONS = [
  'Father',
  'Mother',
  'Spouse',
  'Brother',
  'Sister',
  'Son',
  'Daughter',
  'Guardian',
  'Friend',
  'Other',
];

type SelectionFieldKey = 'gender' | 'bloodGroup' | 'emergencyRelation';

type AndroidPermissionValue = typeof PermissionsAndroid.PERMISSIONS[keyof typeof PermissionsAndroid.PERMISSIONS];

const requestAndroidPermission = async (permission: AndroidPermissionValue) => {
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
  const insets = useSafeAreaInsets();
  const { session, updateProfile } = useAuth();
  const token = session?.token || '';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [error, setError] = useState('');
  const [editVisible, setEditVisible] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('');
  const [stateValue, setStateValue] = useState('');
  const [country, setCountry] = useState('');
  const [zip, setZip] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyRelation, setEmergencyRelation] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [profileImage, setProfileImage] = useState<UploadPayload | null>(null);
  const [addressProofUpload, setAddressProofUpload] = useState<UploadPayload | null>(null);
  const [selectionField, setSelectionField] = useState<SelectionFieldKey | null>(null);

  const openSelection = (field: SelectionFieldKey) => setSelectionField(field);
  const closeSelection = () => setSelectionField(null);

  const handleSelection = (value: string) => {
    if (selectionField === 'gender') setGender(value);
    if (selectionField === 'bloodGroup') setBloodGroup(value);
    if (selectionField === 'emergencyRelation') setEmergencyRelation(value);
    closeSelection();
  };

  const selectionConfig = useMemo(() => {
    if (selectionField === 'gender') {
      return {
        title: 'Select Gender',
        options: GENDER_OPTIONS,
        value: gender,
      };
    }
    if (selectionField === 'bloodGroup') {
      return {
        title: 'Select Blood Group',
        options: BLOOD_GROUP_OPTIONS,
        value: bloodGroup,
      };
    }
    if (selectionField === 'emergencyRelation') {
      return {
        title: 'Select Relationship',
        options: RELATION_OPTIONS,
        value: emergencyRelation,
      };
    }
    return null;
  }, [selectionField, gender, bloodGroup, emergencyRelation]);

  const seedForm = (data: any | null) => {
    setFirstName(data?.firstName || '');
    setLastName(data?.lastName || '');
    setPhone(data?.phone || '');
    setDob(data?.dob ? String(data.dob).slice(0, 10) : '');
    setGender(data?.gender || '');
    setBloodGroup(data?.bloodGroup || '');
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
    setProfileImage(null);
    setAddressProofUpload(null);
  };

  const loadProfile = async () => {
    if (!token) return;
    setLoading(true);
    const res = await getApiWithToken('/employees/me', token);
    setLoading(false);
    if (!res?.success) {
      setError(res?.message || 'Unable to load profile');
      return;
    }
    setProfile(res.data || null);
    seedForm(res.data || null);
  };

  useEffect(() => {
    loadProfile();
  }, [token]);

  const employmentRows = useMemo(
    () => [
      { label: 'Employee Code', value: profile?.employeeCode },
      { label: 'Department', value: profile?.departmentId?.name },
      { label: 'Designation', value: profile?.designationId?.name },
      { label: 'Employment Type', value: profile?.employmentType },
      {
        label: 'Date Of Joining',
        value: profile?.dateOfJoining ? String(profile.dateOfJoining).slice(0, 10) : '',
      },
      {
        label: 'Reporting Manager',
        value: profile?.managerId
          ? `${profile.managerId.firstName || ''} ${profile.managerId.lastName || ''}`.trim()
          : '',
      },
    ],
    [profile]
  );

  const addressLabel = useMemo(() => {
    const parts = [
      profile?.address?.line1,
      profile?.address?.line2,
      profile?.address?.city,
      profile?.address?.state,
      profile?.address?.country,
      profile?.address?.zip,
    ]
      .filter(Boolean)
      .join(', ');
    return parts;
  }, [profile]);

  const personalRows = useMemo(
    () => [
      { label: 'Work Email', value: profile?.userId?.email },
      { label: 'Phone', value: profile?.phone },
      { label: 'DOB', value: profile?.dob ? String(profile.dob).slice(0, 10) : '' },
      { label: 'Gender', value: profile?.gender },
      { label: 'Blood Group', value: profile?.bloodGroup },
      { label: 'Address', value: addressLabel },
      {
        label: 'Address Proof',
        value: profile?.addressProof?.fileUrl ? 'Uploaded' : 'Not uploaded',
      },
    ],
    [profile, addressLabel]
  );

  const pickImage = async (mode: 'camera' | 'library') => {
    setError('');
    if (mode === 'camera') {
      const ok = await requestCameraPermission();
      if (!ok) {
        setError('Camera permission required.');
        return;
      }
    } else {
      const ok = await requestPhotoPermission();
      if (!ok) {
        setError('Photo permission required.');
        return;
      }
    }
    const result =
      mode === 'camera'
        ? await launchCamera({
            mediaType: 'photo',
            includeBase64: true,
            quality: 0.7,
            maxWidth: 720,
            maxHeight: 720,
          })
        : await launchImageLibrary({
            mediaType: 'photo',
            includeBase64: true,
            quality: 0.7,
            maxWidth: 720,
            maxHeight: 720,
          });
    const asset = result.assets?.[0];
    if (!asset?.base64 || !asset?.type) return;
    setProfileImage({
      fileName: asset.fileName || `profile-${Date.now()}.jpg`,
      mimeType: asset.type,
      base64Data: asset.base64,
    });
  };

  const pickAddressProof = async () => {
    setError('');
    const ok = await requestPhotoPermission();
    if (!ok) {
      setError('Photo permission required.');
      return;
    }
    const result = await launchImageLibrary({
      mediaType: 'photo',
      includeBase64: true,
      quality: 0.7,
      maxWidth: 1200,
      maxHeight: 1200,
    });
    const asset = result.assets?.[0];
    if (!asset?.base64 || !asset?.type) return;
    setAddressProofUpload({
      fileName: asset.fileName || `address-proof-${Date.now()}.jpg`,
      mimeType: asset.type,
      base64Data: asset.base64,
    });
  };

  const handleSave = async () => {
    if (!phone || !dob || !gender || !line1 || !city || !stateValue || !country || !zip) {
      setError('Please fill the required fields.');
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
      bloodGroup: bloodGroup || undefined,
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
    };
    if (profileImage) {
      payload.profileImageUpload = profileImage;
    }
    if (addressProofUpload) {
      payload.addressProofUpload = addressProofUpload;
    }
    const res = await putApiWithToken('/employees/me/profile', payload, token);
    setSaving(false);
    if (!res?.success) {
      setError(res?.message || 'Unable to save profile.');
      return;
    }
    setEditVisible(false);
    await loadProfile();
    updateProfile(res.data || profile);
  };

  const profileImageUrl = profile?.profileImage;
  const displayName = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || 'Employee';

  return (
    <LinearGradient colors={['#f3f5f9', '#f3f5f9', '#eef1f6']} style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: Math.max(insets.top, 16) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.detailCard}>
            <ActivityIndicator color="#2563eb" />
            <Text style={styles.helperText}>Loading profile...</Text>
          </View>
        ) : (
          <>
            <View style={styles.headerCard}>
              <LinearGradient
                colors={['#2a6cff', '#4a39f3']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0.9, y: 1 }}
                style={styles.headerAccent}
              />
              <View style={styles.headerMain}>
                <View style={styles.photoWrap}>
                  {profileImageUrl ? (
                    <Image source={{ uri: profileImageUrl }} style={styles.photo} />
                  ) : (
                    <View style={styles.placeholder}>
                      <Text style={styles.placeholderText}>{displayName.charAt(0)}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.headerBody}>
                  <View style={styles.headerText}>
                    <Text style={styles.headerName} numberOfLines={1}>
                      {displayName}
                    </Text>
                    <View style={styles.headerSubtitleRow}>
                      <MaterialCommunityIcons name="email-outline" size={12} color="#4b63f3" />
                      <Text style={styles.headerSubtitle} numberOfLines={1}>
                        {profile?.userId?.email || ''}
                      </Text>
                    </View>
                  </View>
                  <Pressable style={styles.editButton} onPress={() => setEditVisible(true)}>
                    <MaterialCommunityIcons name="pencil-outline" size={14} color="#2563eb" />
                    <Text style={styles.editButtonText}>Edit Profile</Text>
                  </Pressable>
                </View>
              </View>
            </View>

            <View style={[styles.detailCard, styles.cardSpacing]}>
              <Text style={styles.cardTitle}>Employment Details</Text>
              {employmentRows.map((row) => (
                <View key={row.label} style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{row.label}</Text>
                  <Text style={styles.detailValue}>{row.value || '-'}</Text>
                </View>
              ))}
            </View>

            <View style={[styles.detailCard, styles.cardSpacing]}>
              <Text style={styles.cardTitle}>Personal Details</Text>
              {personalRows.map((row) => (
                <View key={row.label} style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{row.label}</Text>
                  <Text style={styles.detailValue}>{row.value || '-'}</Text>
                </View>
              ))}
            </View>
          </>
        )}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>

      <Modal visible={editVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <ScrollView contentContainerStyle={styles.modalContent}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <Pressable style={styles.closeBadge} onPress={() => setEditVisible(false)}>
                <MaterialCommunityIcons name="close" size={20} color="#0f172a" />
              </Pressable>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Profile Picture</Text>
                <View style={styles.profilePicRow}>
                  <View style={styles.profilePicWrapper}>
                    {profileImage ? (
                      <Image
                        source={{ uri: `data:${profileImage.mimeType};base64,${profileImage.base64Data}` }}
                        style={styles.profilePicImage}
                        resizeMode="cover"
                      />
                    ) : profileImageUrl ? (
                      <Image source={{ uri: profileImageUrl }} style={styles.profilePicImage} resizeMode="cover" />
                    ) : (
                      <MaterialCommunityIcons name="account" size={32} color="#64748b" />
                    )}
                  </View>
                  <View style={styles.profilePicActions}>
                    <Pressable style={styles.uploadButton} onPress={() => pickImage('camera')}>
                      <Text style={styles.uploadButtonText}>Camera</Text>
                    </Pressable>
                    <Pressable style={styles.uploadButton} onPress={() => pickImage('library')}>
                      <Text style={styles.uploadButtonText}>Gallery</Text>
                    </Pressable>
                  </View>
                </View>
                <Text style={styles.helperText}>
                  {profileImage?.fileName || profileImageUrl ? profileImage?.fileName || 'Selected image' : 'Choose profile picture (JPG, PNG, WEBP up to 2MB)'}
                </Text>
              </View>

              <TextInput
                style={styles.input}
                placeholder="Phone number"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
              <TextInput
                style={styles.input}
                placeholder="Date of Birth (YYYY-MM-DD)"
                value={dob}
                onChangeText={setDob}
              />

              <View style={styles.pickerRow}>
                <Pressable style={styles.selectField} onPress={() => openSelection('gender')}>
                  <Text style={[styles.selectFieldText, !gender && styles.selectPlaceholder]}>
                    {gender || 'Select Gender'}
                  </Text>
                  <MaterialCommunityIcons name="chevron-down" size={18} color="#64748b" />
                </Pressable>
                <Pressable
                  style={[styles.selectField, { marginLeft: 12 }]}
                  onPress={() => openSelection('bloodGroup')}
                >
                  <Text style={[styles.selectFieldText, !bloodGroup && styles.selectPlaceholder]}>
                    {bloodGroup || 'Blood Group (optional)'}
                  </Text>
                  <MaterialCommunityIcons name="chevron-down" size={18} color="#64748b" />
                </Pressable>
              </View>

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
              <TextInput
                style={styles.input}
                placeholder="City"
                value={city}
                onChangeText={setCity}
              />
              <TextInput
                style={styles.input}
                placeholder="State"
                value={stateValue}
                onChangeText={setStateValue}
              />
              <TextInput
                style={styles.input}
                placeholder="Country"
                value={country}
                onChangeText={setCountry}
              />
              <TextInput
                style={styles.input}
                placeholder="ZIP / PIN"
                value={zip}
                onChangeText={setZip}
                keyboardType="number-pad"
              />
              <Pressable style={styles.fileButton} onPress={pickAddressProof}>
                <Text style={styles.fileButtonText}>
                  {addressProofUpload?.fileName || 'Choose Address Proof'}
                </Text>
              </Pressable>
              <Text style={styles.fileHelperText}>PDF, JPG, PNG, WEBP up to 5MB</Text>

              <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Emergency Contact</Text>
              <TextInput
                style={styles.input}
                placeholder="Name"
                value={emergencyName}
                onChangeText={setEmergencyName}
              />
              <View style={styles.pickerRow}>
                <Pressable
                  style={styles.selectField}
                  onPress={() => openSelection('emergencyRelation')}
                >
                  <Text
                    style={[
                      styles.selectFieldText,
                      !emergencyRelation && styles.selectPlaceholder,
                    ]}
                  >
                    {emergencyRelation || 'Relationship'}
                  </Text>
                  <MaterialCommunityIcons name="chevron-down" size={18} color="#64748b" />
                </Pressable>
                <TextInput
                  style={[styles.input, { flex: 1, marginLeft: 12 }]}
                  placeholder="Phone"
                  value={emergencyPhone}
                  onChangeText={setEmergencyPhone}
                  keyboardType="phone-pad"
                />
              </View>

              <Pressable style={styles.primaryButton} onPress={handleSave} disabled={saving}>
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>Save Profile</Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(selectionConfig)} transparent animationType="fade">
        <Pressable style={styles.selectionBackdrop} onPress={closeSelection}>
          <Pressable style={styles.selectionCard} onPress={() => undefined}>
            <View style={styles.selectionHeader}>
              <Text style={styles.selectionTitle}>{selectionConfig?.title || 'Select'}</Text>
              <Pressable onPress={closeSelection}>
                <MaterialCommunityIcons name="close" size={20} color="#0f172a" />
              </Pressable>
            </View>
            <ScrollView style={styles.selectionList} showsVerticalScrollIndicator={false}>
              {selectionConfig?.options.map((option) => {
                const selected = selectionConfig.value === option;
                return (
                  <Pressable
                    key={option}
                    style={[styles.selectionItem, selected && styles.selectionItemActive]}
                    onPress={() => handleSelection(option)}
                  >
                    <Text
                      style={[
                        styles.selectionItemText,
                        selected && styles.selectionItemTextActive,
                      ]}
                    >
                      {option}
                    </Text>
                    {selected ? (
                      <MaterialCommunityIcons name="check" size={18} color="#2563eb" />
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 120,
  },
  headerCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    minHeight: 116,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  headerAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 74,
    borderTopRightRadius: 26,
    borderBottomRightRadius: 26,
  },
  headerMain: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 116,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  photoWrap: {
    width: 62,
    height: 62,
    borderRadius: 31,
    overflow: 'hidden',
    marginLeft: 10,
    marginRight: 14,
    borderWidth: 3,
    borderColor: '#fff',
    backgroundColor: '#dbeafe',
    zIndex: 1,
  },
  photo: { width: '100%', height: '100%' },
  placeholder: {
    flex: 1,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: { fontSize: 24, color: '#3561f3', fontWeight: '700' },
  headerBody: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    paddingRight: 8,
  },
  headerText: { minWidth: 0 },
  headerName: { fontSize: 23, fontWeight: '800', color: '#1e293b' },
  headerSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  headerSubtitle: { flex: 1, fontSize: 11, color: '#64748b', fontWeight: '500' },
  editButton: {
    marginTop: 14,
    alignSelf: 'flex-start',
    minHeight: 38,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#2563eb',
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  editButtonText: { color: '#2563eb', fontWeight: '700', fontSize: 13 },
  detailCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    marginTop: 12,
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  cardSpacing: {
    marginTop: 16,
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#0f172a', marginBottom: 8 },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  detailLabel: { fontSize: 12, color: '#475569', flex: 1 },
  detailValue: { fontSize: 12, color: '#0f172a', fontWeight: '600', textAlign: 'right', flex: 1 },
  helperText: { marginTop: 8, fontSize: 12, color: '#475569' },
  errorText: { marginTop: 12, color: '#dc2626', textAlign: 'center' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.35)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    maxHeight: '90%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
  },
  modalContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 10 },
  closeBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: { marginTop: 12 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#475569', marginBottom: 6 },
  profilePicRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  profilePicWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginRight: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profilePicImage: {
    width: '100%',
    height: '100%',
    borderRadius: 32,
  },
  profilePicActions: { flex: 1, flexDirection: 'row', justifyContent: 'space-between' },
  uploadButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    flex: 1,
    alignItems: 'center',
    marginLeft: 4,
  },
  uploadButtonText: { fontSize: 12, fontWeight: '600', color: '#0f172a' },
  input: {
    height: 46,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    marginBottom: 10,
  },
  pickerRow: { flexDirection: 'row', marginBottom: 10 },
  selectField: {
    flex: 1,
    minHeight: 46,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectFieldText: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a',
  },
  selectPlaceholder: {
    color: '#94a3b8',
  },
  fileButton: {
    borderWidth: 1,
    borderColor: '#d7dbe3',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#fff',
    marginBottom: 6,
  },
  fileButtonText: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  fileHelperText: { fontSize: 11, color: '#64748b', marginBottom: 16 },
  primaryButton: {
    backgroundColor: '#2563eb',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 12,
  },
  primaryButtonText: { color: '#fff', fontWeight: '700' },
  selectionBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.35)',
    justifyContent: 'flex-end',
  },
  selectionCard: {
    maxHeight: '60%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
  },
  selectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  selectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  selectionList: {
    maxHeight: 320,
  },
  selectionItem: {
    minHeight: 48,
    borderRadius: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 10,
  },
  selectionItemActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  selectionItemText: {
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '500',
  },
  selectionItemTextActive: {
    color: '#1d4ed8',
    fontWeight: '700',
  },
});

export default ProfileScreen;
