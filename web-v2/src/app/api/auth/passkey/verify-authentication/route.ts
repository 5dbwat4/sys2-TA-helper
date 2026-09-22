import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { prisma } from "@/lib/prisma";
import { setSessionCookie, withAuth, type Role } from "@/lib/auth";
import { env } from "@/lib/env";

export const POST = withAuth(async (request: Request) => {
  const body = await request.json();
  const store = await cookies();
  const challengeToken = store.get("passkey_challenge")?.value;
  if (!challengeToken) return Response.json({ error: "MISSING_CHALLENGE" }, { status: 400 });

  let session: { challenge: string };
  try {
    session = jwt.verify(challengeToken, env.jwtSecret) as typeof session;
  } catch {
    return Response.json({ error: "INVALID_CHALLENGE" }, { status: 400 });
  }

  const passkey = await prisma.passkey.findUnique({
    where: { id: body.id },
    include: { user: true },
  });
  if (!passkey) return Response.json({ error: "PASSKEY_NOT_FOUND" }, { status: 404 });

  const verification = await verifyAuthenticationResponse({
    response: body,
    expectedChallenge: session.challenge,
    expectedOrigin: env.passkeyOrigin,
    expectedRPID: env.passkeyRpId,
    credential: {
      id: passkey.id,
      publicKey: new Uint8Array(passkey.publicKey),
      counter: Number(passkey.counter),
      transports: passkey.transports ? (passkey.transports.split(",") as never[]) : undefined,
    },
  }).catch((err: Error) => ({ error: err.message }) as never);

  if ("error" in verification) {
    return Response.json({ error: verification.error }, { status: 400 });
  }
  if (!verification.verified) {
    return Response.json({ error: "VERIFICATION_FAILED" }, { status: 400 });
  }

  await prisma.passkey.update({
    where: { id: passkey.id },
    data: { counter: BigInt(verification.authenticationInfo.newCounter) },
  });

  store.delete("passkey_challenge");
  await setSessionCookie({
    id: passkey.user.id,
    studentId: passkey.user.studentId,
    name: passkey.user.name,
    role: passkey.user.role as Role,
  });

  return Response.json({ verified: true, role: passkey.user.role });
});
