import { google, type drive_v3 } from "googleapis";
import { Readable } from "node:stream";
import { getIntegration } from "@/lib/integrations";

export type DriveUploadResult = {
  driveFileId: string;
  webViewLink: string | null;
  name: string;
};

// Resolve the Google service-account client from admin Integrations (DB) → env.
async function getDriveClient(): Promise<drive_v3.Drive | null> {
  const r = await getIntegration("google");
  const raw = r.values.serviceAccountJson;
  if (!raw) return null;

  let creds: { client_email: string; private_key: string };
  try {
    const decoded = raw.trim().startsWith("{")
      ? raw
      : Buffer.from(raw, "base64").toString("utf-8");
    creds = JSON.parse(decoded);
  } catch (e) {
    console.error("[drive] failed to parse Google service account JSON", (e as Error).message);
    return null;
  }

  // Env-var pipelines often turn real newlines into the literal sequence "\n";
  // googleapis JWT will silently fail auth if the PEM has no real newlines.
  const privateKey = creds.private_key.replace(/\\n/g, "\n");

  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });

  return google.drive({ version: "v3", auth });
}

async function getFolderId(): Promise<string | null> {
  const r = await getIntegration("google");
  return r.values.driveFolderId || null;
}

function safeName(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._\- ]/g, "_").slice(0, 240);
}

async function uploadToDrive(
  buffer: Buffer,
  name: string,
  mimeType: string,
  subPrefix: string,
): Promise<DriveUploadResult> {
  const [drive, folderId] = await Promise.all([getDriveClient(), getFolderId()]);

  if (!drive || !folderId) {
    console.warn("[drive] (dev) skipping upload — missing service account or folder id", { name });
    const stub = `dev-${subPrefix}-${Date.now()}-${safeName(name)}`;
    return { driveFileId: stub, webViewLink: null, name };
  }

  const finalName = `${subPrefix}-${Date.now()}-${safeName(name)}`;
  const res = await drive.files.create({
    requestBody: {
      name: finalName,
      parents: [folderId],
      mimeType,
    },
    media: {
      mimeType,
      body: Readable.from(buffer),
    },
    fields: "id, webViewLink, name",
    supportsAllDrives: true,
  });

  const id = res.data.id;
  if (!id) throw new Error("drive_create_returned_no_id");

  return {
    driveFileId: id,
    webViewLink: res.data.webViewLink ?? null,
    name: res.data.name ?? finalName,
  };
}

export function uploadResume(buffer: Buffer, filename: string, contentType: string) {
  return uploadToDrive(buffer, filename, contentType || "application/pdf", "resume");
}

export function uploadPacket(buffer: Buffer, refId: string) {
  return uploadToDrive(buffer, `${refId}.pdf`, "application/pdf", "packet");
}

export async function deleteDriveFile(driveFileId: string): Promise<void> {
  if (!driveFileId || driveFileId.startsWith("dev-")) return;
  const drive = await getDriveClient();
  if (!drive) return;
  await drive.files.delete({ fileId: driveFileId, supportsAllDrives: true });
}

export type DriveStream = {
  body: Readable;
  contentType: string;
  name: string;
  size: number | null;
};

export async function streamDriveFile(driveFileId: string): Promise<DriveStream | null> {
  if (!driveFileId || driveFileId.startsWith("dev-")) return null;
  const drive = await getDriveClient();
  if (!drive) return null;

  const meta = await drive.files.get({
    fileId: driveFileId,
    fields: "id, name, mimeType, size",
    supportsAllDrives: true,
  });

  const dl = await drive.files.get(
    { fileId: driveFileId, alt: "media", supportsAllDrives: true },
    { responseType: "stream" },
  );

  return {
    body: dl.data as unknown as Readable,
    contentType: (meta.data.mimeType as string) || "application/octet-stream",
    name: (meta.data.name as string) || driveFileId,
    size: meta.data.size ? Number(meta.data.size) : null,
  };
}
