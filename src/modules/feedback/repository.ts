import { prisma } from "@/lib/prisma";

export interface CreateFeedbackInput {
  businessId: string;
  guestId: string;
  guestStayId: string;
  requestId?: string | null;
  rating: number;
  comment?: string | null;
  categories?: string[];
}

export async function createFeedback(input: CreateFeedbackInput) {
  return prisma.feedback.create({
    data: {
      businessId: input.businessId,
      guestId: input.guestId,
      guestStayId: input.guestStayId,
      requestId: input.requestId ?? null,
      rating: input.rating,
      comment: input.comment ?? null,
      categories: input.categories ?? [],
    },
  });
}

/** For the manager dashboard (spec section 25) — most recent feedback
 * first, with just enough related data to display without a second round
 * trip per row. */
export async function listFeedbackForBusiness(
  businessId: string,
  params: { limit?: number; maxRating?: number } = {},
) {
  return prisma.feedback.findMany({
    where: {
      businessId,
      ...(params.maxRating !== undefined ? { rating: { lte: params.maxRating } } : {}),
    },
    include: { guest: true, request: { select: { id: true, title: true } } },
    orderBy: { createdAt: "desc" },
    take: params.limit ?? 50,
  });
}

export async function getFeedbackSummaryForBusiness(businessId: string) {
  const result = await prisma.feedback.aggregate({
    where: { businessId },
    _avg: { rating: true },
    _count: { _all: true },
  });
  const negativeCount = await prisma.feedback.count({
    where: { businessId, rating: { lte: 2 } },
  });
  return {
    averageRating: result._avg.rating,
    totalCount: result._count._all,
    negativeCount,
  };
}
