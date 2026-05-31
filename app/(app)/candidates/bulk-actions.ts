"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { candidates, clientPackets, resumeFiles, stageHistory } from "@/db/schema";
import { logAudit } from "@/lib/audit";
import { deleteDriveFile } from "@/lib/drive";
import { requireStaff } from "@/lib/rbac";

const STAGES = ["received", "hr_review", "screening", "submitted", "shortlist", "interview", "hold", "offer", "joined", "rejected"] as const;

const bulkSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(500),
  action: z.enum(["set_stage", "assign_vendor", "delete"]),
  stage: z.enum(STAGES).optional(),
  vendorId: z.number().int().positive().nullable().optional(),
});

export async function bulkCandidateAction(input: unknown): Promise<{ ok: true; affected: number } | { ok: false; error: string }> {
  const user = await requireStaff();
  const parsed = bulkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  const { ids, action, stage, vendorId } = parsed.data;

  if (action === "set_stage") {
    if (!stage) return { ok: false, error: "Stage is required." };
    let affected = 0;
    for (const id of ids) {
      const cur = (await db.select({ stage: candidates.stage }).from(candidates).where(eq(candidates.id, id)))[0];
      if (!cur) continue;
      await db.update(candidates).set({ stage, updatedAt: new Date() }).where(eq(candidates.id, id));
      await db.insert(stageHistory).values({
        candidateId: id,
        fromStage: cur.stage,
        toStage: stage,
        changedById: Number(user.id),
        note: "Bulk action",
      });
      affected++;
    }
    await logAudit({
      actorId: Number(user.id),
      actorEmail: user.email,
      action: "update",
      targetType: "candidate",
      summary: `Bulk moved ${affected} candidates → ${stage}`,
    });
    revalidatePath("/candidates");
    return { ok: true, affected };
  }

  if (action === "assign_vendor") {
    let affected = 0;
    for (const id of ids) {
      await db
        .update(candidates)
        .set({ vendorAccountId: vendorId ?? null, updatedAt: new Date() })
        .where(eq(candidates.id, id));
      affected++;
    }
    await logAudit({
      actorId: Number(user.id),
      actorEmail: user.email,
      action: "update",
      targetType: "candidate",
      summary: `Bulk assigned vendor on ${affected} candidates`,
      meta: { vendorId: vendorId ?? null },
    });
    revalidatePath("/candidates");
    return { ok: true, affected };
  }

  if (action === "delete") {
    if (user.role !== "admin") return { ok: false, error: "Admin only." };
    let affected = 0;
    let blobsAttempted = 0;
    let blobsDeleted = 0;
    const blobErrors: { url: string; reason: string }[] = [];
    for (const id of ids) {
      const c = (await db.select().from(candidates).where(eq(candidates.id, id)))[0];
      if (!c) continue;
      const [resumes, packets] = await Promise.all([
        db.select().from(resumeFiles).where(eq(resumeFiles.candidateId, id)),
        db.select().from(clientPackets).where(eq(clientPackets.candidateId, id)),
      ]);
      for (const r of resumes) {
        blobsAttempted++;
        try { await deleteDriveFile(r.driveFileId); blobsDeleted++; }
        catch (e) { blobErrors.push({ url: r.driveFileId, reason: (e as Error).message || "unknown" }); }
      }
      for (const p of packets) {
        blobsAttempted++;
        try { await deleteDriveFile(p.driveFileId); blobsDeleted++; }
        catch (e) { blobErrors.push({ url: p.driveFileId, reason: (e as Error).message || "unknown" }); }
      }
      await db.delete(candidates).where(eq(candidates.id, id));
      affected++;
    }
    await logAudit({
      actorId: Number(user.id),
      actorEmail: user.email,
      action: "delete",
      targetType: "candidate",
      summary: `Bulk-deleted ${affected} candidates${blobErrors.length > 0 ? ` (${blobErrors.length} blob errors)` : ""}`,
      meta: { blobsAttempted, blobsDeleted, blobErrors: blobErrors.length > 0 ? blobErrors : undefined },
    });
    revalidatePath("/candidates");
    return { ok: true, affected };
  }

  return { ok: false, error: "Unknown action." };
}
