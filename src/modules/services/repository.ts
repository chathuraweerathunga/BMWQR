import { prisma } from "@/lib/prisma";

export interface CreateServiceInput {
  businessId: string;
  name: string;
  departmentId?: string | null;
  description?: string | null;
  icon?: string | null;
  category?: string | null;
  defaultPriority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  estimatedMinutes?: number | null;
}

export async function createService(input: CreateServiceInput) {
  return prisma.service.create({
    data: {
      businessId: input.businessId,
      name: input.name,
      departmentId: input.departmentId ?? null,
      description: input.description ?? null,
      icon: input.icon ?? null,
      category: input.category ?? null,
      defaultPriority: input.defaultPriority ?? "NORMAL",
      estimatedMinutes: input.estimatedMinutes ?? null,
    },
  });
}

export async function getServiceById(businessId: string, serviceId: string) {
  return prisma.service.findFirst({ where: { id: serviceId, businessId } });
}

/** What the guest portal lists — active services only. */
export async function listActiveServicesForBusiness(businessId: string) {
  return prisma.service.findMany({
    where: { businessId, isActive: true },
    orderBy: { name: "asc" },
  });
}

/** For the staff-facing management screen — every service, active or not,
 * with its department name for display. */
export async function listAllServicesForBusiness(businessId: string) {
  return prisma.service.findMany({
    where: { businessId },
    include: { department: true },
    orderBy: { name: "asc" },
  });
}

export async function setServiceActive(businessId: string, serviceId: string, isActive: boolean) {
  return prisma.service.updateMany({
    where: { id: serviceId, businessId },
    data: { isActive },
  });
}

export type UpdateServiceInput = Partial<Omit<CreateServiceInput, "businessId">>;

/** Tenant-scoped update; the composite FK keeps departmentId in-tenant. */
export async function updateService(businessId: string, serviceId: string, patch: UpdateServiceInput) {
  return prisma.service.updateMany({ where: { id: serviceId, businessId }, data: patch });
}
