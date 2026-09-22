/**
 * Server-only environment access with hard failures on missing required vars.
 */
function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}. See .env.example`);
  }
  return value;
}

export const env = {
  get jwtSecret() {
    return required("JWT_SECRET");
  },
  get databaseUrl() {
    return required("DATABASE_URL");
  },
  get teacherNames() {
    return (process.env.TEACHER_NAMES ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  },
  get teacherPassword() {
    return process.env.TEACHER_PASSWORD ?? "";
  },
  get passkeyRpName() {
    return process.env.PASSKEY_RP_NAME ?? "TA Console";
  },
  get passkeyRpId() {
    return process.env.PASSKEY_RP_ID ?? "localhost";
  },
  get passkeyOrigin() {
    return process.env.PASSKEY_ORIGIN ?? "http://localhost:3000";
  },
  get dingtalkToken() {
    return process.env.DINGTALK_TOKEN ?? "";
  },
  get dingtalkSecret() {
    return process.env.DINGTALK_SECRET ?? "";
  },
  /** Comma-separated student IDs allowed to register/login as TA. */
  get taRoster(): string[] {
    return (process.env.TA_ROSTER ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  },
};
