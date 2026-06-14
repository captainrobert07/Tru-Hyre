"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { jobs, clientAccounts } from "@/db/schema";
import { requireStaff } from "@/lib/rbac";
import { assertFeatureEnabled } from "@/lib/features";
import { postJobToBoard } from "@/lib/connectors";
import { logAudit } from "@/lib/audit";

const _schema = z.number().int().positive();

/**
 * Post an open job to the configured job-board endpoint. Builds a clean,
 * board-agnostic payload from the job row and delegates delivery to
 * postJobToBoard (one configured webhook). Returns a user-facing result.
 */
export async function postJobToBoardAction(jobId: number): Promise<{ ok: boolean; message: string }> {
  const user = await requireStaff();
  await assertFeatureEnabled("job_board_posting");
  if (!_schema.safeParse(jobId).success) return { ok: false, message: "Invalid job." };

  const j = (
    await db
      .select({
        id: jobs.id,
        title: jobs.title,
        status: jobs.status,
        location: jobs.location,
        workMode: jobs.workMode,
        description: jobs.description,
        skills: jobs.skills,
        experienceMin: jobs.experienceMin,
        experienceMax: jobs.experienceMax,
        clientName: clientAccounts.name,
      })
      .from(jobs)
      .leftJoin(clientAccounts, eq(jobs.clientAccountId, clientAccounts.id))
      .where(eq(jobs.id, jobId))
  )[0];
  if (!j) return { ok: false, message: "Job not found." };
  if (j.status !== "open") return { ok: false, message: "Only open jobs can be posted." };

  const result = await postJobToBoard({
    jobId: j.id,
    title: j.title,
    company: j.clientName,
    location: j.location,
    workMode: j.workMode,
    description: j.description,
    skills: j.skills,
    experienceMin: j.experienceMin,
    experienceMax: j.experienceMax,
  });

  if (result.ok) {
    await logAudit({
      actorId: Number(user.id), actorEmail: user.email, action: "update",
      targetType: "job", targetId: jobId, summary: `Posted "${j.title}" to job board`,
    });
  }
  return result;
}
