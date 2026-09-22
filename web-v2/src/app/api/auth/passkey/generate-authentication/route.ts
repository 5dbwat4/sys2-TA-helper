import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { env } from "@/lib/env";

export async function GET() {
  const options = await generateAuthenticationOptions({
    rpID: env.passkeyRpId,
    userVerification: "preferred",
  });

  const challengeToken = jwt.sign({ challenge: options.challenge }, env.jwtSecret, {
    expiresIn: "5m",
  });

  const store = await cookies();
  store.set("passkey_challenge", challengeToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 300,
    path: "/",
  });

  return Response.json(options);
}
