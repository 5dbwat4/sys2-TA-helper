/**
 * Standalone TA seeder.
 *
 * Usage (from the web-v2 directory):
 *   node prisma/seed-ta.js                          # insert the default TA list below
 *   node prisma/seed-ta.js 3240102049 3240102120    # insert specific student IDs
 *   node prisma/seed-ta.js 3240102049:5dbwat4       # optionally override the display name
 *
 * Each entry is upserted into the `User` table with role="TA", which is what the
 * ZJUAM login route falls back to when TA_ROSTER is left empty.
 */
const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");
const { pinyin } = require("pinyin-pro");

// Bare `node` does not load .env — do it ourselves so DATABASE_URL is available.
function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const match = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const key = match[1];
    if (process.env[key] !== undefined) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnv();

const prisma = new PrismaClient();

/** Default TAs inserted when no CLI arguments are given. */
const DEFAULT_TAS = [
  { studentId: "3240102049", name: "5dbwat4" },
  { studentId: "3240102120", name: "AlabTNT" },
  { studentId: "3240102072", name: "Taolu" },
];

function computePinyin(name) {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return { pinyin: null, pinyinInitials: null };
  const full = pinyin(trimmed, { toneType: "none", type: "array", nonZh: "consecutive" })
    .join("")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  const initials = pinyin(trimmed, {
    pattern: "first",
    toneType: "none",
    type: "array",
    nonZh: "consecutive",
  })
    .join("")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  return { pinyin: full || null, pinyinInitials: initials || null };
}

function parseArg(arg) {
  const idx = arg.indexOf(":");
  if (idx === -1) return { studentId: arg.trim(), name: undefined };
  return {
    studentId: arg.slice(0, idx).trim(),
    name: arg.slice(idx + 1).trim() || undefined,
  };
}

function resolveTAs() {
  const args = process.argv.slice(2);
  if (args.length === 0) return DEFAULT_TAS;
  return args.filter(Boolean).map(parseArg);
}

async function main() {
  const tas = resolveTAs().filter((ta) => ta.studentId);

  if (tas.length === 0) {
    console.error("No student IDs provided. Pass them as arguments, e.g. node prisma/seed-ta.js 3240102049");
    process.exit(1);
  }

  console.log(`Seeding ${tas.length} TA(s)...\n`);

  for (const ta of tas) {
    const existing = await prisma.user.findUnique({ where: { studentId: ta.studentId } });
    const finalName = ta.name ?? existing?.name ?? ta.studentId;
    const py = computePinyin(finalName);

    const user = await prisma.user.upsert({
      where: { studentId: ta.studentId },
      update: { role: "TA", name: finalName, ...py },
      create: { studentId: ta.studentId, name: finalName, role: "TA", ...py },
    });

    const action = !existing
      ? "created"
      : existing.role === "TA"
        ? "updated"
        : `promoted from ${existing.role}`;
    console.log(`  [${action}] ${user.studentId} → ${user.name} (role=${user.role})`);
  }

  // Keep TA_ROSTER guidance in sync with what we just wrote.
  const roster = (process.env.TA_ROSTER ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (roster.length > 0) {
    const missing = tas
      .map((t) => t.studentId)
      .filter((id) => !roster.includes(id));
    if (missing.length > 0) {
      console.log(
        `\nNote: TA_ROSTER is set and does not include: ${missing.join(", ")}.` +
          `\nThey will be blocked by the whitelist until added to TA_ROSTER.`,
      );
    }
  }

  console.log("\nDone.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
