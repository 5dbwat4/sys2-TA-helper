import { prisma } from "@/lib/prisma";
import { requireSession, withAuth } from "@/lib/auth";

export const GET = withAuth(async () => {
  const session = await requireSession();

  const student = await prisma.user.findUnique({
    where: { id: session.id },
    include: {
      boardAssignments: { include: { board: true }, orderBy: { assignedAt: "desc" } },
      submissions: { include: { experiment: true } },
    },
  });
  if (!student) return Response.json({ error: "USER_NOT_FOUND" }, { status: 404 });

  const activeAssignment = student.boardAssignments.find((a) => !a.isReturned) ?? student.boardAssignments[0] ?? null;
  let boardInfo = null;

  if (activeAssignment) {
    const coAssignments = await prisma.boardAssignment.findMany({
      where: { boardId: activeAssignment.boardId, NOT: { studentId: student.id } },
      include: { student: true },
    });
    boardInfo = {
      assetNo: activeAssignment.board.assetNo,
      dbNo: activeAssignment.board.dbNo,
      contactPhone: activeAssignment.board.contactPhone,
      isReturned: activeAssignment.isReturned,
      assignedAt: activeAssignment.assignedAt,
      returnedAt: activeAssignment.returnedAt,
      teamMembers: coAssignments.map((a) => a.student.name),
    };
  }

  const publishedExperiments = await prisma.experiment.findMany({
    where: { isPublished: true },
    orderBy: { number: "asc" },
  });

  const submissionsMap = new Map(student.submissions.map((s) => [s.experimentId, s]));

  const grades = publishedExperiments.map((exp) => {
    const sub = submissionsMap.get(exp.id);
    let finalScore: number | null = null;

    if (sub) {
      if (sub.checkpointClaimed) {
        finalScore = 0;
      } else {
        const raw =
          (sub.reportScore ?? 0) * exp.reportRatio +
          (sub.codeScore ?? 0) * exp.codeRatio +
          (sub.acceptanceScore ?? 0) * exp.acceptanceRatio;
        finalScore = Math.max(
          0,
          Math.round((raw - sub.reportPenalty - sub.codePenalty) * 10) / 10,
        );
      }
    }

    return {
      experimentId: exp.id,
      experimentNumber: exp.number,
      experimentName: exp.name,
      type: exp.type,
      dueDate: exp.dueDate,
      courseWeight: exp.courseWeight ?? 0,
      courseScore:
        finalScore !== null ? Math.round((finalScore / 100) * (exp.courseWeight ?? 0) * 100) / 100 : null,
      acceptanceRatio: exp.acceptanceRatio,
      reportRatio: exp.reportRatio,
      codeRatio: exp.codeRatio,
      submission: sub
        ? {
            reportScore: sub.reportScore,
            codeScore: sub.codeScore,
            acceptanceScore: sub.acceptanceScore,
            reportPenalty: sub.reportPenalty,
            codePenalty: sub.codePenalty,
            isPlagiarised: sub.isPlagiarised,
            plagiarismGroup: sub.plagiarismGroup,
            checkpointClaimed: sub.checkpointClaimed,
            remark: sub.remark,
            finalScore,
          }
        : null,
      status: sub
        ? sub.acceptanceScore !== null || sub.reportScore !== null || sub.checkpointClaimed
          ? "GRADED"
          : "PENDING"
        : "NOT_SUBMITTED",
    };
  });

  const totalEarned = grades.reduce((acc, g) => acc + (g.courseScore ?? 0), 0);
  const maxPossible = publishedExperiments.reduce((acc, e) => acc + (e.courseWeight ?? 0), 0);

  return Response.json({
    student: {
      studentId: student.studentId,
      name: student.name,
      role: student.role,
      hasCheckpoint: student.hasCheckpoint,
    },
    board: boardInfo,
    grades,
    courseSummary: {
      totalEarned: Math.round(totalEarned * 100) / 100,
      maxPossible: Math.round(maxPossible * 100) / 100,
    },
  });
});
