import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { ArrowUpDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

export interface Column<T> {
  header: string;
  accessor: keyof T;
  sortable?: boolean;
  render?: (row: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  searchKey?: keyof T;
  rowKey: keyof T;
  selectable?: boolean;
  tableClassName?: string;
  renderHeader?: (columns: Column<T>[], selectable: boolean) => React.ReactNode;
  renderRow?: (row: T) => React.ReactNode;
  columnsCountOverride?: number;
  hideFooter?: boolean;
}

export function DataTable<T>({
  columns,
  data,
  searchKey,
  rowKey,
  selectable = false,
  tableClassName,
  renderHeader,
  renderRow,
  columnsCountOverride,
  hideFooter = false,
}: DataTableProps<T>) {
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState<{
    key: keyof T;
    direction: "asc" | "desc";
  } | null>(null);

  const filteredData = useMemo(() => {
    let filtered = [...data];

    if (search && searchKey) {
      filtered = filtered.filter((item) =>
        String(item[searchKey])
          .toLowerCase()
          .includes(search.toLowerCase())
      );
    }

    if (sortConfig) {
      filtered.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [data, search, sortConfig, searchKey]);

  const handleSort = (key: keyof T) => {
    setSortConfig((prev) => ({
      key,
      direction:
        prev?.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  return (
    <div className="bg-card rounded-xl border card-shadow">
      {/* 🔍 Header */}
      {searchKey && (
        <div className="p-4 border-b flex items-center">
          <Input
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-72"
          />
        </div>
      )}

      {/* 📋 Table */}
      <Table className={tableClassName}>
        <TableHeader>
          {renderHeader ? (
            renderHeader(columns, selectable)
          ) : (
            <TableRow className="bg-muted/40">
              {selectable && (
                <TableHead className="w-10">
                  <Checkbox />
                </TableHead>
              )}

              {columns.map((col) => (
                <TableHead
                  key={String(col.accessor)}
                  className={`text-muted-foreground font-medium ${
                    col.sortable ? "cursor-pointer" : ""
                  } ${col.className || ""}`}
                  onClick={() =>
                    col.sortable && handleSort(col.accessor)
                  }
                >
                  <div className="flex items-center gap-1">
                    {col.header}
                    {col.sortable && (
                      <ArrowUpDown className="w-4 h-4 opacity-60" />
                    )}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          )}
        </TableHeader>

        <TableBody>
          {filteredData.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={
                  columnsCountOverride ??
                  columns.length + (selectable ? 1 : 0)
                }
                className="text-center py-10 text-muted-foreground"
              >
                No data found
              </TableCell>
            </TableRow>
          )}

          {filteredData.map((row) =>
            renderRow ? (
              <TableRow
                key={String(row[rowKey])}
                className="hover:bg-muted/40 transition"
              >
                {renderRow(row)}
              </TableRow>
            ) : (
              <TableRow
                key={String(row[rowKey])}
                className="hover:bg-muted/40 transition"
              >
                {selectable && (
                  <TableCell>
                    <Checkbox />
                  </TableCell>
                )}

                {columns.map((col) => (
                  <TableCell
                    key={String(col.accessor)}
                    className={`py-4 ${col.className || ""}`}
                  >
                    {col.render
                      ? col.render(row)
                      : String(row[col.accessor])}
                  </TableCell>
                ))}
              </TableRow>
            )
          )}
        </TableBody>
      </Table>

      {/* 📌 Footer */}
      {!hideFooter && (
        <div className="px-4 py-3 text-sm text-muted-foreground border-t">
          Showing {filteredData.length} of {data.length} records
        </div>
      )}
    </div>
  );
}
