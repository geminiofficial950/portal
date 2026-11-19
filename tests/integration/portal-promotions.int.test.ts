import { expect, it } from "vitest";
import { getPromotionImage, listPromotions, savePromotion, setPromotionActive } from "@/lib/portal-promotions";

it("keeps drafts private, limits the dashboard to four published banners, and replaces images atomically", async () => {
  const content = {
    format: "photo" as const,
    title: "Student event",
    description: "",
    link: "",
    linkLabel: "",
    imageAlt: "Student event poster",
  };
  const photo = { mime: "image/png" as const, bytes: Uint8Array.of(0x89, 0x50, 0x4e, 0x47) };
  expect(await savePromotion("", content, undefined)).toBe(false);
  expect(await savePromotion("", content, photo)).toBe(true);
  const [draft] = await listPromotions();
  expect(draft).not.toHaveProperty("image");
  expect(await listPromotions(true)).toEqual([]);
  expect(await getPromotionImage(draft.id, false)).toBeUndefined();
  const storedPhoto = await getPromotionImage(draft.id, true);
  expect(storedPhoto?.data.value()).toEqual(Buffer.from(photo.bytes));

  await setPromotionActive(draft.id, true);
  expect(await listPromotions(true)).toMatchObject([{ id: draft.id }]);
  expect(await getPromotionImage(draft.id, false)).toBeDefined();
  const text = { ...content, format: "text" as const, imageAlt: "" };
  expect(await savePromotion(draft.id, text, undefined)).toBe(true);
  expect(await getPromotionImage(draft.id, true)).toBeUndefined();
  expect(await savePromotion(draft.id, content, undefined)).toBe(false);
  expect(await listPromotions(true)).toMatchObject([{ id: draft.id, format: "text" }]);

  for (let index = 0; index < 4; index++) {
    await savePromotion("", { ...text, title: `Banner ${index}` }, undefined);
    const [latest] = await listPromotions();
    await setPromotionActive(latest.id, true);
  }

  expect((await listPromotions(true)).map(({ title }) => title)).toEqual(["Banner 3", "Banner 2", "Banner 1", "Banner 0"]);
  const [latest] = await listPromotions(true);
  await setPromotionActive(latest.id, false);
  expect((await listPromotions(true)).map(({ title }) => title)).toContain(draft.title);
});
