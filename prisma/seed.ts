/**
 * Seeds the "Ocean Pearl Resort" example tenant (project instructions
 * section 55) for local development and demoing the guest/staff flows.
 *
 * Deliberately built entirely on top of this codebase's own repository
 * and service functions (modules/*), not raw `prisma.*` calls — that way
 * seeding doubles as a smoke test that those functions actually compose
 * correctly (create a business → departments → locations → services →
 * staff → QR codes → check in a guest → get an activation link).
 *
 * Run with: npm run db:seed
 * (requires `npm run db:generate` + `npm run db:migrate` to have been run
 * first against a real database — see docs/ARCHITECTURE.md.)
 */
import { createBusiness } from "@/modules/business/repository";
import { createDepartment } from "@/modules/departments/repository";
import { createLocation } from "@/modules/locations/repository";
import { createService } from "@/modules/services/repository";
import { createStaffUser, createMembership, toStaffActor } from "@/modules/staff/repository";
import { createQrCode } from "@/modules/qr/repository";
import { checkInGuest } from "@/modules/guest-stays/service";
import { prisma } from "@/lib/prisma";

async function main() {
  console.log("Seeding Ocean Pearl Resort...");

  const business = await createBusiness({
    slug: "ocean-pearl-resort",
    name: "Ocean Pearl Resort",
    type: "HOTEL",
    timezone: "Asia/Colombo",
    currency: "USD",
  });
  console.log(`  Business: ${business.name} (${business.id})`);

  // --- Departments -------------------------------------------------
  const departmentNames = [
    "Housekeeping",
    "Maintenance",
    "Room Service",
    "Concierge",
    "Front Office",
    "Spa",
    "Restaurant",
    "Security",
  ] as const;
  const departments: Record<string, Awaited<ReturnType<typeof createDepartment>>> = {};
  for (const name of departmentNames) {
    departments[name] = await createDepartment(business.id, { name });
  }
  console.log(`  Departments: ${departmentNames.join(", ")}`);

  // --- Locations -----------------------------------------------------
  const building = await createLocation({
    businessId: business.id,
    name: "Main Building",
    type: "BUILDING",
  });
  const floor2 = await createLocation({
    businessId: business.id,
    name: "Floor 2",
    type: "FLOOR",
    parentLocationId: building.id,
  });
  const room208 = await createLocation({
    businessId: business.id,
    name: "Room 208",
    type: "ROOM",
    parentLocationId: floor2.id,
  });
  const pool = await createLocation({ businessId: business.id, name: "Pool", type: "POOL" });
  const poolTable1 = await createLocation({
    businessId: business.id,
    name: "Pool Table 1",
    type: "TABLE",
    parentLocationId: pool.id,
  });
  const restaurant = await createLocation({
    businessId: business.id,
    name: "Restaurant",
    type: "OTHER",
  });
  const restaurantTable1 = await createLocation({
    businessId: business.id,
    name: "Restaurant Table 1",
    type: "TABLE",
    parentLocationId: restaurant.id,
  });
  const spa = await createLocation({ businessId: business.id, name: "Spa", type: "OTHER" });
  const spaTreatmentRoom1 = await createLocation({
    businessId: business.id,
    name: "Spa Treatment Room 1",
    type: "TREATMENT_ROOM",
    parentLocationId: spa.id,
  });
  await createLocation({ businessId: business.id, name: "Gym", type: "GYM_AREA" });
  await createLocation({ businessId: business.id, name: "Reception", type: "RECEPTION" });
  console.log("  Locations: Main Building > Floor 2 > Room 208, Pool > Pool Table 1, Restaurant > Table 1, Spa > Treatment Room 1, Gym, Reception");

  // --- Services --------------------------------------------------------
  await createService({
    businessId: business.id,
    name: "Extra towels",
    departmentId: departments.Housekeeping.id,
    estimatedMinutes: 15,
  });
  await createService({
    businessId: business.id,
    name: "Extra pillows",
    departmentId: departments.Housekeeping.id,
    estimatedMinutes: 15,
  });
  await createService({
    businessId: business.id,
    name: "Housekeeping",
    departmentId: departments.Housekeeping.id,
    estimatedMinutes: 30,
  });
  await createService({
    businessId: business.id,
    name: "Room service",
    departmentId: departments["Room Service"].id,
    estimatedMinutes: 30,
  });
  await createService({
    businessId: business.id,
    name: "Maintenance",
    departmentId: departments.Maintenance.id,
    defaultPriority: "HIGH",
    estimatedMinutes: 45,
  });
  await createService({
    businessId: business.id,
    name: "Laundry",
    departmentId: departments.Housekeeping.id,
    estimatedMinutes: 60,
  });
  await createService({
    businessId: business.id,
    name: "Concierge",
    departmentId: departments.Concierge.id,
    estimatedMinutes: 10,
  });
  await createService({
    businessId: business.id,
    name: "Airport transfer",
    departmentId: departments.Concierge.id,
    estimatedMinutes: 20,
  });
  await createService({
    businessId: business.id,
    name: "Wake-up call",
    departmentId: departments["Front Office"].id,
    estimatedMinutes: 5,
  });
  await createService({
    businessId: business.id,
    name: "Pool service",
    departmentId: departments["Room Service"].id,
    estimatedMinutes: 15,
  });
  await createService({
    businessId: business.id,
    name: "Spa service",
    departmentId: departments.Spa.id,
    estimatedMinutes: 60,
  });
  console.log("  Services created");

  // --- Staff -----------------------------------------------------------
  const owner = await createStaffUser({
    email: "owner@oceanpearl.example",
    password: "ChangeMe123!",
    name: "Priya Fernando",
  });
  await createMembership({ businessId: business.id, userId: owner.id, role: "BUSINESS_OWNER" });

  const manager = await createStaffUser({
    email: "manager@oceanpearl.example",
    password: "ChangeMe123!",
    name: "Dinesh Perera",
  });
  await createMembership({ businessId: business.id, userId: manager.id, role: "MANAGER" });

  const housekeepingStaffUser = await createStaffUser({
    email: "housekeeping1@oceanpearl.example",
    password: "ChangeMe123!",
    name: "Amara Silva",
  });
  await createMembership({
    businessId: business.id,
    userId: housekeepingStaffUser.id,
    role: "STAFF",
    departmentId: departments.Housekeeping.id,
  });
  console.log("  Staff: owner, manager, 1 housekeeping staff (password for all: ChangeMe123! — change before any real use)");

  // --- QR codes ----------------------------------------------------------
  const roomQr = await createQrCode({ businessId: business.id, locationId: room208.id, label: "Room 208" });
  const poolQr = await createQrCode({ businessId: business.id, locationId: poolTable1.id, label: "Pool Table 1" });
  const restaurantQr = await createQrCode({
    businessId: business.id,
    locationId: restaurantTable1.id,
    label: "Restaurant Table 1",
  });
  const spaQr = await createQrCode({
    businessId: business.id,
    locationId: spaTreatmentRoom1.id,
    label: "Spa Treatment Room 1",
  });
  console.log("  QR codes created (raw tokens shown once, below — normally these get baked into a printed/displayed QR image):");
  console.log(`    Room 208:            /qr/${roomQr.token}`);
  console.log(`    Pool Table 1:        /qr/${poolQr.token}`);
  console.log(`    Restaurant Table 1:  /qr/${restaurantQr.token}`);
  console.log(`    Spa Treatment Room 1:/qr/${spaQr.token}`);

  // --- Example guest stay -------------------------------------------------
  const ownerActor = toStaffActor({
    id: (await prisma.businessMembership.findFirstOrThrow({
      where: { businessId: business.id, userId: owner.id },
    })).id,
    userId: owner.id,
    businessId: business.id,
    role: "BUSINESS_OWNER",
    departmentId: null,
  });

  const checkOutAt = new Date();
  checkOutAt.setDate(checkOutAt.getDate() + 3);

  const { guestStay, activationUrl } = await checkInGuest(ownerActor, {
    guestFullName: "John Smith",
    guestEmail: "john.smith@example.com",
    locationId: room208.id,
    checkOutAt,
  });
  console.log(`  Guest stay: John Smith in Room 208, checkout ${checkOutAt.toISOString()} (${guestStay.id})`);
  console.log(`  Guest activation link (open this to set the guest session cookie): ${activationUrl}`);

  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
