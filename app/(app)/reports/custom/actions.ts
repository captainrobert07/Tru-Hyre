"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { savedReports } from "@/db/schema";
import { requireStaff } from "@/lib/rbac";
import { assertFeatureEnabled } from "@/lib/features";
import { logAudit } from "@/lib/audit";

// Allowed measures map to existing lib/metrics queries (bounded — no arbitrary SQL).
const MEASURES = ["source_effectiveness", "cycle_time", "vendor_sla", "recruiter_scoreboard", "bottlenecks", "location_mix"] as const;

export async function saveReportAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const user = await requireStaff();
  await assertFeatureEnabled("custom_report_builder");
  const name = ((formData.get("name") as string) || "").trim().slice(0, 120);
  const measure = (formData.get("measure") as string) || "";
  const days = Math.max(1, Math.min(3650, Number(formData.get("days")) || 90));
  if (name.length < 2) return { ok: false, error: "Name the report." };
  if (!(MEASURES as readonly string[]).includes(measure)) return { ok: false, error: "Pick a valid measure." };

  await db.insert(savedReports).values({ name, measure, days, createdById: Number(user.id) });
  await logAudit({
    actorId: Number(user.id), actorEmail: user.email, action: "create",
    targetType: "saved_report", summary: `Saved report "${name}" (${measure})`,
  });
  revalidatePath("/reports/custom");
  return { ok: true };
}
