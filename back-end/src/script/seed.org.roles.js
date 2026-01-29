require("dotenv").config();

const mongoose = require("mongoose");
const Organization = require("../modules/organizations/organization.model");
const Role = require("../modules/roles/role.model");
const Permission = require("../modules/permissions/permission.model");

(async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI not found");
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB connected");

    /**
     * Fetch all NON-SYSTEM organizations
     */
    const organizations = await Organization.find({
      code: { $ne: "SYSTEM" }
    });

    if (!organizations.length) {
      console.log("⚠️ No organizations found (excluding SYSTEM)");
      process.exit(0);
    }

    for (const org of organizations) {
      console.log(`\n🔹 Seeding roles & permissions for org: ${org.name}`);

      /**
       * 1️⃣ Ensure wildcard ALL_ACCESS permission exists
       */
      let allAccessPermission = await Permission.findOne({
        code: "*",
        organizationId: org._id
      });

      if (!allAccessPermission) {
        allAccessPermission = await Permission.create({
          name: "ALL_ACCESS",
          code: "*",
          module: "ORG",
          organizationId: org._id
        });
        console.log("   ✅ Permission created: * (ALL_ACCESS)");
      } else {
        console.log("   ⚠️ Permission already exists: * (ALL_ACCESS)");
      }

      /**
       * 2️⃣ Ensure standard org permissions exist (for HR, etc.)
       */
      const permissionCodes = [
        "ORG_MANAGE",
        "USER_CREATE",
        "USER_VIEW",
        "USER_EDIT",
        "USER_DELETE"
      ];

      const orgPermissions = [];

      for (const code of permissionCodes) {
        let permission = await Permission.findOne({
          code,
          organizationId: org._id
        });

        if (!permission) {
          permission = await Permission.create({
            name: code,
            code,
            module: "ORG",
            organizationId: org._id
          });
          console.log(`   ✅ Permission created: ${code}`);
        }

        orgPermissions.push(permission);
      }

      /**
       * 3️⃣ OrgAdmin → FULL ACCESS via wildcard
       */
      await createRoleIfNotExists({
        name: "OrgAdmin",
        slug: "org-admin",
        permissionIds: [allAccessPermission._id],
        organizationId: org._id
      });

      /**
       * 4️⃣ HR → Limited permissions (no ORG_MANAGE)
       */
      await createRoleIfNotExists({
        name: "HR",
        slug: "hr",
        permissionIds: orgPermissions
          .filter(p => p.code !== "ORG_MANAGE")
          .map(p => p._id),
        organizationId: org._id
      });

      /**
       * 5️⃣ Employee → No permissions
       */
      await createRoleIfNotExists({
        name: "Employee",
        slug: "employee",
        permissionIds: [],
        organizationId: org._id
      });
    }

    console.log("\n🎉 Org roles & permissions seeded successfully");
    process.exit(0);

  } catch (err) {
    console.error("❌ Seeding failed:", err.message);
    process.exit(1);
  }
})();

/**
 * Helper: create role if missing
 */
async function createRoleIfNotExists({
  name,
  slug,
  permissionIds,
  organizationId
}) {
  const exists = await Role.findOne({ slug, organizationId });

  if (exists) {
    console.log(`   ⚠️ Role already exists: ${name}`);
    return;
  }

  await Role.create({
    name,
    slug,
    permissionIds,
    organizationId,
    isSystemRole: false
  });

  console.log(`   ✅ Role created: ${name}`);
}
