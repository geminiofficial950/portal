import "server-only";
import { getDb } from "./db";

// Course thumbnails and trainer profile pictures are display pictures: any logged-in user may see them
// (students see their course's picture and their trainer's photo). Used by /api/files/[id].
export async function isDisplayImage(fileId: string) {
  const db = await getDb();
  const id = String(fileId);
  const [course, trainer] = await Promise.all([
    db.collection("courses").countDocuments({ "thumbnail.id": id }, { limit: 1 }),
    db.collection("trainers").countDocuments({ "photo.id": id }, { limit: 1 }),
  ]);
  return course + trainer > 0;
}
