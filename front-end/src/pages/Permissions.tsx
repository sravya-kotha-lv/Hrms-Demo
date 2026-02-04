import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Checkbox } from "@/components/ui/checkbox";
import { getApiWithToken, putApiWithToken } from "@/services/apiWrapper";
import { toast } from "sonner";
import { TableCell, TableHead, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";

type RoleRow = {
  _id: string;
  name: string;
  slug: string;
  permissionIds: string[];
  isSystemRole?: boolean;
  [key: string]: any;
};

type Permission = {
  _id: string;
  code: string;
  name: string;
  module: string;
};

const Permissions = () => {
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [savingRoleIds, setSavingRoleIds] = useState<Set<string>>(new Set());
  const [dirtyRoleIds, setDirtyRoleIds] = useState<Set<string>>(new Set());
  const [rolePerms, setRolePerms] = useState<Record<string, string[]>>({});

  const fetchData = async () => {
    const [rolesRes, permsRes] = await Promise.all([
      getApiWithToken("/roles"),
      getApiWithToken("/permissions"),
    ]);

    if (rolesRes?.success || rolesRes?.code === 200) {
      setRoles(rolesRes.data || []);
    } else {
      toast.error(rolesRes?.message || "Failed to load roles");
    }

    if (permsRes?.success || permsRes?.code === 200) {
      setPermissions(permsRes.data || []);
    } else {
      toast.error(permsRes?.message || "Failed to load permissions");
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (roles.length > 0) {
      const map: Record<string, string[]> = {};
      roles.forEach((r) => {
        map[r._id] = [...(r.permissionIds || [])];
      });
      setRolePerms(map);
      setDirtyRoleIds(new Set());
    }
  }, [roles]);

  const updateRolePerms = (roleId: string, nextPerms: string[]) => {
    setRolePerms((prev) => ({ ...prev, [roleId]: nextPerms }));
    setDirtyRoleIds((prev) => new Set(prev).add(roleId));
  };

  const handleToggle = (role: RoleRow, perm: Permission) => {
    if (role.isSystemRole) {
      toast.warning("System roles cannot be edited");
      return;
    }

    const current = rolePerms[role._id] || [];
    const has = current.includes(perm._id);
    const updated = has
      ? current.filter((id) => id !== perm._id)
      : [...current, perm._id];

    updateRolePerms(role._id, updated);
  };

  const handleSelectAllRole = (role: RoleRow) => {
    if (role.isSystemRole) {
      toast.warning("System roles cannot be edited");
      return;
    }
    const allPermIds = permissions.map((p) => p._id);
    const current = rolePerms[role._id] || [];
    const next =
      current.length === allPermIds.length ? [] : allPermIds;
    updateRolePerms(role._id, next);
  };

  const handleSelectAllPermission = (perm: Permission) => {
    const nextPermsMap = { ...rolePerms };
    roles.forEach((role) => {
      if (role.isSystemRole) return;
      const current = nextPermsMap[role._id] || [];
      const has = current.includes(perm._id);
      nextPermsMap[role._id] = has
        ? current.filter((id) => id !== perm._id)
        : [...current, perm._id];
    });
    setRolePerms(nextPermsMap);
    setDirtyRoleIds(new Set(roles.filter(r => !r.isSystemRole).map(r => r._id)));
  };

  const handleSaveChanges = async () => {
    if (dirtyRoleIds.size === 0) {
      toast.message("No changes to save");
      return;
    }

    const roleIds = Array.from(dirtyRoleIds);
    setSavingRoleIds(new Set(roleIds));

    const results = await Promise.all(
      roleIds.map((roleId) =>
        putApiWithToken(`/roles/${roleId}`, {
          permissionIds: rolePerms[roleId] || [],
        })
      )
    );

    const failed = results.find((r) => !r?.success && r?.code !== 200);
    setSavingRoleIds(new Set());

    if (failed) {
      toast.error(failed?.message || "Failed to save changes");
      return;
    }

    toast.success("Permissions updated");
    fetchData();
  };

  const columns: Column<RoleRow>[] = useMemo(() => {
    const roleColumn: Column<RoleRow> = {
      header: "Role",
      accessor: "name",
      sortable: true,
      className: "sticky left-0 z-20 bg-card min-w-[240px] max-w-[260px]",
      render: (row) => (
        <div>
          <p className="font-medium">{row.name}</p>
          <p className="text-xs text-muted-foreground">{row.slug}</p>
        </div>
      ),
    };

    const permColumns: Column<RoleRow>[] = permissions.map((perm) => ({
      header: perm.code,
      accessor: perm.code as any,
      className: "min-w-[160px] text-center",
    }));

    return [roleColumn, ...permColumns];
  }, [permissions]);

  const groupedPermissions = useMemo(() => {
    const groups: Record<string, Permission[]> = {};
    permissions.forEach((p) => {
      const key = p.module || "Other";
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    });
    Object.values(groups).forEach((list) =>
      list.sort((a, b) => a.code.localeCompare(b.code))
    );
    return groups;
  }, [permissions]);

  const allPermIds = useMemo(() => permissions.map((p) => p._id), [permissions]);

  const renderHeader = () => {
    return (
      <>
        <TableRow className="bg-muted/40">
          <TableHead
            rowSpan={2}
            className="sticky left-0 z-30 bg-muted/40 min-w-[240px] max-w-[260px]"
          >
            Role
          </TableHead>
          {Object.entries(groupedPermissions).map(([module, perms]) => (
            <TableHead key={module} colSpan={perms.length} className="text-center">
              {module}
            </TableHead>
          ))}
        </TableRow>
        <TableRow className="bg-muted/40">
          {Object.entries(groupedPermissions).flatMap(([module, perms]) =>
            perms.map((perm) => {
              const editableRoles = roles.filter((r) => !r.isSystemRole);
              const checkedCount = editableRoles.filter((r) =>
                (rolePerms[r._id] || []).includes(perm._id)
              ).length;
              const allChecked =
                editableRoles.length > 0 && checkedCount === editableRoles.length;
              const indeterminate =
                checkedCount > 0 && checkedCount < editableRoles.length;
              return (
                <TableHead key={`${module}-${perm._id}`} className="text-center">
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-xs font-medium">{perm.code}</span>
                    <Checkbox
                      checked={indeterminate ? "indeterminate" : allChecked}
                      onCheckedChange={() => handleSelectAllPermission(perm)}
                      disabled={editableRoles.length === 0}
                    />
                  </div>
                </TableHead>
              );
            })
          )}
        </TableRow>
      </>
    );
  };

  const renderRow = (row: RoleRow) => {
    const current = rolePerms[row._id] || [];
    const isAll = current.length === allPermIds.length && allPermIds.length > 0;
    const isIndeterminate =
      current.length > 0 && current.length < allPermIds.length;
    const disabled = row.isSystemRole || savingRoleIds.has(row._id);

    return (
      <>
        <TableCell className="sticky left-0 z-20 bg-card min-w-[240px] max-w-[260px]">
          <div className="flex items-center gap-3">
            <Checkbox
              checked={isIndeterminate ? "indeterminate" : isAll}
              disabled={disabled}
              onCheckedChange={() => handleSelectAllRole(row)}
            />
            <div>
              <p className="font-medium">{row.name}</p>
              <p className="text-xs text-muted-foreground">{row.slug}</p>
            </div>
          </div>
        </TableCell>
        {Object.entries(groupedPermissions).flatMap(([module, perms]) =>
          perms.map((perm) => {
            const checked = current.includes(perm._id);
            return (
              <TableCell key={`${row._id}-${perm._id}`} className="text-center">
                <Checkbox
                  checked={checked}
                  disabled={disabled}
                  onCheckedChange={() => handleToggle(row, perm)}
                />
              </TableCell>
            );
          })
        )}
      </>
    );
  };

  return (
    <MainLayout
      title="Permissions"
      breadcrumb={[{ label: "Home", href: "/" }, { label: "Permissions" }]}
    >
      <div className="flex justify-end mb-4">
        <Button onClick={handleSaveChanges} disabled={savingRoleIds.size > 0}>
          Save Changes
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={roles}
        rowKey="_id"
        searchKey="name"
        tableClassName="min-w-[1200px]"
        renderHeader={renderHeader}
        renderRow={renderRow}
        columnsCountOverride={1 + permissions.length}
      />
    </MainLayout>
  );
};

export default Permissions;
