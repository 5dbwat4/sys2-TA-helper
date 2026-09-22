import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { prisma } from "@/lib/prisma";
import { requireSession, withAuth } from "@/lib/auth";
import { env } from "@/lib/env";

export const GET = withAuth(async () => {
  const session = await requireSession();
  const user = await prisma.user.findUnique({ where: { id: session.id } });
  if (!user) return Response.json({ error: "USER_NOT_FOUND" }, { status: 404 });

  const userPasskeys = await prisma.passkey.findMany({ where: { userId: user.id } });

  const options = await generateRegistrationOptions({
    rpName: env.passkeyRpName,
    rpID: env.passkeyRpId,
    userName: user.studentId,
    attestationType: "none",
    excludeCredentials: userPasskeys.map((pk) => ({
      id: pk.id,
      transports: pk.transports ? (pk.transports.split(",") as never[]) : undefined,
    })),
    authenticatorSelection: { residentKey: "required", userVerification: "preferred" },
  });

  const challengeToken = jwt.sign(
    { challenge: options.challenge, userId: user.id },
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
