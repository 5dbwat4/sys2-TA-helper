import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireStaff, withAuth } from "@/lib/auth";

export const GET = withAuth(async () => {
  await requireStaff();

  const quizzes = await prisma.quiz.findMany({
    orderBy: { publishDate: "desc" },
    include: {
      scores: {
        select: {
          id: true,
          studentId: true,
          score: true,
        },
      },
    },
  });

  const totalStudents = await prisma.user.count({
    where: { role: "STUDENT" },
  });

  const formatted = quizzes.map((q) => {
    const gradedCount = q.scores.filter((s) => s.score !== null).length;
    const totalScoreSum = q.scores.reduce((acc, s) => acc + (s.score || 0), 0);
    const avgScore = gradedCount > 0 ? Math.round((totalScoreSum / gradedCount) * 10) / 10 : 0;

    return {
      id: q.id,
      name: q.name,
      courseWeight: q.courseWeight,
      totalScore: q.totalScore,
      publishDate: q.publishDate,
      isPublished: q.isPublished,
      createdAt: q.createdAt,
      totalStudents,
      gradedCount,
      avgScore,
    };
  });

  return Response.json({ success: true, quizzes: formatted });
});

const createQuizSchema = z.object({
  name: z.string().min(1),
  courseWeight: z.coerce.number().min(0),
  totalScore: z.coerce.number().default(100),
  publishDate: z.string().optional(),
  isPublished: z.boolean().default(false),
});

export const POST = withAuth(async (request: Request) => {
  await requireStaff();
  const body = createQuizSchema.parse(await request.json());

  const quiz = await prisma.quiz.create({
    data: {
      name: body.name.trim(),
      courseWeight: body.courseWeight,
      totalScore: body.totalScore || 100,
      publishDate: body.publishDate ? new Date(body.publishDate) : new Date(),
      isPublished: Boolean(body.isPublished),
    },
  });

  return Response.json({ success: true, quiz });
});

const patchQuizSchema = z.object({
  id: z.string().min(1),
  name: z.string().optional(),
  courseWeight: z.coerce.number().optional(),
  totalScore: z.coerce.number().optional(),
  publishDate: z.string().optional(),
  isPublished: z.boolean().optional(),
});

export const PATCH = withAuth(async (request: Request) => {
  await requireStaff();
  const body = patchQuizSchema.parse(await request.json());

  const updateData: any = {};
  if (body.isPublished !== undefined) updateData.isPublished = Boolean(body.isPublished);
  if (body.name !== undefined) updateData.name = body.name.trim();
  if (body.courseWeight !== undefined) updateData.courseWeight = body.courseWeight;
  if (body.totalScore !== undefined) updateData.totalScore = body.totalScore;
  if (body.publishDate !== undefined) updateData.publishDate = new Date(body.publishDate);

  const updated = await prisma.quiz.update({
    where: { id: body.id },
    data: updateData,
  });

  return Response.json({ success: true, quiz: updated });
});

export const DELETE = withAuth(async (request: Request) => {
  await requireStaff();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return Response.json({ error: "MISSING_ID" }, { status: 400 });

  await prisma.quiz.delete({
    where: { id },
  });

  return Response.json({ success: true });
});
