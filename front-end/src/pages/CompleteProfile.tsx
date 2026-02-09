import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getApiWithToken, putApiWithToken } from "@/services/apiWrapper";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const CompleteProfile = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);

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
    ]
  });

  const fetchProfile = async () => {
    const res = await getApiWithToken("/employees/me");
    if (res?.success) {
      setProfile(res.data);
      setForm((prev) => ({
        ...prev,
        phone: res.data.phone || "",
        dob: res.data.dob ? new Date(res.data.dob).toISOString().slice(0, 10) : "",
        gender: res.data.gender || "",
        address: res.data.address || prev.address
      }));
    }
  };


  useEffect(() => {
    fetchProfile();
  }, []);

  const handleSubmit = async () => {
    if (!form.phone || !form.dob || !form.gender) {
      toast.error("Phone, DOB, and gender are required");
      return;
    }
    setLoading(true);
    const payload = {
      phone: form.phone,
      dob: form.dob,
      gender: form.gender,
      address: form.address.line1 || form.address.city || form.address.state || form.address.country || form.address.zip
        ? form.address
        : undefined,
      emergencyContacts: form.emergencyContacts.filter((c) => c.name && c.relation && c.phone)
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
        </div>

        <div className="mt-6">
          <h3 className="text-md font-semibold mb-2">Emergency Contact (optional)</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              placeholder="Name"
              value={form.emergencyContacts[0].name}
              onChange={(e) =>
                setForm({
                  ...form,
                  emergencyContacts: [{ ...form.emergencyContacts[0], name: e.target.value }]
                })
              }
            />
            <Input
              placeholder="Relation"
              value={form.emergencyContacts[0].relation}
              onChange={(e) =>
                setForm({
                  ...form,
                  emergencyContacts: [{ ...form.emergencyContacts[0], relation: e.target.value }]
                })
              }
            />
            <Input
              placeholder="Phone"
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
