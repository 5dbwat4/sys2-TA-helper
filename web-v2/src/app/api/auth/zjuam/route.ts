import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { setSessionCookie, withAuth } from "@/lib/auth";
import { ZJUAM } from "@/lib/zju/zjuam";

const bodySchema = z.object({
  account: z.string().min(1),
  password: z.string().min(1),
});

export const POST = withAuth(async (request: Request) => {
  const { account, password } = bodySchema.parse(await request.json());

  try {
    const zjuam = new ZJUAM(account, password);
    await zjuam.login();
  } catch {
    return Response.json({ error: "ZJUAM_FAILED" }, { status: 401 });
  }

  const user = await prisma.user.upsert({
    where: { studentId: account },
    update: { role: "TA", zjuamAccount: account, zjuamPassword: password },
    create: {
      studentId: account,
      name: account,
      role: "TA",
      zjuamAccount: account,
      zjuamPassword: password,
    },
  });

  await setSessionCookie({ id: user.id, studentId: user.studentId, name: user.name, role: "TA" });
  return Response.json({ user: { studentId: user.studentId, name: user.name, role: user.role } });
});
