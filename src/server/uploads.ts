// Files the grower attaches: the receiver's inspection report, photos, a temperature log. We keep what the agent
// needs to read them: the text of a PDF or CSV, or a small image itself.
import "server-only";
import { extractText, getDocumentProxy } from "unpdf";

export const MAX_BYTES = 3_500_000; // under Vercel's 4.5 MB request limit
const IMAGE = /^image\/(png|jpe?g|webp)$/;
const TEXT = /^(text\/(csv|plain)|application\/(json|csv))$/;

export type Upload = { name: string; type: string; bytes: number; text: string | null; data: string | null };

export async function readUpload(file: File): Promise<Upload | { error: string }> {
  if (file.size === 0) return { error: "That file is empty." };
  if (file.size > MAX_BYTES) return { error: "Files can be up to 3.5 MB." };
  const name = file.name.replace(/[^\w.\- ]+/g, "_").slice(0, 80) || "file";
  const type = file.type || (name.endsWith(".csv") ? "text/csv" : name.endsWith(".pdf") ? "application/pdf" : "");
  const buf = new Uint8Array(await file.arrayBuffer());
  if (type === "application/pdf") {
    try {
      const pdf = await getDocumentProxy(buf);
      const { text } = await extractText(pdf, { mergePages: true });
      return { name, type, bytes: file.size, text: text.trim().slice(0, 20_000) || "(This PDF has no text layer.)", data: null };
    } catch {
      return { error: "That PDF couldn't be read." };
    }
  }
  if (IMAGE.test(type)) return { name, type, bytes: file.size, text: null, data: Buffer.from(buf).toString("base64") };
  if (TEXT.test(type)) return { name, type, bytes: file.size, text: new TextDecoder().decode(buf).slice(0, 20_000), data: null };
  return { error: "Attach a PDF, a photo (PNG, JPG, WebP) or a CSV." };
}
