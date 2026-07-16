import { google, type drive_v3 } from "googleapis";
import { Readable } from "node:stream";
import { supabase } from "./supabase";

async function getRefreshToken(): Promise<string> {
  const { data, error } = await supabase()
    .from("google_auth")
    .select("refresh_token")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw error;
  if (!data?.refresh_token) {
    throw new Error(
      "No Google refresh token stored — sign in through the app once to grant Drive access."
    );
  }
  return data.refresh_token;
}

export async function getDrive(): Promise<drive_v3.Drive> {
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2.setCredentials({ refresh_token: await getRefreshToken() });
  return google.drive({ version: "v3", auth: oauth2 });
}

const FOLDER_MIME = "application/vnd.google-apps.folder";

function escapeQuery(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/**
 * Resolve (creating as needed) the folder for a path like
 * ["Invoices & Receipts"] under the root folder. Folder IDs are cached in
 * the drive_folders table so we don't re-search Drive on every filing.
 */
export async function resolveFolder(segments: string[]): Promise<{ id: string; path: string }> {
  const drive = await getDrive();
  const root = process.env.DRIVE_ROOT_FOLDER_NAME || "House Docs";
  const fullSegments = [root, ...segments];

  let parentId = "root";
  let pathSoFar = "";
  for (const segment of fullSegments) {
    pathSoFar = pathSoFar ? `${pathSoFar}/${segment}` : segment;

    const { data: cached } = await supabase()
      .from("drive_folders")
      .select("folder_id")
      .eq("path", pathSoFar)
      .maybeSingle();
    if (cached?.folder_id) {
      parentId = cached.folder_id;
      continue;
    }

    const q = `name = '${escapeQuery(segment)}' and '${parentId}' in parents and mimeType = '${FOLDER_MIME}' and trashed = false`;
    const found = await drive.files.list({ q, fields: "files(id)", pageSize: 1 });
    let folderId = found.data.files?.[0]?.id ?? null;

    if (!folderId) {
      const created = await drive.files.create({
        requestBody: { name: segment, mimeType: FOLDER_MIME, parents: [parentId] },
        fields: "id",
      });
      folderId = created.data.id!;
    }

    await supabase()
      .from("drive_folders")
      .upsert({ path: pathSoFar, folder_id: folderId });
    parentId = folderId;
  }
  return { id: parentId, path: pathSoFar };
}

/** Find a filename that doesn't collide in the target folder (_2, _3, ...). */
export async function availableFilename(
  folderId: string,
  desired: string
): Promise<string> {
  const drive = await getDrive();
  const dot = desired.lastIndexOf(".");
  const base = dot === -1 ? desired : desired.slice(0, dot);
  const ext = dot === -1 ? "" : desired.slice(dot);

  const existing = await drive.files.list({
    q: `name contains '${escapeQuery(base)}' and '${folderId}' in parents and trashed = false`,
    fields: "files(name)",
    pageSize: 100,
  });
  const names = new Set((existing.data.files ?? []).map((f) => f.name));
  if (!names.has(desired)) return desired;
  for (let n = 2; n < 100; n++) {
    const candidate = `${base}_${n}${ext}`;
    if (!names.has(candidate)) return candidate;
  }
  return `${base}_${Date.now()}${ext}`;
}

export async function uploadToDrive(
  folderId: string,
  name: string,
  mimeType: string,
  buffer: Buffer
): Promise<{ fileId: string; webViewLink: string }> {
  const drive = await getDrive();
  const res = await drive.files.create({
    requestBody: { name, parents: [folderId] },
    media: { mimeType, body: Readable.from(buffer) },
    fields: "id, webViewLink",
  });
  return { fileId: res.data.id!, webViewLink: res.data.webViewLink! };
}

/** Rename and/or move an already-filed document (post-filing edits). */
export async function updateDriveFile(
  fileId: string,
  opts: { name?: string; newFolderId?: string }
): Promise<void> {
  const drive = await getDrive();
  let addParents: string | undefined;
  let removeParents: string | undefined;
  if (opts.newFolderId) {
    const current = await drive.files.get({ fileId, fields: "parents" });
    removeParents = (current.data.parents ?? []).join(",") || undefined;
    addParents = opts.newFolderId;
  }
  await drive.files.update({
    fileId,
    requestBody: opts.name ? { name: opts.name } : {},
    addParents,
    removeParents,
  });
}
