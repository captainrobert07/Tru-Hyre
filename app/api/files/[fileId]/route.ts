import { NextResponse, type NextRequest } from "next/server";
import { Readable } from "node:stream";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import {
  resumeFiles,
  clientPackets,
  candidates,
  submissions,
  jobs,
  users,
} from "@/db/schema";
import { requireUser } from "@/lib/rbac";
import { streamDriveFile } from "@/lib/drive";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ fileId: string }> },
) {
  try {
  const user = await requireUser();
  const { fileId } = await params;
  if (!fileId) return new NextResponse("Bad request", { status: 400 });

  // Resume + packet lookups run in parallel — most file IDs match exactly
  // one of the two; the second query was wasted on resume hits before.
  const [[resumeRow], [packetRow]] = await Promise.all([
    db
      .select({
        id: resumeFiles.id,
        candidateId: resumeFiles.candidateId,
        vendorAccountId: candidates.vendorAccountId,
        contentType: resumeFiles.contentType,
        originalName: resumeFiles.originalName,
      })
      .from(resumeFiles)
      .innerJoin(candidates, eq(resumeFiles.candidateId, candidates.id))
      .where(eq(resumeFiles.driveFileId, fileId))
      .limit(1),
    db
      .select({
        id: clientPackets.id,
        candidateId: clientPackets.candidateId,
      })
      .from(clientPackets)
      .where(eq(clientPackets.driveFileId, fileId))
      .limit(1),
  ]);

  let allowed = false;
  let displayName: string | null = null;

  if (resumeRow) {
    if (user.role === "admin" || user.role === "hr") {
      allowed = true;
    } else if (user.role === "vendor") {
      const u = (await db.select().from(users).where(eq(users.id, Number(user.id))))[0];
      allowed = !!(u && u.vendorAccountId && resumeRow.vendorAccountId === u.vendorAccountId);
    }
    displayName = resumeRow.originalName;
  } else if (packetRow) {
    if (user.role === "admin" || user.role === "hr") {
      allowed = true;
    } else if (user.role === "client") {
      const u = (await db.select().from(users).where(eq(users.id, Number(user.id))))[0];
      if (u?.clientAccountId) {
        const [match] = await db
          .select({ id: submissions.id })
          .from(submissions)
          .innerJoin(jobs, eq(submissions.jobId, jobs.id))
          .where(
            and(
              eq(submissions.packetId, packetRow.id),
              eq(jobs.clientAccountId, u.clientAccountId),
            ),
          )
          .limit(1);
        allowed = !!match;
      }
    }
    displayName = `packet-${packetRow.candidateId}.pdf`;
  }

  if (!allowed) return new NextResponse("Not found", { status: 404 });

  const stream = await streamDriveFile(fileId);
  if (!stream) return new NextResponse("File unavailable", { status: 404 });

  const webStream = Readable.toWeb(stream.body) as unknown as ReadableStream;
  const headers: Record<string, string> = {
    "Content-Type": stream.contentType,
    "Content-Disposition": `inline; filename="${(displayName || stream.name).replace(/"/g, "")}"`,
    // Drive file IDs are immutable; cache per-user for an hour so flipping
    // between tabs / re-rendering candidate detail doesn't re-stream from
    // Drive every time. private = browser only, never shared CDN.
    "Cache-Control": "private, max-age=3600",
  };
  if (stream.size != null) headers["Content-Length"] = String(stream.size);
  return new NextResponse(webStream, { headers });
  } catch (e) {
    if ((e as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw e;
    console.error("[/api/files] error", e);
    return new NextResponse(`Server error: ${(e as Error).message}`, { status: 500 });
  }
}
