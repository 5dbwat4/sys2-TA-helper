import { prisma } from "@/lib/prisma";
import { requireStaff, withAuth } from "@/lib/auth";

export const GET = withAuth(async () => {
  await requireStaff();

  const [totalStudents, unreturnedBoards, experiments, recentSubmissions, recentAssignments] =
    await Promise.all([
      prisma.user.count({ where: { role: "STUDENT" } }),
      prisma.board.count({ where: { assignments: { some: { isReturned: false } } } }),
      prisma.experiment.findMany({
        orderBy: { number: "asc" },
        include: { _count: { select: { submissions: { where: { acceptanceScore: { not: null } } } } } },
      }),
      prisma.submission.findMany({
        where: { acceptanceScore: { not: null } },
        orderBy: { submitTime: "desc" },
        take: 8,
        include: { student: { select: { name: true, studentId: true } }, experiment: { select: { number: true, name: true } } },
      }),
      prisma.boardAssignment.findMany({
        orderBy: { assignedAt: "desc" },
        take: 8,
        include: { board: { select: { dbNo: true, assetNo: true } }, student: { select: { name: true } } },
      }),
    ]);

  const activeExperiment = experiments.find((e) => e.isPublished) ?? experiments[experiments.length - 1] ?? null;
  const checkedCount = activeExperiment?._count.submissions ?? 0;

  const activity = [
    ...recentSubmissions.map((s) => ({
      kind: "checkoff" as const,
      at: (s.submitTime ?? new Date(0)).toISOString(),
      text: `${s.student.name} · Lab ${s.experiment.number} 验收 ${s.acceptanceScore} 分`,
    })),
    ...recentAssignments.map((a) => ({
      kind: a.isReturned ? ("return" as const) : ("lend" as const),
      at: (a.isReturned ? (a.returnedAt ?? a.assignedAt) : a.assignedAt).toISOString(),
      text: a.isReturned
        ? `板 ${a.board.dbNo} 已归还（${a.student.name}）`
        : `板 ${a.board.dbNo} 借出给 ${a.student.name}`,
    })),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 10);

  return Response.json({
    totalStudents,
    unreturnedBoards,
    activeExperiment: activeExperiment
      ? {
          id: activeExperiment.id,
          number: activeExperiment.number,
          name: activeExperiment.name,
          checkedCount,
          totalStudents,
        }
      : null,
    experimentCount: experiments.filter((e) => e.isPublished).length,
    activity,
  });
});
