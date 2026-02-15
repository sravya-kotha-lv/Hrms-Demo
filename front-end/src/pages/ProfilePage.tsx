import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getApiWithToken, putApiWithToken } from "@/services/apiWrapper";
import { toast } from "sonner";
import { hasPermission } from "@/utils/auth";
import { useAuth } from "@/context/AuthContext";

const PROFILE_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
const ADDRESS_PROOF_MAX_BYTES = 5 * 1024 * 1024;
const PROFILE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ADDRESS_PROOF_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

const ProfilePage = () => {
  const { loadProfile } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const canEdit = hasPermission("EMP_SELF_EDIT");
  const [profilePreviewUrl, setProfilePreviewUrl] = useState("");
  const [profilePicInputKey, setProfilePicInputKey] = useState(0);

  const [form, setForm] = useState({
    phone: "",
    dob: "",
    gender: "",
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
    addressProofUpload: null as null | { fileName: string; mimeType: string; base64Data: string }
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
      setForm({
        phone: res.data.phone || "",
        dob: res.data.dob ? new Date(res.data.dob).toISOString().slice(0, 10) : "",
        gender: res.data.gender || "",
        address: res.data.address || {
          line1: "",
          line2: "",
          city: "",
          state: "",
          country: "",
          zip: ""
        },
        emergencyContacts: res.data.emergencyContacts?.length
          ? res.data.emergencyContacts
          : [{ name: "", relation: "", phone: "" }],
        profileImageUpload: null,
        addressProofUpload: null
      });
      setProfilePreviewUrl("");
      setProfilePicInputKey((v) => v + 1);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleSave = async () => {
    setLoading(true);
    const payload = {
      phone: form.phone,
      dob: form.dob,
      gender: form.gender,
      address: form.address,
      emergencyContacts: form.emergencyContacts.filter((c) => c.name && c.relation && c.phone),
      profileImageUpload: form.profileImageUpload || undefined,
      addressProofUpload: form.addressProofUpload || undefined
    };

    const res = await putApiWithToken("/employees/me/profile", payload);
    setLoading(false);
    if (res?.success) {
      toast.success("Profile updated");
      setOpen(false);
      await fetchProfile();
      await loadProfile();
    } else {
      toast.error(res?.message || "Update failed");
    }
  };

  return (
    <MainLayout title="My Profile" breadcrumb={[{ label: "Home" }, { label: "Profile" }]}>
      <div className="bg-card rounded-xl card-shadow p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">{profile?.firstName} {profile?.lastName}</h2>
            <p className="text-muted-foreground">{profile?.userId?.email}</p>
          </div>
          {(profilePreviewUrl || profile?.profileImage) && (
            <img
              src={profilePreviewUrl || profile?.profileImage}
              alt="Profile"
              className="h-14 w-14 rounded-full object-cover border"
            />
          )}
          <Button onClick={() => setOpen(true)} disabled={!canEdit}>Edit Profile</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl card-shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Employment Details</h3>
          <div className="space-y-2 text-sm">
            <div><span className="text-muted-foreground">Employee Code:</span> {profile?.employeeCode || "-"}</div>
            <div><span className="text-muted-foreground">Department:</span> {profile?.departmentId?.name || "-"}</div>
            <div><span className="text-muted-foreground">Designation:</span> {profile?.designationId?.name || "-"}</div>
            <div><span className="text-muted-foreground">Employment Type:</span> {profile?.employmentType || "-"}</div>
            <div><span className="text-muted-foreground">Date Of Joining:</span> {profile?.dateOfJoining ? new Date(profile.dateOfJoining).toLocaleDateString() : "-"}</div>
            <div><span className="text-muted-foreground">Reporting Manager:</span> {profile?.managerId ? `${profile.managerId.firstName || ""} ${profile.managerId.lastName || ""}`.trim() : "-"}</div>
          </div>
        </div>

        <div className="bg-card rounded-xl card-shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Personal Details</h3>
          <div className="space-y-2 text-sm">
            <div><span className="text-muted-foreground">Work Email:</span> {profile?.userId?.email || "-"}</div>
            <div><span className="text-muted-foreground">Phone:</span> {profile?.phone || "-"}</div>
            <div><span className="text-muted-foreground">DOB:</span> {profile?.dob ? new Date(profile.dob).toLocaleDateString() : "-"}</div>
            <div><span className="text-muted-foreground">Gender:</span> {profile?.gender || "-"}</div>
            <div><span className="text-muted-foreground">Address:</span> {profile?.address?.line1 || "-"}</div>
            <div>
              <span className="text-muted-foreground">Address Proof:</span>{" "}
              {profile?.addressProof?.fileUrl ? (
                <a href={profile.addressProof.fileUrl} className="text-primary underline" target="_blank" rel="noreferrer">
                  View
                </a>
              ) : "-"}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border p-3">
              <p className="text-sm font-medium mb-2">Profile Picture</p>
              <div className="flex items-center gap-3">
                <img
                  src={profilePreviewUrl || profile?.profileImage || "https://placehold.co/80x80?text=User"}
                  alt="Profile preview"
                  className="h-16 w-16 rounded-full object-cover border"
                />
                <div className="space-y-2">
                  <Input
                    key={profilePicInputKey}
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
                  <p className="text-xs text-muted-foreground">
                    JPG, PNG, WEBP up to 2MB
                  </p>
                  {form.profileImageUpload?.fileName && (
                    <p className="text-xs text-muted-foreground">{form.profileImageUpload.fileName}</p>
                  )}
                </div>
              </div>
            </div>
            <Input
              placeholder="Phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
            <Input
              type="date"
              placeholder="DOB"
              value={form.dob}
              onChange={(e) => setForm({ ...form, dob: e.target.value })}
            />
            <Input
              placeholder="Gender"
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value })}
            />
            <Input
              placeholder="Address Line 1"
              value={form.address.line1}
              onChange={(e) => setForm({ ...form, address: { ...form.address, line1: e.target.value } })}
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
            <Input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (!validateFile(file, ADDRESS_PROOF_TYPES, ADDRESS_PROOF_MAX_BYTES, "Address proof")) return;
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <Input
                placeholder="Emergency Contact Name"
                value={form.emergencyContacts[0]?.name || ""}
                onChange={(e) => setForm({
                  ...form,
                  emergencyContacts: [{ ...form.emergencyContacts[0], name: e.target.value }]
                })}
              />
              <Input
                placeholder="Relation"
                value={form.emergencyContacts[0]?.relation || ""}
                onChange={(e) => setForm({
                  ...form,
                  emergencyContacts: [{ ...form.emergencyContacts[0], relation: e.target.value }]
                })}
              />
              <Input
                placeholder="Phone"
                value={form.emergencyContacts[0]?.phone || ""}
                onChange={(e) => setForm({
                  ...form,
                  emergencyContacts: [{ ...form.emergencyContacts[0], phone: e.target.value }]
                })}
              />
            </div>

            <Button onClick={handleSave} disabled={loading}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default ProfilePage;
