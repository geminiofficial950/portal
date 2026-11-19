import { isAdminRequest } from "@/lib/auth";
import { getPromotionImage } from "@/lib/portal-promotions";
import { getSession } from "@/lib/session";

export async function GET(_request: Request, { params }: RouteContext<"/api/portal-promotions/[id]">) {
  const session = await getSession();
  const staff = session?.role === "admin" && await isAdminRequest();
  if (!staff && session?.role !== "student") return new Response(null, { status: 404 });

  const { id } = await params;
  const image = await getPromotionImage(id, staff);
  if (!image) return new Response(null, { status: 404 });

  return new Response(new Uint8Array(image.data.value()), {
    headers: {
      "Content-Type": image.mime,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
