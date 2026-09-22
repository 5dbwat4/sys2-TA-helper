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
  const teacherPasswords: Record<string, string> = {
    '吴磊': process.env.TEACHER_WULEI_PWD || 'ZJU-sys2_fa26@WL',
    '卢立': process.env.TEACHER_LULI_PWD || 'ZJU-sys2_fa26@LL',
  };

  const validPassword = teacherPasswords[body.name] || (env.teacherNames.includes(body.name) && env.teacherPassword ? env.teacherPassword : null);

  if (!validPassword || body.password !== validPassword) {
    return Response.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });
  }

  const teacherId = body.name === '吴磊' ? 'teacher_wulei' : body.name === '卢立' ? 'teacher_luli' : `TEACHER_${body.name}`;
  const user = await prisma.user.upsert({
    where: { studentId: teacherId },
    update: { name: body.name, role: "TEACHER" },
    create: { studentId: teacherId, name: body.name, role: "TEACHER" },
  });
  await setSessionCookie({ id: user.id, studentId: user.studentId, name: user.name, role: "TEACHER" });
  return Response.json({ user: { studentId: user.studentId, name: user.name, role: user.role } });
});
