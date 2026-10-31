// Pure upload checks (unit-tested in tests/file-types.test.ts).
import { FILE_RULES } from "./submission-meta";

// Extension → MIME type + the bytes a real file of that type starts with
const TYPES: Record<string, { mime: string; magic: number[][] }> = {
  pdf: { mime: "application/pdf", magic: [[0x25, 0x50, 0x44, 0x46]] },
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", magic: [[0x50, 0x4b, 0x03, 0x04]] },
  doc: { mime: "application/msword", magic: [[0xd0, 0xcf, 0x11, 0xe0]] },
  png: { mime: "image/png", magic: [[0x89, 0x50, 0x4e, 0x47]] },
  jpg: { mime: "image/jpeg", magic: [[0xff, 0xd8, 0xff]] },
  jpeg: { mime: "image/jpeg", magic: [[0xff, 0xd8, 0xff]] },
};

export function checkUpload(
  name: string,
  bytes: Uint8Array,
): { ok: true; mime: string; safeName: string } | { ok: false; error: string } {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const type = TYPES[ext];
  if (!type || !name.includes(".")) return { ok: false, error: "Only Word, PDF, JPG or PNG files can be uploaded." };
  if (bytes.length > FILE_RULES.maxBytes) return { ok: false, error: "That file is over 10 MB." };
  if (bytes.length === 0) return { ok: false, error: "That file is empty." };
  if (!type.magic.some((m) => m.every((b, i) => bytes[i] === b))) {
    return { ok: false, error: `That file doesn’t look like a real ${ext.toUpperCase()} file.` };
  }
  return { ok: true, mime: type.mime, safeName: name.replace(/[^\w.\- ()]/g, "_").slice(0, 120) };
}
