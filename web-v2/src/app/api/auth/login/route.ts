import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { setSessionCookie, withAuth } from "@/lib/auth";
import { env } from "@/lib/env";

const studentSchema = z.object({
  mode: z.literal("student"),
  studentId: z.string().min(1),
  name: z.string().min(1),
});

const teacherSchema = z.object({
  mode: z.literal("teacher"),
  name: z.string().min(1),
  password: z.string().min(1),
});

const bodySchema = z.discriminatedUnion("mode", [studentSchema, teacherSchema]);

export const POST = withAuth(async (request: Request) => {
  const body = bodySchema.parse(await request.json());

  if (body.mode === "student") {
    const user = await prisma.user.findUnique({ where: { studentId: body.studentId } });
    if (!user || user.name !== body.name || user.role !== "STUDENT") {
      return Response.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });
    }
    await setSessionCookie({ id: user.id, studentId: user.studentId, name: user.name, role: "STUDENT" });
    return Response.json({ user: { studentId: user.studentId, name: user.name, role: user.role } });
  }

  // teacher
  if (!env.teacherNames.includes(body.name) || !env.teacherPassword || body.password !== env.teacherPassword) {
    return Response.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });
  }
  const user = await prisma.user.upsert({
    where: { studentId: `TEACHER_${body.name}` },
    update: { name: body.name, role: "TEACHER" },
    create: { studentId: `TEACHER_${body.name}`, name: body.name, role: "TEACHER" },
  });
  await setSessionCookie({ id: user.id, studentId: user.studentId, name: user.name, role: "TEACHER" });
  return Response.json({ user: { studentId: user.studentId, name: user.name, role: user.role } });
});
