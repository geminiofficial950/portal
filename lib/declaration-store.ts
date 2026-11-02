import "server-only";
import { getDb } from "./db";
import { DEFAULT_DECLARATION, type DeclarationText } from "./declaration";

// The current declaration text (lib/declaration.ts). Until someone edits it, the default applies.
type DeclarationDoc = DeclarationText & { _id: "current"; updatedAt: Date };

async function collection() {
  return (await getDb()).collection<DeclarationDoc>("declarationText");
}

export async function getDeclaration(): Promise<DeclarationText> {
  const doc = await (await collection()).findOne({ _id: "current" });
  return doc ? { intro: doc.intro, points: doc.points, agree: doc.agree } : DEFAULT_DECLARATION;
}

export async function saveDeclaration(text: DeclarationText) {
  await (await collection()).updateOne({ _id: "current" }, { $set: { ...text, updatedAt: new Date() } }, { upsert: true });
}
