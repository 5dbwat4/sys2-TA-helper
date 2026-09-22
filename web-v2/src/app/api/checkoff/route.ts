import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireStaff, withAuth } from "@/lib/auth";

export const GET = withAuth(async (request: Request) => {
  await requireStaff();

  const { searchParams } = new URL(request.url);
  const experimentId = searchParams.get("experimentId");
  const q = searchParams.get("q")?.trim() ?? "";

  const experiments = await prisma.experiment.findMany({
    orderBy: { number: "asc" },
    include: { questions: { select: { id: true, content: true } } },
  });

  const currentExperiment =
    experiments.find((e) => e.id === experimentId) ??
    experiments.find((e) => e.isPublished) ??
    experiments[0] ??
    null;

  type MatchedStudent = {
    id: string;
    studentId: string;
    name: string;
    pinyin: string | null;
    hasCheckpoint: boolean;
    board: unknown;
    submission: unknown;
  };
  const matchedStudents: MatchedStudent[] = [];

  if (q && currentExperiment) {
    const qLower = q.toLowerCase();
    const qClean = qLower.replace(/[-\s_]/g, "");

    const allStudents = await prisma.user.findMany({
      where: { role: "STUDENT" },
      include: {
        boardAssignments: {
          where: { isReturned: false },
          orderBy: { assignedAt: "desc" },
          include: {
            board: {
              include: {
                assignments: { where: { isReturned: false }, include: { student: true } },
              },
            },
          },
        },
        submissions: { where: { experimentId: currentExperiment.id } },
      },
    });

    for (const st of allStudents) {
      const pinyin = st.pinyin ?? "";
      const pinyinInitials = st.pinyinInitials ?? "";
      const active = st.boardAssignments[0];
      const board = active?.board;

      const pinyinHit =
        (pinyin.length > 0 && (pinyin.includes(qClean) || pinyin.includes(qLower))) ||
        (pinyinInitials.length > 0 &&
          (pinyinInitials.includes(qClean) || pinyinInitials.includes(qLower)));

      let matches =
        st.studentId.toLowerCase().includes(qLower) ||
        st.studentId.endsWith(q) ||
        st.name.includes(q) ||
        pinyinHit;

      if (!matches) {
        for (const ba of st.boardAssignments) {
          const dbClean = ba.board.dbNo.toLowerCase().replace(/[-\s_]/g, "");
          const assetClean = ba.board.assetNo.toLowerCase().replace(/[-\s_]/g, "");
          if (
            (qClean && (dbClean.includes(qClean) || assetClean.includes(qClean))) ||
            ba.board.dbNo.toLowerCase().includes(qLower) ||
            ba.board.assetNo.toLowerCase().includes(qLower)
          ) {
            matches = true;
            break;
          }
        }
      }

      if (!matches) continue;

      const teamMembers = board
        ? board.assignments.map((a) => a.student.name).filter((n) => n !== st.name)
        : [];
      const sub = st.submissions[0] ?? null;

      matchedStudents.push({
        id: st.id,
        studentId: st.studentId,
        name: st.name,
        pinyin: st.pinyinInitials,
        hasCheckpoint: st.hasCheckpoint,
        board: board
          ? {
              id: board.id,
              assetNo: board.assetNo,
              dbNo: board.dbNo,
              contactPhone: board.contactPhone,
              isShared: teamMembers.length > 0,
              teamMembers,
            }
          : null,
        submission: sub
          ? {
              id: sub.id,
              acceptanceScore: sub.acceptanceScore,
              reportScore: sub.reportScore,
              codeScore: sub.codeScore,
              reportPenalty: sub.reportPenalty,
              codePenalty: sub.codePenalty,
              checkpointClaimed: sub.checkpointClaimed,
              remark: sub.remark,
            }
          : null,
      });
    }
  }

  return Response.json({ experiments, currentExperiment, matchedStudents });
});

const postSchema = z.object({
  experimentId: z.string().min(1),
  studentId: z.string().min(1),
  rawAcceptanceScore: z.union([z.number(), z.string(), z.null()]).optional(),
  rawCodeScore: z.union([z.number(), z.string(), z.null()]).optional(),
  checkpointClaimed: z.boolean().optional(),
  remark: z.string().nullable().optional(),
});

export const POST = withAuth(async (request: Request) => {
  await requireStaff();

  const body = postSchema.parse(await request.json());
  const checkpointClaimed = body.checkpointClaimed ?? false;

  const experiment = await prisma.experiment.findUnique({ where: { id: body.experimentId } });
  if (!experiment) return Response.json({ error: "EXPERIMENT_NOT_FOUND" }, { status: 404 });

  const student = await prisma.user.findFirst({
    where: { OR: [{ id: body.studentId }, { studentId: body.studentId }] },
  });
  if (!student) return Response.json({ error: "STUDENT_NOT_FOUND" }, { status: 404 });

  const clamp = (v: unknown): number | null => {
    if (v === undefined || v === null || v === "") return null;
    return Math.min(100, Math.max(0, parseFloat(String(v))));
  };

  const acceptanceScore = checkpointClaimed ? 0 : clamp(body.rawAcceptanceScore);
  const codeScore = checkpointClaimed ? 0 : clamp(body.rawCodeScore);
  const remark = body.remark ?? (checkpointClaimed ? "申领了Checkpoint" : null);

  const submission = await prisma.submission.upsert({
    where: { studentId_experimentId: { studentId: student.id, experimentId: experiment.id } },
    update: {
      acceptanceScore,
      ...(codeScore !== null ? { codeScore } : {}),
      checkpointClaimed,
      remark,
    },
    create: {
      studentId: student.id,
      experimentId: experiment.id,
      acceptanceScore,
      codeScore,
      checkpointClaimed,
      remark,
    },
  });

  const accComp = (submission.acceptanceScore ?? 0) * experiment.acceptanceRatio;
  const repComp = (submission.reportScore ?? 0) * experiment.reportRatio;
  const codeComp = (submission.codeScore ?? 0) * experiment.codeRatio;
  const rawTotal = accComp + repComp + codeComp;
  const finalScore = checkpointClaimed
    ? 0
    : Math.max(
        0,
        Math.round((rawTotal - (submission.reportPenalty ?? 0) - (submission.codePenalty ?? 0)) * 10) / 10,
      );
  const courseContribution =
    Math.round((finalScore / 100) * (experiment.courseWeight ?? 0) * 100) / 100;

  return Response.json({
    submission,
    converted: {
      acceptanceScore: submission.acceptanceScore,
      acceptanceComponent: Math.round(accComp * 10) / 10,
      codeScore: submission.codeScore,
      codeComponent: Math.round(codeComp * 10) / 10,
      finalScore,
      courseContribution,
      courseWeight: experiment.courseWeight,
    },
  });
});
