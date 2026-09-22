import { prisma } from "@/lib/prisma";
import { requireSession, withAuth } from "@/lib/auth";

export const GET = withAuth(async () => {
  const session = await requireSession();

  const student = await prisma.user.findUnique({
    where: { id: session.id },
    include: {
      boardAssignments: { include: { board: true }, orderBy: { assignedAt: "desc" } },
      submissions: { include: { experiment: true } },
      quizScores: { include: { quiz: true } },
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

  // All experiments (published and unpublished)
  const allExperiments = await prisma.experiment.findMany({
    orderBy: { publishDate: "asc" },
  });

  const submissionsMap = new Map(student.submissions.map((s) => [s.experimentId, s]));

  const formattedExperiments = allExperiments.map((exp) => {
    const isPub = Boolean(exp.isPublished);

    if (!isPub) {
      return {
        itemType: "EXPERIMENT" as const,
        experimentId: exp.id,
        experimentNumber: exp.number,
        experimentName: null,
        type: exp.type,
        publishDate: exp.publishDate,
        dueDate: null,
        totalScore: exp.totalScore,
        courseWeight: exp.courseWeight ?? 0,
        courseScore: 0,
        acceptanceRatio: exp.acceptanceRatio,
        reportRatio: exp.reportRatio,
        codeRatio: exp.codeRatio,
        isPublished: false,
        submission: null,
        status: "UNPUBLISHED" as const,
      };
    }

    const sub = submissionsMap.get(exp.id);
    let finalScore: number | null = null;

    if (sub) {
      if (sub.checkpointClaimed) {
        finalScore = 0;
      } else {
        const rep = sub.reportScore ?? 0;
        const code = sub.codeScore ?? 0;
        const acc = sub.acceptanceScore ?? 0;
        const raw = rep * exp.reportRatio + code * exp.codeRatio + acc * exp.acceptanceRatio;
        finalScore = Math.max(0, Math.round((raw - (sub.reportPenalty || 0) - (sub.codePenalty || 0)) * 10) / 10);
      }
    }

    return {
      itemType: "EXPERIMENT" as const,
      experimentId: exp.id,
      experimentNumber: exp.number,
      experimentName: exp.name,
      type: exp.type,
      publishDate: exp.publishDate,
      dueDate: exp.dueDate,
      totalScore: exp.totalScore,
      courseWeight: exp.courseWeight ?? 0,
      courseScore:
        finalScore !== null ? Math.round((finalScore / 100) * (exp.courseWeight ?? 0) * 100) / 100 : null,
      acceptanceRatio: exp.acceptanceRatio,
      reportRatio: exp.reportRatio,
      codeRatio: exp.codeRatio,
      isPublished: true,
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
          ? ("GRADED" as const)
          : ("PENDING" as const)
        : ("NOT_SUBMITTED" as const),
    };
  });

  // Published quizzes
  const publishedQuizzes = await prisma.quiz.findMany({
    where: { isPublished: true },
    orderBy: { publishDate: "asc" },
  });

  const quizScoreMap = new Map((student.quizScores || []).map((qs) => [qs.quizId, qs]));

  const quizItems = publishedQuizzes.map((q) => {
    const qs = quizScoreMap.get(q.id);
    const score = qs?.score ?? null;
    const courseScore = score !== null ? Math.round((score / q.totalScore) * q.courseWeight * 100) / 100 : null;

    return {
      itemType: "QUIZ" as const,
      id: q.id,
      quizId: q.id,
      name: q.name,
      publishDate: q.publishDate,
      totalScore: q.totalScore,
      courseWeight: q.courseWeight,
      score,
      courseScore,
      remark: qs?.remark || null,
      status: (score !== null ? "GRADED" : "PENDING") as "GRADED" | "PENDING",
    };
  });

  // Timeline ordering: publishDate asc. If same day, QUIZ before EXPERIMENT
  const toDateKey = (d: Date | string) => new Date(d).toISOString().slice(0, 10);

  const timelineItems = [...formattedExperiments, ...quizItems].sort((a, b) => {
    const dateA = toDateKey(a.publishDate);
    const dateB = toDateKey(b.publishDate);

    if (dateA !== dateB) {
      return dateA.localeCompare(dateB);
    }

    if (a.itemType !== b.itemType) {
      return a.itemType === "QUIZ" ? -1 : 1;
    }

    if (a.itemType === "EXPERIMENT" && b.itemType === "EXPERIMENT") {
      return (a.experimentNumber || "").localeCompare(b.experimentNumber || "");
    }

    const nameA = a.itemType === "QUIZ" ? a.name : a.experimentName || "";
    const nameB = b.itemType === "QUIZ" ? b.name : b.experimentName || "";
    return nameA.localeCompare(nameB);
  });

  const totalEarnedCourseScore =
    formattedExperiments.reduce((acc, g) => acc + (g.courseScore || 0), 0) +
    quizItems.reduce((acc, q) => acc + (q.courseScore || 0), 0);

  const totalPossibleWeight =
    allExperiments.reduce((acc, e) => acc + (e.courseWeight || 0), 0) +
    publishedQuizzes.reduce((acc, q) => acc + (q.courseWeight || 0), 0);

  return Response.json({
    student: {
      studentId: student.studentId,
      name: student.name,
      role: student.role,
      hasCheckpoint: student.hasCheckpoint,
    },
    board: boardInfo,
    grades: formattedExperiments,
    timelineItems,
    courseSummary: {
      totalEarned: Math.round(totalEarnedCourseScore * 100) / 100,
      maxPossible: Math.round(totalPossibleWeight * 100) / 100 || 30.0,
    },
  });
});
