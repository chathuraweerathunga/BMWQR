import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { staffQueueWhere } from "@/modules/requests/repository";
import { getBusinessBySlug } from "@/modules/business/repository";
import { requireStaffActor } from "@/lib/session";
import { AuthenticationError } from "@/lib/errors";

/**
 * GET /api/b/{slug}/pulse — the staff app's live-update heartbeat.
 *
 * Returns only what the in-app notifier needs: how many NEW requests this
 * staff member can act on, the newest one's headline, and a `version`
 * string that changes whenever any active request changes (so an open
 * dashboard knows to refresh). Polled every ~15 s; cheap by design (one
 * count + two indexed lookups).
 *
 * Tenant-safe: the business comes from the slug, resolved server-side,
 * and the caller must hold an ACTIVE membership there. An unknown slug and
 * a business the caller doesn't belong to both return the same 404.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const noStore = { "Cache-Control": "no-store" };

  const business = await getBusinessBySlug(slug);
  if (!business) return NextResponse.json({ error: "not_found" }, { status: 404, headers: noStore });

  let actor;
  try {
    actor = await requireStaffActor(business.id);
  } catch (err) {
    if (err instanceof AuthenticationError) {
      return NextResponse.json({ error: "not_found" }, { status: 404, headers: noStore });
    }
    throw err;
  }

  // STAFF see the same queue as their board.
  const visibility =
    actor.role === "STAFF" ? staffQueueWhere({ membershipId: actor.membershipId, departmentId: actor.departmentId }) : {};

  const [newCount, newest, lastChange] = await Promise.all([
    prisma.request.count({ where: { businessId: business.id, status: "NEW", ...visibility } }),
    prisma.request.findFirst({
      where: { businessId: business.id, status: "NEW", ...visibility },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, createdAt: true, location: { select: { name: true } } },
    }),
    prisma.request.findFirst({
      where: { businessId: business.id, ...visibility },
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true },
    }),
  ]);

  return NextResponse.json(
    {
      newCount,
      newest: newest
        ? {
            id: newest.id,
            title: newest.title,
            location: newest.location?.name ?? null,
            createdAt: newest.createdAt.toISOString(),
          }
        : null,
      version: `${newCount}:${lastChange?.updatedAt.toISOString() ?? "0"}`,
    },
    { headers: noStore },
  );
}
