import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { setSessionCookie, withAuth } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";

const bodySchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

/** TA username + password login (credentials set during first-time setup). */
export const POST = withAuth(async (request: Request) => {
  const { username, password } = bodySchema.parse(await request.json());

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || user.role !== "TA" || !user.passwordHash) {
    return Response.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    return Response.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });
  }

  await setSessionCookie({ id: user.id, studentId: user.studentId, name: user.name, role: "TA" });
  return Response.json({ user: { studentId: user.studentId, name: user.name, role: user.role } });
});
