require("dotenv").config();

const mongoose = require("mongoose");
const User = require("../modules/users/user.model");
const Role = require("../modules/roles/role.model");
const Permission = require("../modules/permissions/permission.model");
const Organization = require("../modules/organizations/organization.model");
const OrgUser = require("../modules/organizations/org-user.model");
const { genHashedPassword } = require("../utils/bcryptUtils");

(async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI not found in environment variables");
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB connected");

    // 🔒 Prevent duplicate bootstrap
    const existingSuperAdmin = await User.findOne({
      email: "superadmin@luvetha.com"
    });

    if (existingSuperAdmin) {
      console.log("⚠️ SuperAdmin already exists. Bootstrap skipped.");
      process.exit(0);
    }

    /**
     * 1️⃣ CREATE SYSTEM ORGANIZATION
     */
    const systemOrg = await Organization.create({
      name: "SYSTEM",
      code: "SYSTEM",
      timezone: "UTC",
      currency: "USD",
      status: "active"
    });

    /**
     * 2️⃣ CREATE SYSTEM PERMISSION (*)
     */
    const systemPermission = await Permission.create({
      name: "ALL_ACCESS",
      code: "*",
      module: "SYSTEM",
      organizationId: systemOrg._id
    });

    /**
     * 3️⃣ CREATE SUPERADMIN ROLE
     */
    const superAdminRole = await Role.create({
      name: "SuperAdmin",
      slug: "superadmin",
      permissionIds: [systemPermission._id],
      isSystemRole: true,
      organizationId: systemOrg._id
    });

    /**
     * 4️⃣ CREATE SUPERADMIN USER
     */
    const superAdmin = await User.create({
      email: "superadmin@luvetha.com",
      password: await genHashedPassword("SuperAdmin@123"),
      organizationIds: [systemOrg._id],
      activeOrganizationId: systemOrg._id,
      status: "active"
    });

    /**
     * 5️⃣ MAP USER → ORG → ROLE
     */
    await OrgUser.create({
      userId: superAdmin._id,
      organizationId: systemOrg._id,
      roleIds: [superAdminRole._id]
    });

    console.log("🎉 SYSTEM BOOTSTRAPPED SUCCESSFULLY");
    console.log("----------------------------------");
    console.log("SYSTEM ORG ID        :", systemOrg._id.toString());
    console.log("SuperAdmin Email     : superadmin@luvetha.com");
    console.log("SuperAdmin Password  : SuperAdmin@123");
    console.log("Role                 : SuperAdmin");

    process.exit(0);
  } catch (err) {
    console.error("❌ Bootstrap failed:", err.message);
    process.exit(1);
  }
})();
