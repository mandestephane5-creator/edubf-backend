import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seed Orivex: création de l'école Sainte Marie...");

  const adminPassword = await bcrypt.hash("SainteMarie2026!", 10);

  const school = await prisma.school.create({
    data: {
      name: "Sainte Marie",
      slug: "sainte-marie",
      city: "Ouagadougou",
      country: "Burkina Faso",
      phone: "+226 70 00 00 00",
      adminPhone: "+226 70 00 00 01",
      surveillancePhone: "+226 70 00 00 02",
      secretariatHours: "Lundi-Vendredi, 7h30-16h30",
      address: "Secteur 15, Ouagadougou, Burkina Faso",
      users: {
        create: { email: "directrice@saintemarie.bf", password: adminPassword, role: "ADMIN" },
      },
    },
  });

  const surveillantPassword = await bcrypt.hash("Surveillant2026!", 10);
  await prisma.user.create({
    data: { schoolId: school.id, email: "surveillant@saintemarie.bf", password: surveillantPassword, role: "SURVEILLANT" },
  });

  const francais = await prisma.subject.create({ data: { schoolId: school.id, name: "Français", code: "FR" } });
  const maths = await prisma.subject.create({ data: { schoolId: school.id, name: "Mathématiques", code: "MATH" } });
  const anglais = await prisma.subject.create({ data: { schoolId: school.id, name: "Anglais", code: "EN" } });

  const classe6eA = await prisma.class.create({
    data: {
      schoolId: school.id,
      name: "6e A",
      level: "6e",
      academicYear: "2025-2026",
      subjects: {
        create: [
          { subjectId: francais.id, coefficient: 3 },
          { subjectId: maths.id, coefficient: 4 },
          { subjectId: anglais.id, coefficient: 2 },
        ],
      },
    },
  });

  // Parent + élève de démonstration
  const parentPin = "384726";
  const parentPassword = await bcrypt.hash(parentPin, 10);
  const parentUser = await prisma.user.create({
    data: { schoolId: school.id, phone: "+226 76 00 00 00", password: parentPassword, role: "PARENT" },
  });
  const parent = await prisma.parent.create({
    data: { schoolId: school.id, userId: parentUser.id, firstName: "Moussa", lastName: "Ouédraogo" },
  });

  const student = await prisma.student.create({
    data: {
      schoolId: school.id,
      matricule: "SM-2026-000001",
      firstName: "Awa",
      lastName: "Ouédraogo",
      classId: classe6eA.id,
      parents: { create: { parentId: parent.id } },
    },
  });

  console.log("✅ Seed terminé.");
  console.log("   École (slug): sainte-marie");
  console.log("   Admin: directrice@saintemarie.bf / SainteMarie2026!");
  console.log("   Surveillant: surveillant@saintemarie.bf / Surveillant2026!");
  console.log(`   Parent: matricule ${student.matricule} / PIN ${parentPin}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
