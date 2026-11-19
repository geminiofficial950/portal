import "server-only";
import { Binary, ObjectId } from "mongodb";
import { getDb } from "./db";

export const MAX_VISIBLE_PROMOTIONS = 4;
export const PROMOTION_FORMATS = ["text", "photo", "photo-text"] as const;
export type PromotionFormat = (typeof PROMOTION_FORMATS)[number];

type PromotionImage = { mime: "image/png" | "image/jpeg"; data: Binary };
type Promotion = {
  _id: ObjectId;
  format: PromotionFormat;
  title: string;
  description: string;
  link: string;
  linkLabel: string;
  imageAlt: string;
  image?: PromotionImage;
  active: boolean;
  createdAt: Date;
};

export type PromotionSummary = Omit<Promotion, "image" | "_id"> & { id: string };

const collection = async () => (await getDb()).collection<Promotion>("portalPromotions");

export async function listPromotions(activeOnly = false): Promise<PromotionSummary[]> {
  const query = (await collection())
    .find<Omit<Promotion, "image">>(activeOnly ? { active: true } : {}, { projection: { image: 0 } })
    .sort({ createdAt: -1, _id: -1 });
  const promotions = await (activeOnly ? query.limit(MAX_VISIBLE_PROMOTIONS) : query).toArray();
  return promotions.map(({ _id, ...promotion }) => ({ ...promotion, id: _id.toHexString() }));
}

export async function savePromotion(
  id: string,
  content: Pick<Promotion, "format" | "title" | "description" | "link" | "linkLabel" | "imageAlt">,
  image: { mime: PromotionImage["mime"]; bytes: Uint8Array } | undefined,
) {
  const db = await collection();
  const replacement = image ? { mime: image.mime, data: new Binary(image.bytes) } : undefined;
  if (!id) {
    if (content.format !== "text" && !replacement) return false;
    await db.insertOne({
      ...content,
      _id: new ObjectId(),
      ...(replacement ? { image: replacement } : {}),
      active: false,
      createdAt: new Date(),
    });
    return true;
  }

  if (!ObjectId.isValid(id)) return false;
  const result = await db.updateOne(
    { _id: new ObjectId(id), ...(content.format !== "text" && !replacement ? { image: { $exists: true } } : {}) },
    {
      $set: { ...content, ...(replacement ? { image: replacement } : {}) },
      ...(content.format === "text" ? { $unset: { image: "" } } : {}),
    },
  );
  return result.matchedCount > 0;
}

export async function setPromotionActive(id: string, active: boolean) {
  if (!ObjectId.isValid(id)) return;
  await (await collection()).updateOne({ _id: new ObjectId(id) }, { $set: { active } });
}

export async function getPromotionImage(id: string, staff: boolean) {
  if (!ObjectId.isValid(id)) return undefined;
  const promotion = await (await collection()).findOne(
    { _id: new ObjectId(id), ...(staff ? {} : { active: true }) },
    { projection: { image: 1 } },
  );
  return promotion?.image;
}
