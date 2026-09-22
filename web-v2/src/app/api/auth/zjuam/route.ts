import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { setSessionCookie, setSetupTicket, withAuth } from "@/lib/auth";
import { env } from "@/lib/env";
import { ZJUAM } from "@/lib/zju/zjuam";

const bodySchema = z.object({
  account: z.string().min(1),
  password: z.string().min(1),
  /**
   * "local"  — verify against ZJUAM only; credentials are NOT persisted.
   * "remote" — persist credentials so the system can sync with courses.zju.edu.cn.
   * Default: "local" (privacy-first; see settings page).
   */
  scope: z.enum(["local", "remote"]).default("local"),
});

export const POST = withAuth(async (request: Request) => {
  const { account, password, scope } = bodySchema.parse(await request.json());

  // 1. Roster check — only whitelisted student IDs may be TA
  if (!env.taRoster.includes(account)) {
    return Response.json({ error: "NOT_IN_TA_ROSTER" }, { status: 403 });
  }

  // 2. Verify against ZJUAM CAS
  try {
    const zjuam = new ZJUAM(account, password);
    await zjuam.login();
  } catch {
    return Response.json({ error: "ZJUAM_FAILED" }, { status: 401 });
  }

  const existing = await prisma.user.findUnique({ where: { studentId: account } });

  // 3a. First time (or profile incomplete) → issue a setup ticket, no session yet
  if (!existing || !existing.username) {
    await setSetupTicket({ studentId: account, name: existing?.name ?? account });
    if (existing && scope === "remote") {
      await prisma.user.update({
        where: { id: existing.id },
        data: { role: "TA", zjuamAccount: account, zjuamPassword: password },
      });
    }
    return Response.json({ status: "SETUP_REQUIRED" });
  }

  // 3b. Returning TA with complete profile → full session
  const user = await prisma.user.update({
    where: { id: existing.id },
    data: {
      role: "TA",
      // Only persist ZJUAM credentials when the user explicitly opts in
      ...(scope === "remote"
        ? { zjuamAccount: account, zjuamPassword: password }
        : {}),
    },
  });

  await setSessionCookie({ id: user.id, studentId: user.studentId, name: user.name, role: "TA" });
  return Response.json({
    status: "OK",
    user: { studentId: user.studentId, name: user.name, role: user.role },
  });
});
