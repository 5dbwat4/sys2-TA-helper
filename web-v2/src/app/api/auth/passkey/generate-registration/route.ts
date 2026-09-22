import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { prisma } from "@/lib/prisma";
import { getSession, getSetupTicket, withAuth } from "@/lib/auth";
import { env } from "@/lib/env";

/**
 * Registration options for binding a new passkey.
 * Allowed when either:
 *  - fully logged in (normal case), or
 *  - holding a setup ticket (first-time TA setup flow, before session exists).
 */
export const GET = withAuth(async () => {
  const session = await getSession();
  const ticket = session ? null : await getSetupTicket();
  if (!session && !ticket) {
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const studentId = session?.studentId ?? ticket!.studentId;
  const user = await prisma.user.findUnique({ where: { studentId } });

  // During setup the user row may not exist yet — WebAuthn user handle can be
  // the studentId; verify step resolves/upserts the user via the same ticket.
  const userHandle = user?.id ?? studentId;
  const userPasskeys = user
    ? await prisma.passkey.findMany({ where: { userId: user.id } })
    : [];

  const options = await generateRegistrationOptions({
    rpName: env.passkeyRpName,
    rpID: env.passkeyRpId,
    userName: studentId,
    attestationType: "none",
    excludeCredentials: userPasskeys.map((pk) => ({
      id: pk.id,
      transports: pk.transports ? (pk.transports.split(",") as never[]) : undefined,
    })),
    authenticatorSelection: { residentKey: "required", userVerification: "preferred" },
  });

  const challengeToken = jwt.sign(
    { challenge: options.challenge, userId: userHandle, setupStudentId: ticket?.studentId },
    env.jwtSecret,
    { expiresIn: "5m" },
  );

  const store = await cookies();
  store.set("passkey_challenge", challengeToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 300,
    path: "/",
  });

  return Response.json(options);
});
