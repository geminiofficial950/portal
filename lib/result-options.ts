import "server-only";
import { nextSeq } from "./counters";
import { getDb } from "./db";
import { DEFAULT_RESULT_OPTIONS, type ResultOption } from "./result-meta";

// The final unit result options (see lib/result-meta.ts), kept in order in one document.
// Until someone edits them, the defaults (Pass / Fail / Withdrawn) apply.
type ResultOptionsDoc = { _id: "unit"; options: ResultOption[]; updatedAt: Date };

async function collection() {
  return (await getDb()).collection<ResultOptionsDoc>("resultOptions");
}

export async function listResultOptions(): Promise<ResultOption[]> {
  const doc = await (await collection()).findOne({ _id: "unit" });
  return doc?.options ?? DEFAULT_RESULT_OPTIONS;
}

async function save(options: ResultOption[]) {
  await (await collection()).updateOne({ _id: "unit" }, { $set: { options, updatedAt: new Date() } }, { upsert: true });
  return options;
}

export async function addResultOption(input: Omit<ResultOption, "id">) {
  const options = await listResultOptions();
  const option = { id: `R${await nextSeq("resultOptionId")}`, ...input };
  await save([...options, option]);
  return option;
}

export async function updateResultOption(id: string, input: Omit<ResultOption, "id">) {
  const options = await listResultOptions();
  if (!options.some((o) => o.id === id)) return null;
  const option = { id, ...input };
  await save(options.map((o) => (o.id === id ? option : o)));
  return option;
}

export async function removeResultOption(id: string) {
  const options = await listResultOptions();
  const found = options.find((o) => o.id === id);
  if (!found) return null;
  await save(options.filter((o) => o.id !== id));
  return found;
}
