import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getApiWithToken, putApiWithToken } from "@/services/apiWrapper";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const PROFILE_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
const PROOF_MAX_BYTES = 5 * 1024 * 1024;
const PROFILE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const PROOF_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const RELATION_OPTIONS = [
  { label: "Father", value: "father" },
  { label: "Mother", value: "mother" },
  { label: "Spouse", value: "spouse" },
  { label: "Brother", value: "brother" },
  { label: "Sister", value: "sister" },
  { label: "Son", value: "son" },
  { label: "Daughter", value: "daughter" },
  { label: "Guardian", value: "guardian" },
  { label: "Friend", value: "friend" },
  { label: "Other", value: "other" }
];

const CompleteProfile = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [profilePreviewUrl, setProfilePreviewUrl] = useState("");

  const [form, setForm] = useState({
    phone: "",
    dob: "",
    gender: "",
    aadhaarNumber: "",
    panNumber: "",
    address: {
      line1: "",
      line2: "",
      city: "",
      state: "",
      country: "",
      zip: ""
    },
    emergencyContacts: [
      { name: "", relation: "", phone: "" }
    ],
    profileImageUpload: null as null | { fileName: string; mimeType: string; base64Data: string },
    addressProofUpload: null as null | { fileName: string; mimeType: string; base64Data: string },
    aadhaarProofUpload: null as null | { fileName: string; mimeType: string; base64Data: string },
    panProofUpload: null as null | { fileName: string; mimeType: string; base64Data: string }
  });

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || "");
        const base64 = result.includes(",") ? result.split(",")[1] : result;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const validateFile = (file: File, allowedTypes: string[], maxBytes: number, label: string) => {
    if (!allowedTypes.includes(file.type)) {
      toast.error(`Invalid ${label} format`);
      return false;
    }
    if (file.size > maxBytes) {
      toast.error(`${label} size should be under ${Math.floor(maxBytes / (1024 * 1024))}MB`);
      return false;
    }
    return true;
  };

  const fetchProfile = async () => {
    const res = await getApiWithToken("/employees/me");
    if (res?.success) {
      setProfile(res.data);
      setForm((prev) => ({
        ...prev,
        phone: res.data.phone || "",
        dob: res.data.dob ? new Date(res.data.dob).toISOString().slice(0, 10) : "",
        gender: res.data.gender || "",
        aadhaarNumber: res.data.aadhaarNumber || "",
        panNumber: res.data.panNumber || "",
        address: res.data.address || prev.address
      }));
    }
  };


  useEffect(() => {
    fetchProfile();
  }, []);

  const handleSubmit = async () => {
    if (!form.phone || !form.dob || !form.gender) {
      toast.error("Phone, DOB and gender are required");
      return;
    }
    if (!/^\d{12}$/.test(form.aadhaarNumber.trim())) {
      toast.error("Aadhaar number must be 12 digits");
      return;
    }
    if (!/^[A-Za-z]{5}[0-9]{4}[A-Za-z]{1}$/.test(form.panNumber.trim())) {
      toast.error("PAN number format is invalid");
      return;
    }
    if (
      !form.address.line1.trim()
      || !form.address.city.trim()
      || !form.address.state.trim()
      || !form.address.country.trim()
      || !form.address.zip.trim()
    ) {
      toast.error("Address Line 1, City, State, Country and Zip are required");
      return;
    }
    if (!form.addressProofUpload && !profile?.addressProof?.fileUrl) {
      toast.error("Address proof is required");
      return;
    }
    if (!form.aadhaarProofUpload && !profile?.aadhaarProof?.fileUrl) {
      toast.error("Aadhaar proof upload is required");
      return;
    }
    if (!form.panProofUpload && !profile?.panProof?.fileUrl) {
      toast.error("PAN proof upload is required");
      return;
    }
    const emergency = form.emergencyContacts[0];
    const hasEmergencyValue = Boolean(emergency?.name || emergency?.relation || emergency?.phone);
    if (hasEmergencyValue) {
      if (!emergency?.name || !emergency?.relation || !emergency?.phone) {
        toast.error("Complete all emergency contact fields");
        return;
      }
      if (!/^[A-Za-z ]{2,50}$/.test(emergency.name.trim())) {
        toast.error("Emergency contact name should contain only letters (2-50 chars)");
        return;
      }
      if (!/^\d{10}$/.test(emergency.phone.trim())) {
        toast.error("Emergency contact mobile number must be 10 digits");
        return;
      }
    }

    setLoading(true);
    const payload = {
      phone: form.phone,
      dob: form.dob,
      gender: form.gender,
      aadhaarNumber: form.aadhaarNumber.trim(),
      panNumber: form.panNumber.trim().toUpperCase(),
      address: form.address,
      emergencyContacts: form.emergencyContacts.filter((c) => c.name && c.relation && c.phone),
      profileImageUpload: form.profileImageUpload || undefined,
      addressProofUpload: form.addressProofUpload || undefined,
      aadhaarProofUpload: form.aadhaarProofUpload || undefined,
      panProofUpload: form.panProofUpload || undefined
    };

    const res = await putApiWithToken("/employees/me/profile", payload);
    setLoading(false);
    if (res?.success) {
      toast.success("Profile completed");
      navigate("/", { replace: true });
    } else {
      toast.error(res?.message || "Failed to save profile");
    }
  };

  return (
    <MainLayout title="Complete Profile" breadcrumb={[{ label: "Home" }, { label: "Complete Profile" }]}>
      <div className="bg-card rounded-xl card-shadow p-6 max-w-3xl">
        <div className="mb-6">
          <h2 className="text-xl font-semibold">Welcome{profile?.firstName ? `, ${profile.firstName}` : ""}</h2>
          <p className="text-sm text-muted-foreground">
            Please complete your profile to access the system.
          </p>
          {(profilePreviewUrl || profile?.profileImage) && (
            <img
              src={profilePreviewUrl || profile?.profileImage}
              alt="Profile preview"
              className="mt-4 h-20 w-20 rounded-full object-cover border"
            />
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            placeholder="Work Email"
            value={profile?.userId?.email || ""}
            disabled
          />
          <Input
            placeholder="First Name"
            value={profile?.firstName || ""}
            disabled
          />
          <Input
            placeholder="Last Name"
            value={profile?.lastName || ""}
            disabled
          />
          <Input
            placeholder="Phone"
            validationType="phone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <Input
            type="date"
            placeholder="Date of Birth"
            value={form.dob}
            onChange={(e) => setForm({ ...form, dob: e.target.value })}
          />
          <Input
            placeholder="Gender"
            value={form.gender}
            onChange={(e) => setForm({ ...form, gender: e.target.value })}
          />
          <Input
            placeholder="Aadhaar Number"
            value={form.aadhaarNumber}
            onChange={(e) => setForm({ ...form, aadhaarNumber: e.target.value.replace(/\D/g, "").slice(0, 12) })}
          />
          <Input
            placeholder="PAN Number"
            value={form.panNumber}
            onChange={(e) => setForm({ ...form, panNumber: e.target.value.toUpperCase() })}
          />
          <Input
            placeholder="Department"
            value={profile?.departmentId?.name || ""}
            disabled
          />
          <Input
            placeholder="Designation"
            value={profile?.designationId?.name || ""}
            disabled
          />
          <Input
            placeholder="Employment Type"
            value={profile?.employmentType || ""}
            disabled
          />
          <Input
            placeholder="Date of Joining"
            value={profile?.dateOfJoining ? new Date(profile.dateOfJoining).toISOString().slice(0, 10) : ""}
            disabled
          />
          <Input
            placeholder="Reporting Manager"
            value={
              profile?.managerId
                ? `${profile.managerId.firstName || ""} ${profile.managerId.lastName || ""}`.trim()
                : ""
            }
            disabled
          />
          <Input
            placeholder="Address Line 1"
            value={form.address.line1}
            onChange={(e) => setForm({ ...form, address: { ...form.address, line1: e.target.value } })}
          />
          <Input
            placeholder="Address Line 2 (optional)"
            value={form.address.line2}
            onChange={(e) => setForm({ ...form, address: { ...form.address, line2: e.target.value } })}
          />
          <Input
            placeholder="City"
            value={form.address.city}
            onChange={(e) => setForm({ ...form, address: { ...form.address, city: e.target.value } })}
          />
          <Input
            placeholder="State"
            value={form.address.state}
            onChange={(e) => setForm({ ...form, address: { ...form.address, state: e.target.value } })}
          />
          <Input
            placeholder="Country"
            value={form.address.country}
            onChange={(e) => setForm({ ...form, address: { ...form.address, country: e.target.value } })}
          />
          <Input
            placeholder="Zip"
            value={form.address.zip}
            onChange={(e) => setForm({ ...form, address: { ...form.address, zip: e.target.value } })}
          />
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">Profile Picture</label>
            <Input
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (!validateFile(file, PROFILE_IMAGE_TYPES, PROFILE_IMAGE_MAX_BYTES, "Profile image")) return;
                const base64Data = await fileToBase64(file);
                setProfilePreviewUrl(URL.createObjectURL(file));
                setForm({
                  ...form,
                  profileImageUpload: {
                    fileName: file.name,
                    mimeType: file.type,
                    base64Data
                  }
                });
              }}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">Address Proof (required)</label>
            <Input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (!validateFile(file, PROOF_TYPES, PROOF_MAX_BYTES, "Address proof")) return;
                const base64Data = await fileToBase64(file);
                setForm({
                  ...form,
                  addressProofUpload: {
                    fileName: file.name,
                    mimeType: file.type,
                    base64Data
                  }
                });
              }}
            />
            {form.addressProofUpload?.fileName && (
              <p className="text-xs text-muted-foreground">{form.addressProofUpload.fileName}</p>
            )}
            {!form.addressProofUpload?.fileName && profile?.addressProof?.fileName && (
              <p className="text-xs text-muted-foreground">Current: {profile.addressProof.fileName}</p>
            )}
          </div>
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">Aadhaar Proof (required)</label>
            <Input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (!validateFile(file, PROOF_TYPES, PROOF_MAX_BYTES, "Aadhaar proof")) return;
                const base64Data = await fileToBase64(file);
                setForm({
                  ...form,
                  aadhaarProofUpload: {
                    fileName: file.name,
                    mimeType: file.type,
                    base64Data
                  }
                });
              }}
            />
            {form.aadhaarProofUpload?.fileName && (
              <p className="text-xs text-muted-foreground">{form.aadhaarProofUpload.fileName}</p>
            )}
            {!form.aadhaarProofUpload?.fileName && profile?.aadhaarProof?.fileName && (
              <p className="text-xs text-muted-foreground">Current: {profile.aadhaarProof.fileName}</p>
            )}
          </div>
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">PAN Proof (required)</label>
            <Input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (!validateFile(file, PROOF_TYPES, PROOF_MAX_BYTES, "PAN proof")) return;
                const base64Data = await fileToBase64(file);
                setForm({
                  ...form,
                  panProofUpload: {
                    fileName: file.name,
                    mimeType: file.type,
                    base64Data
                  }
                });
              }}
            />
            {form.panProofUpload?.fileName && (
              <p className="text-xs text-muted-foreground">{form.panProofUpload.fileName}</p>
            )}
            {!form.panProofUpload?.fileName && profile?.panProof?.fileName && (
              <p className="text-xs text-muted-foreground">Current: {profile.panProof.fileName}</p>
            )}
          </div>
        </div>

        <div className="mt-6">
          <h3 className="text-md font-semibold mb-2">Emergency Contact (optional)</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              placeholder="Name"
              validationType="name"
              value={form.emergencyContacts[0].name}
              onChange={(e) =>
                setForm({
                  ...form,
                  emergencyContacts: [{ ...form.emergencyContacts[0], name: e.target.value }]
                })
              }
            />
            <Select
              value={form.emergencyContacts[0].relation || ""}
              onValueChange={(value) =>
                setForm({
                  ...form,
                  emergencyContacts: [{ ...form.emergencyContacts[0], relation: value }]
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Relationship" />
              </SelectTrigger>
              <SelectContent>
                {RELATION_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Mobile Number"
              validationType="phone"
              value={form.emergencyContacts[0].phone}
              onChange={(e) =>
                setForm({
                  ...form,
                  emergencyContacts: [{ ...form.emergencyContacts[0], phone: e.target.value }]
                })
              }
            />
          </div>
        </div>

        <div className="mt-8">
          <Button onClick={handleSubmit} disabled={loading}>
            Save and Continue
          </Button>
        </div>
      </div>
    </MainLayout>
  );
};

export default CompleteProfile;
