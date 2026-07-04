import { prisma } from "../config/db";

export const searchService = {
  async searchStudents(schoolId: string, query: string) {
    if (!query || query.trim().length === 0) return [];
    return prisma.student.findMany({
      where: {
        schoolId,
        OR: [
          { firstName: { contains: query, mode: "insensitive" } },
          { lastName: { contains: query, mode: "insensitive" } },
          { matricule: { contains: query, mode: "insensitive" } },
        ],
      },
      include: { class: true },
      take: 15,
      orderBy: { lastName: "asc" },
    });
  },
};
