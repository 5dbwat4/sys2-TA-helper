import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireStaff, withAuth } from "@/lib/auth";
import { getPinyinInitials } from "@/lib/pinyin";

export const GET = withAuth(async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
  await requireStaff();
  const { id: quizId } = await params;

  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
  });

  if (!quiz) {
    return Response.json({ error: "QUIZ_NOT_FOUND" }, { status: 404 });
  }

  // Get all students
  const students = await prisma.user.findMany({
    where: { role: "STUDENT" },
    orderBy: { studentId: "asc" },
    select: {
      id: true,
      studentId: true,
      name: true,
    },
  });

  // Get all scores for this quiz
  const existingScores = await prisma.quizScore.findMany({
    where: { quizId },
  });

  const scoreMap = new Map(existingScores.map((s) => [s.studentId, s]));

  const roster = students.map((st) => {
    const qs = scoreMap.get(st.id);
    return {
      id: st.id,
      studentId: st.studentId,
      name: st.name,
      pinyinInitial: getPinyinInitials(st.name),
      score: qs ? qs.score : null,
      remark: qs?.remark || "",
      updatedAt: qs?.updatedAt || null,
    };
  });

  return Response.json({
    success: true,
    quiz,
    roster,
  });
});

const singleScoreSchema = z.object({
  studentId: z.string().min(1),
  score: z.union([z.number(), z.string(), z.null()]).optional(),
  remark: z.string().nullable().optional(),
});

const batchScoreSchema = z.object({
  entries: z.array(
    z.object({
      studentId: z.string().min(1),
      score: z.union([z.number(), z.string(), z.null()]).optional(),
      remark: z.string().nullable().optional(),
    }),
  ),
});

const postSchema = z.union([batchScoreSchema, singleScoreSchema]);

export const POST = withAuth(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  await requireStaff();
  const { id: quizId } = await params;

  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
  });

  if (!quiz) {
    return Response.json({ error: "QUIZ_NOT_FOUND" }, { status: 404 });
  }

  const json = await request.json();
  const body = postSchema.parse(json);

  const num = (v: unknown): number | null =>
    v === null || v === undefined || v === "" ? null : parseFloat(String(v));

  // Batch mode
  if ("entries" in body && Array.isArray(body.entries)) {
    const updates = [];
    for (const entry of body.entries) {
      if (!entry.studentId) continue;
      const student = await prisma.user.findFirst({
        where: {
          OR: [{ id: entry.studentId }, { studentId: entry.studentId }],
        },
      });
      if (!student) continue;

      const scoreVal = num(entry.score);
      updates.push(
        prisma.quizScore.upsert({
          where: {
            quizId_studentId: {
              quizId,
              studentId: student.id,
            },
          },
          update: {
            score: scoreVal,
            remark: entry.remark ?? null,
          },
          create: {
            quizId,
            studentId: student.id,
            score: scoreVal,
            remark: entry.remark ?? null,
          },
        }),
      );
    }

    await prisma.$transaction(updates);
    return Response.json({ success: true, count: updates.length });
  }

  // Single continuous entry mode
  if ("studentId" in body) {
    const student = await prisma.user.findFirst({
      where: {
        OR: [{ id: body.studentId }, { studentId: body.studentId }],
      },
    });

    if (!student) {
      return Response.json({ error: "STUDENT_NOT_FOUND" }, { status: 404 });
    }

    const scoreVal = num(body.score);

    const saved = await prisma.quizScore.upsert({
      where: {
        quizId_studentId: {
          quizId,
          studentId: student.id,
        },
      },
      update: {
        score: scoreVal,
        remark: body.remark ?? null,
      },
      create: {
        quizId,
        studentId: student.id,
        score: scoreVal,
        remark: body.remark ?? null,
      },
    });

    return Response.json({
      success: true,
      quizScore: saved,
      student: {
        id: student.id,
        studentId: student.studentId,
        name: student.name,
      },
    });
  }

  return Response.json({ error: "INVALID_REQUEST" }, { status: 400 });
});
