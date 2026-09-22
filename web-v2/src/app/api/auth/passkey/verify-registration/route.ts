import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { env } from "@/lib/env";

export const POST = withAuth(async (request: Request) => {
  const body = await request.json();
  const store = await cookies();
  const challengeToken = store.get("passkey_challenge")?.value;
  if (!challengeToken) return Response.json({ error: "MISSING_CHALLENGE" }, { status: 400 });

  let session: { challenge: string; userId: string };
  try {
    session = jwt.verify(challengeToken, env.jwtSecret) as typeof session;
  } catch {
    return Response.json({ error: "INVALID_CHALLENGE" }, { status: 400 });
  }

  const verification = await verifyRegistrationResponse({
    response: body,
    expectedChallenge: session.challenge,
    expectedOrigin: env.passkeyOrigin,
    expectedRPID: env.passkeyRpId,
  }).catch((err: Error) => ({ error: err.message }) as never);

  if ("error" in verification) {
    return Response.json({ error: verification.error }, { status: 400 });
  }

  const { verified, registrationInfo } = verification;
  if (!verified || !registrationInfo) {
    return Response.json({ error: "VERIFICATION_FAILED" }, { status: 400 });
  }

  const { credential, credentialDeviceType, credentialBackedUp } = registrationInfo;

  await prisma.passkey.create({
    data: {
      id: credential.id,
      userId: session.userId,
      publicKey: Buffer.from(credential.publicKey),
      counter: BigInt(credential.counter),
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
      transports: credential.transports ? credential.transports.join(",") : null,
    },
  });

  store.delete("passkey_challenge");
  return Response.json({ verified: true });
});
