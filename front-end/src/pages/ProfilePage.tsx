import { useEffect, useRef, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getApiWithToken, putApiWithToken } from "@/services/apiWrapper";
import { toast } from "sonner";
import { hasPermission } from "@/utils/auth";
import { useAuth } from "@/context/AuthContext";
import { PageLoader } from "@/components/ui/loaders";
import { formatDateInOrgTimeZone } from "@/utils/timezone";

const PROFILE_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
const ADDRESS_PROOF_MAX_BYTES = 5 * 1024 * 1024;
const PROFILE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ADDRESS_PROOF_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
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
const ID_CARD_FRONT_SKELETON = (import.meta as any).env?.VITE_IDCARD_FRONT_SKELETON || "/idcard_front.jpg";
const ID_CARD_BACK_SKELETON = (import.meta as any).env?.VITE_IDCARD_BACK_SKELETON || "/idcard_back.jpg";

const ProfilePage = () => {
  const { loadProfile } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const canEdit = hasPermission("EMP_SELF_EDIT");
  const [idCardSide, setIdCardSide] = useState<"front" | "back">("front");
  const idCardRef = useRef<HTMLDivElement | null>(null);
  const [exportingBothPdf, setExportingBothPdf] = useState(false);
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
    setProfileLoading(true);
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
    setProfileLoading(false);
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  if (profileLoading) {
    return (
      <MainLayout title="My Profile" breadcrumb={[{ label: "Home" }, { label: "Profile" }]}>
        <PageLoader label="Loading your profile..." />
      </MainLayout>
    );
  }

  const handleSave = async () => {
    if (form.address?.zip?.trim() && !/^\d+$/.test(form.address.zip.trim())) {
      toast.error("PIN/Zip code must contain only numbers");
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

  const collectDocumentCssText = () => {
    let cssText = "";
    for (const styleSheet of Array.from(document.styleSheets)) {
      try {
        const rules = styleSheet.cssRules;
        for (const rule of Array.from(rules)) {
          cssText += `${rule.cssText}\n`;
        }
      } catch (_) {
        // Ignore CORS-restricted stylesheets.
      }
    }
    return cssText;
  };

  const captureIdCardPngDataUrl = async () => {
    const cardNode = idCardRef.current;
    if (!cardNode) throw new Error("ID card not found");

    const rect = cardNode.getBoundingClientRect();
    const width = Math.ceil(rect.width);
    const height = Math.ceil(rect.height);
    const cssText = collectDocumentCssText();
    const clonedNode = cardNode.cloneNode(true) as HTMLDivElement;
    clonedNode.style.margin = "0";

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
        <foreignObject width="100%" height="100%">
          <div xmlns="http://www.w3.org/1999/xhtml">
            <style>${cssText}</style>
            ${clonedNode.outerHTML}
          </div>
        </foreignObject>
      </svg>
    `;

    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.decoding = "async";
    image.src = url;

    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Image render failed"));
    });

    const canvas = document.createElement("canvas");
    canvas.width = width * 2;
    canvas.height = height * 2;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas context unavailable");
    ctx.scale(2, 2);
    ctx.drawImage(image, 0, 0, width, height);
    URL.revokeObjectURL(url);

    return canvas.toDataURL("image/png");
  };

  const waitForCardRender = async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  };

  const downloadIdCardPng = async () => {
    try {
      const pngDataUrl = await captureIdCardPngDataUrl();
      const link = document.createElement("a");
      link.href = pngDataUrl;
      link.download = `${(profile?.employeeCode || "employee-id-card").toLowerCase()}-${idCardSide}.png`;
      link.click();
      toast.success("ID card PNG downloaded");
    } catch (error) {
      toast.error("Unable to download PNG for this card");
    }
  };

  const downloadIdCardPdf = () => {
    const cardNode = idCardRef.current;
    if (!cardNode) return;

    const printWindow = window.open("", "_blank", "noopener,noreferrer,width=900,height=1000");
    if (!printWindow) {
      toast.error("Popup blocked. Please allow popups to download PDF.");
      return;
    }

    const cssText = collectDocumentCssText();
    printWindow.document.write(`
      <html>
        <head>
          <title>ID Card PDF</title>
          <style>${cssText}</style>
          <style>
            body { margin: 0; padding: 24px; display: flex; justify-content: center; align-items: flex-start; background: #ffffff; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>${cardNode.outerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 300);
  };

  const downloadBothSidesPdf = async () => {
    const previousSide = idCardSide;
    try {
      setExportingBothPdf(true);

      setIdCardSide("front");
      await waitForCardRender();
      const frontPng = await captureIdCardPngDataUrl();

      setIdCardSide("back");
      await waitForCardRender();
      const backPng = await captureIdCardPngDataUrl();

      setIdCardSide(previousSide);
      await waitForCardRender();

      const printWindow = window.open("", "_blank", "noopener,noreferrer,width=900,height=1200");
      if (!printWindow) {
        toast.error("Popup blocked. Please allow popups to download PDF.");
        return;
      }

      printWindow.document.write(`
        <html>
          <head>
            <title>ID Card Both Sides</title>
            <style>
              body { margin: 0; padding: 20px; background: #fff; font-family: Arial, sans-serif; }
              .page { page-break-after: always; display: flex; justify-content: center; align-items: flex-start; }
              .page:last-child { page-break-after: auto; }
              .card { width: min(390px, 100%); border: 1px solid #e5e7eb; border-radius: 14px; overflow: hidden; }
              .label { margin: 0 0 8px; text-align: center; color: #0b3d66; font-weight: 700; font-size: 14px; }
              img { display: block; width: 100%; height: auto; }
              @media print { body { padding: 0; } }
            </style>
          </head>
          <body>
            <div class="page">
              <div>
                <p class="label">Front Side</p>
                <div class="card"><img src="${frontPng}" alt="ID Card Front" /></div>
              </div>
            </div>
            <div class="page">
              <div>
                <p class="label">Back Side</p>
                <div class="card"><img src="${backPng}" alt="ID Card Back" /></div>
              </div>
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 300);
    } catch (error) {
      setIdCardSide(previousSide);
      toast.error("Unable to generate both sides PDF");
    } finally {
      setExportingBothPdf(false);
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
            <div><span className="text-muted-foreground">Date Of Joining:</span> {profile?.dateOfJoining ? formatDateInOrgTimeZone(profile.dateOfJoining) : "-"}</div>
            <div><span className="text-muted-foreground">Reporting Manager:</span> {profile?.managerId ? `${profile.managerId.firstName || ""} ${profile.managerId.lastName || ""}`.trim() : "-"}</div>
          </div>
        </div>

        <div className="bg-card rounded-xl card-shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Personal Details</h3>
          <div className="space-y-2 text-sm">
            <div><span className="text-muted-foreground">Work Email:</span> {profile?.userId?.email || "-"}</div>
            <div><span className="text-muted-foreground">Phone:</span> {profile?.phone || "-"}</div>
            <div><span className="text-muted-foreground">DOB:</span> {profile?.dob ? formatDateInOrgTimeZone(profile.dob) : "-"}</div>
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

      <div className="bg-card rounded-xl card-shadow p-6 mt-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h3 className="text-lg font-semibold">Employee ID Card</h3>
            <p className="text-sm text-muted-foreground">Digital card for employee identification</p>
          </div>
          <div className="inline-flex rounded-lg border p-1 bg-muted/40">
            <Button
              size="sm"
              variant={idCardSide === "front" ? "default" : "ghost"}
              onClick={() => setIdCardSide("front")}
            >
              Front
            </Button>
            <Button
              size="sm"
              variant={idCardSide === "back" ? "default" : "ghost"}
              onClick={() => setIdCardSide("back")}
            >
              Back
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={downloadIdCardPng}>Download PNG</Button>
            <Button size="sm" onClick={downloadIdCardPdf}>Download PDF</Button>
            <Button size="sm" variant="secondary" onClick={downloadBothSidesPdf} disabled={exportingBothPdf}>
              {exportingBothPdf ? "Preparing..." : "Download Both Sides PDF"}
            </Button>
          </div>
        </div>

        <div className="mx-auto max-w-[390px]">
          <div
            ref={idCardRef}
            className="relative overflow-hidden rounded-[18px] border-[4px] border-[#0f4a79] bg-[#edf2f8] w-[360px] h-[604px]"
          >
            <img
              src={idCardSide === "front" ? ID_CARD_FRONT_SKELETON : ID_CARD_BACK_SKELETON}
              alt={idCardSide === "front" ? "ID card front skeleton" : "ID card back skeleton"}
              className="absolute inset-0 w-full h-full object-cover"
            />

            <div className="relative z-10 h-full">
              {idCardSide === "front" ? (
                <>
                  {(profilePreviewUrl || profile?.profileImage) && (
                    <div className="absolute left-[22.5%] top-[24.3%] w-[51.0%] h-[37.2%] overflow-hidden">
                      <img
                        src={profilePreviewUrl || profile?.profileImage}
                        alt="ID profile"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  <div className="absolute left-[10%] right-[10%] top-[64.5%] h-[11%] rounded-sm" />
                  <div className="absolute left-[8%] right-[8%] top-[64.9%] text-center">
                    <p className="text-[#0a4874] text-[17px] sm:text-[19px] font-extrabold uppercase tracking-[0.6px] leading-tight">
                      {`${profile?.firstName || ""} ${profile?.lastName || ""}`.trim() || "Employee Name"}
                    </p>
                    <p className="text-[#0a4874] text-[13px] sm:text-[14px] font-bold uppercase mt-1 leading-tight">
                      {profile?.designationId?.name || "Designation"}
                    </p>
                  </div>

                  <div className="absolute left-[50.5%] right-[8%] top-[75.2%] h-[13.5%] rounded-sm" />
                  <div className="absolute left-[53.2%] top-[75.2%] text-[#0a4874] text-[12px] sm:text-[13px] font-medium leading-[1.78]">
                    <p>{profile?.employeeCode || "-"}</p>
                    <p>{profile?.phone || "-"}</p>
                    <p>{profile?.emergencyContacts?.[0]?.phone || "-"}</p>
                    <p>{profile?.bloodGroup || "-"}</p>
                  </div>

                </>
              ) : (
                <></>
              )}
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
              validationType="phone"
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
              inputMode="numeric"
              onChange={(e) => setForm({
                ...form,
                address: { ...form.address, zip: e.target.value.replace(/\D/g, "") }
              })}
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
              <Select
                value={form.emergencyContacts[0]?.relation || ""}
                onValueChange={(value) => setForm({
                  ...form,
                  emergencyContacts: [{ ...form.emergencyContacts[0], relation: value }]
                })}
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
