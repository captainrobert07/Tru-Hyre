/**
 * Granular per-user permission catalogue. Keys are a TS union (not a DB enum)
 * so adding one needs no migration. Stored per user in the user_permissions
 * table as a string[]. Admin bypasses all checks; these grants extend hr/hr_lite.
 */

export type PermissionKey =
  | "perm_manage_jobs"
  | "perm_manage_clients"
  | "perm_manage_vendors"
  | "perm_view_reports"
  | "perm_export_reports"
  | "perm_bulk_actions"
  | "perm_send_bulk_email"
  | "perm_manage_offers"
  | "perm_manage_interviews"
  | "perm_view_audit_log"
  | "perm_manage_webhooks"
  | "perm_manage_api_keys"
  | "perm_gdpr_tools"
  | "perm_approve_requisitions"
  | "perm_delete_candidates";

export type PermissionDef = { key: PermissionKey; label: string; category: string };

export const PERMISSIONS: PermissionDef[] = [
  { key: "perm_manage_jobs", label: "Manage jobs", category: "Pipeline" },
  { key: "perm_manage_clients", label: "Manage clients", category: "Accounts" },
  { key: "perm_manage_vendors", label: "Manage vendors", category: "Accounts" },
  { key: "perm_view_reports", label: "View reports", category: "Analytics" },
  { key: "perm_export_reports", label: "Export reports", category: "Analytics" },
  { key: "perm_bulk_actions", label: "Bulk actions", category: "Pipeline" },
  { key: "perm_send_bulk_email", label: "Send bulk email", category: "Communication" },
  { key: "perm_manage_offers", label: "Manage offers", category: "Pipeline" },
  { key: "perm_manage_interviews", label: "Manage interviews", category: "Pipeline" },
  { key: "perm_view_audit_log", label: "View audit log", category: "Platform" },
  { key: "perm_manage_webhooks", label: "Manage webhooks", category: "Platform" },
  { key: "perm_manage_api_keys", label: "Manage API keys", category: "Platform" },
  { key: "perm_gdpr_tools", label: "GDPR tools", category: "Platform" },
  { key: "perm_approve_requisitions", label: "Approve requisitions", category: "Pipeline" },
  { key: "perm_delete_candidates", label: "Delete candidates", category: "Pipeline" },
];

export const PERMISSION_MAP: Record<string, PermissionDef> = Object.fromEntries(
  PERMISSIONS.map((p) => [p.key, p]),
);

export function isValidPermissionKey(k: string): k is PermissionKey {
  return k in PERMISSION_MAP;
}
