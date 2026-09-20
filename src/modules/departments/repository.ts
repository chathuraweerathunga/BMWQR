import { prisma } from "@/lib/prisma";

export async function createDepartment(
  businessId: string,
  input: { name: string; description?: string | null },
) {
  return prisma.department.create({
    data: { businessId, name: input.name, description: input.description ?? null },
  });
}

export async function getDepartmentById(businessId: string, departmentId: string) {
  return prisma.department.findFirst({ where: { id: departmentId, businessId } });
}

/** Used to give a friendly "that name is taken" message before hitting the
 * `@@unique([businessId, name])` constraint at the database layer. */
export async function getDepartmentByName(businessId: string, name: string) {
  return prisma.department.findFirst({ where: { businessId, name } });
}

export async function listDepartmentsForBusiness(businessId: string) {
  return prisma.department.findMany({ where: { businessId }, orderBy: { name: "asc" } });
}

export async function updateDepartment(
  businessId: string,
  departmentId: string,
  patch: { name?: string; description?: string | null },
) {
  return prisma.department.updateMany({
    where: { id: departmentId, businessId },
    data: patch,
  });
}
