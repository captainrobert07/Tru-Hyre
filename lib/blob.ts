import { put, del, head } from "@vercel/blob";

export async function uploadResume(buffer: Buffer, filename: string, contentType: string) {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `resumes/${Date.now()}-${safe}`;
  const blob = await put(path, buffer, {
    access: "public",
    contentType,
    addRandomSuffix: true,
  });
  return blob;
}

export async function uploadPacket(buffer: Buffer, refId: string) {
  const path = `packets/${refId}-${Date.now()}.pdf`;
  const blob = await put(path, buffer, {
    access: "public",
    contentType: "application/pdf",
    addRandomSuffix: true,
  });
  return blob;
}

export { del as deleteBlob, head as headBlob };
