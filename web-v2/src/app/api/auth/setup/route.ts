import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  clearSetupTicket,
  getSetupTicket,
  setSessionCookie,
  withAuth,
} from "@/lib/auth";
import { hashPassword } from "@/lib/password";

const bodySchema = z.object({
  username: z
    .string()
    .min(2)
    .max(32)
    .regex(/^[a-zA-Z0-9_.-]+$/, "USERNAME_CHARSET"),
  password: z.string().min(8).max(128).optional().or(z.literal("").transform(() => undefined)),
});

/**
 * GET  → current setup ticket info (who is setting up their profile).
 * POST → complete first-time TA profile setup. Username required;
 *        password optional (can rely on passkey/ZJUAM instead).
 */
export const GET = withAuth(async () => {
  const ticket = await getSetupTicket();
  if (!ticket) return Response.json({ error: "NO_SETUP_TICKET" }, { status: 401 });
  return Response.json({ studentId: ticket.studentId });
});

export const POST = withAuth(async (request: Request) => {
  const ticket = await getSetupTicket();
  if (!ticket) return Response.json({ error: "NO_SETUP_TICKET" }, { status: 401 });

  const body = bodySchema.parse(await request.json());

  // Username uniqueness
  const conflict = await prisma.user.findUnique({ where: { username: body.username } });
  if (conflict) return Response.json({ error: "USERNAME_TAKEN" }, { status: 409 });

  const passwordHash = body.password ? await hashPassword(body.password) : null;

  const user = await prisma.user.upsert({
    where: { studentId: ticket.studentId },
    update: {
      username: body.username,
      ...(passwordHash ? { passwordHash } : {}),
      role: "TA",
    },
    create: {
      studentId: ticket.studentId,
      name: ticket.name,
      username: body.username,
      passwordHash,
      role: "TA",
    },
  });

  await clearSetupTicket();
  await setSessionCookie({ id: user.id, studentId: user.studentId, name: user.name, role: "TA" });

  return Response.json({
    user: { studentId: user.studentId, name: user.name, role: user.role, username: user.username },
  });
});
