import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireStaff, withAuth } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";

/**
 * GET → current account state (username, hasPassword, passkeys, zjuam binding).
 */
export const GET = withAuth(async () => {
  const session = await requireStaff();
  const user = await prisma.user.findUnique({
    where: { id: session.id },
    include: { passkeys: { select: { id: true, createdAt: true, deviceType: true } } },
  });
  if (!user) return Response.json({ error: "USER_NOT_FOUND" }, { status: 404 });

  return Response.json({
    studentId: user.studentId,
    name: user.name,
    username: user.username,
    hasPassword: Boolean(user.passwordHash),
    passkeys: user.passkeys,
    zjuam: {
      boundRemotely: Boolean(user.zjuamAccount),
      account: user.zjuamAccount ?? null,
    },
  });
});

const patchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("set_username"),
    username: z.string().min(2).max(32).regex(/^[a-zA-Z0-9_.-]+$/, "USERNAME_CHARSET"),
  }),
  z.object({
    action: z.literal("set_password"),
    newPassword: z.string().min(8).max(128),
    // Required only when a password already exists
    currentPassword: z.string().optional(),
  }),
  z.object({ action: z.literal("remove_password") }),
  z.object({ action: z.literal("remove_passkey"), passkeyId: z.string().min(1) }),
  z.object({
    action: z.literal("zjuam_save_remote"),
    account: z.string().min(1),
    password: z.string().min(1),
  }),
  z.object({ action: z.literal("zjuam_remove_remote") }),
]);

export const PATCH = withAuth(async (request: Request) => {
  const session = await requireStaff();
  const body = patchSchema.parse(await request.json());

  const user = await prisma.user.findUnique({ where: { id: session.id } });
  if (!user) return Response.json({ error: "USER_NOT_FOUND" }, { status: 404 });

  switch (body.action) {
    case "set_username": {
      const conflict = await prisma.user.findUnique({ where: { username: body.username } });
      if (conflict && conflict.id !== user.id) {
        return Response.json({ error: "USERNAME_TAKEN" }, { status: 409 });
      }
      await prisma.user.update({ where: { id: user.id }, data: { username: body.username } });
      return Response.json({ ok: true, username: body.username });
    }

    case "set_password": {
      if (user.passwordHash) {
        const ok =
          body.currentPassword && (await verifyPassword(body.currentPassword, user.passwordHash));
        if (!ok) return Response.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });
      }
      const passwordHash = await hashPassword(body.newPassword);
      await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
      return Response.json({ ok: true });
    }

    case "remove_password": {
      // Password is an optional convenience sign-in method; ZJUAM/token
      // always remains available as the primary identity, so removal is
      // unconditional.
      await prisma.user.update({ where: { id: user.id }, data: { passwordHash: null } });
      return Response.json({ ok: true });
    }

    case "remove_passkey": {
      const passkey = await prisma.passkey.findUnique({ where: { id: body.passkeyId } });
      if (!passkey || passkey.userId !== user.id) {
        return Response.json({ error: "PASSKEY_NOT_FOUND" }, { status: 404 });
      }
      await prisma.passkey.delete({ where: { id: body.passkeyId } });
      return Response.json({ ok: true });
    }

    case "zjuam_save_remote": {
      await prisma.user.update({
        where: { id: user.id },
        data: { zjuamAccount: body.account, zjuamPassword: body.password },
      });
      return Response.json({ ok: true });
    }

    case "zjuam_remove_remote": {
      await prisma.user.update({
        where: { id: user.id },
        data: { zjuamAccount: null, zjuamPassword: null },
      });
      return Response.json({ ok: true });
    }
  }
});
