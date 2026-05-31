"use server";

import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { candidates, clientPackets, resumeFiles, stageHistory } from "@/db/schema";
import { logAudit } from "@/lib/audit";
import { deleteDriveFile } from "@/lib/drive";
import { fireStageTransitionEmail } from "@/lib/email-on-stage-change";
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
    const movedRows: Array<{ cur: typeof candidates.$inferSelect }> = [];
    for (const id of ids) {
      const cur = (await db.select().from(candidates).where(eq(candidates.id, id)))[0];
      if (!cur) continue;
      if (cur.stage === stage) continue;
      await db.update(candidates).set({ stage, updatedAt: new Date() }).where(eq(candidates.id, id));
      await db.insert(stageHistory).values({
        candidateId: id,
        fromStage: cur.stage,
        toStage: stage,
        changedById: Number(user.id),
        note: "Bulk action",
      });
      movedRows.push({ cur });
      affected++;
    }
    await logAudit({
      actorId: Number(user.id),
      actorEmail: user.email,
      action: "update",
      targetType: "candidate",
      summary: `Bulk moved ${affected} candidates → ${stage}`,
    });
    // Fire stage emails in parallel — each call already swallows its own
    // exceptions, so Promise.all never rejects. Bounds total wall-clock to
    // ~ slowest single send rather than affected × send-time.
    await Promise.all(
      movedRows.map(({ cur }) =>
        fireStageTransitionEmail({
          candidate: { id: cur.id, fullName: cur.fullName, email: cur.email, refId: cur.refId },
          fromStage: cur.stage,
          toStage: stage,
          actor: { id: Number(user.id), email: user.email, fullName: user.fullName },
        }),
      ),
    );
    revalidatePath("/candidates");
    return { ok: true, affected };
  }

  if (action === "assign_vendor") {
    const result = await db
      .update(candidates)
      .set({ vendorAccountId: vendorId ?? null, updatedAt: new Date() })
      .where(inArray(candidates.id, ids));
    const affected = (result as unknown as { rowCount?: number }).rowCount ?? ids.length;
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
    // Collect every Drive file across the batch in two queries (not 2N),
    // then delete in parallel. Old behaviour: 50 candidates × 2 files ×
    // ~200ms serial ≈ 20s; new: capped at one Drive RTT.
    const [allResumes, allPackets] = await Promise.all([
      db.select().from(resumeFiles).where(inArray(resumeFiles.candidateId, ids)),
      db.select().from(clientPackets).where(inArray(clientPackets.candidateId, ids)),
    ]);
    const driveTargets = [
      ...allResumes.map((r) => r.driveFileId),
      ...allPackets.map((p) => p.driveFileId),
    ];
    blobsAttempted = driveTargets.length;
    const deletes = await Promise.all(
      driveTargets.map((fid) =>
        deleteDriveFile(fid).then(
          () => ({ ok: true as const }),
          (e: Error) => ({ ok: false as const, fid, reason: e.message || "unknown" }),
        ),
      ),
    );
    for (const r of deletes) {
      if (r.ok) blobsDeleted++;
      else blobErrors.push({ url: r.fid, reason: r.reason });
    }
    // Hard-delete candidate rows in one statement; FKs cascade to
    // resume_files / client_packets / stage_history / submissions / etc.
    const present = (
      await db.select({ id: candidates.id }).from(candidates).where(inArray(candidates.id, ids))
    ).map((r) => r.id);
    if (present.length > 0) {
      await db.delete(candidates).where(inArray(candidates.id, present));
      affected = present.length;
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
