import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireStaff, withAuth } from "@/lib/auth";
import { exec } from "child_process";
import util from "util";
import path from "path";
import fs from "fs";

const execAsync = util.promisify(exec);

function computeFinalScore(
  sub: {
    acceptanceScore: number | null;
    reportScore: number | null;
    codeScore: number | null;
    reportPenalty: number;
    codePenalty: number;
    checkpointClaimed: boolean;
  },
  exp: { acceptanceRatio: number; reportRatio: number; codeRatio: number },
): number | null {
  if (sub.checkpointClaimed) return 0;
  if (sub.acceptanceScore === null && sub.reportScore === null && sub.codeScore === null) return null;
  const raw =
    (sub.acceptanceScore ?? 0) * exp.acceptanceRatio +
    (sub.reportScore ?? 0) * exp.reportRatio +
    (sub.codeScore ?? 0) * exp.codeRatio;
  return Math.max(0, Math.round((raw - sub.reportPenalty - sub.codePenalty) * 10) / 10);
}

export const GET = withAuth(async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
  await requireStaff();
  const { id: experimentId } = await params;

  const experiment = await prisma.experiment.findUnique({
    where: { id: experimentId },
    include: { questions: true },
  });
  if (!experiment) return Response.json({ error: "EXPERIMENT_NOT_FOUND" }, { status: 404 });

  const students = await prisma.user.findMany({
    where: { role: "STUDENT" },
    orderBy: { studentId: "asc" },
    include: { submissions: { where: { experimentId } } },
  });

  const roster = students.map((st) => {
    const sub = st.submissions[0] ?? null;
    return {
      id: st.id,
      studentId: st.studentId,
      name: st.name,
      hasCheckpoint: st.hasCheckpoint,
      submission: sub
        ? {
            id: sub.id,
            acceptanceScore: sub.acceptanceScore,
            reportScore: sub.reportScore,
            codeScore: sub.codeScore,
            reportPenalty: sub.reportPenalty,
            codePenalty: sub.codePenalty,
            isPlagiarised: sub.isPlagiarised,
            plagiarismGroup: sub.plagiarismGroup,
            checkpointClaimed: sub.checkpointClaimed,
            remark: sub.remark,
            submitTime: sub.submitTime,
            finalScore: computeFinalScore(sub, experiment),
          }
        : null,
    };
  });

  return Response.json({ experiment, roster });
});

const gradeSchema = z.object({
  action: z.literal("grade"),
  studentId: z.string().min(1),
  reportScore: z.union([z.number(), z.string(), z.null()]).optional(),
  codeScore: z.union([z.number(), z.string(), z.null()]).optional(),
  acceptanceScore: z.union([z.number(), z.string(), z.null()]).optional(),
  reportPenalty: z.coerce.number().default(0),
  codePenalty: z.coerce.number().default(0),
  isPlagiarised: z.boolean().default(false),
  plagiarismGroup: z.string().nullable().optional(),
  checkpointClaimed: z.boolean().default(false),
  remark: z.string().nullable().optional(),
});

const plagiarismSchema = z.object({ action: z.literal("check_plagiarism") });

const postSchema = z.discriminatedUnion("action", [gradeSchema, plagiarismSchema]);

export const POST = withAuth(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  await requireStaff();
  const { id: experimentId } = await params;
  const body = postSchema.parse(await request.json());

  if (body.action === "check_plagiarism") {
    const submissionsDir = path.join(process.cwd(), "../../data/submissions", experimentId);
    const simBin = process.env.SIM_BINARY ?? "/root/teach-assist/check/bin/sim_c++";

    if (
      !fs.existsSync(/* turbopackIgnore: true */ submissionsDir) ||
      !fs.existsSync(/* turbopackIgnore: true */ simBin)
    ) {
      return Response.json({ count: 0, note: "PLAGIARISM_ENV_MISSING" });
    }

    try {
      const { stdout } = await execAsync(`${simBin} -p ${submissionsDir}/**/*.cpp`);
      const flagged = new Set<string>();
      for (const line of stdout.split("\n")) {
        const match = line.match(/(\d+)\.cpp consists for (\d+) % of (\d+)\.cpp/);
        if (match && parseInt(match[2]) > 60) {
          flagged.add(match[1]);
          flagged.add(match[3]);
        }
      }
      for (const sId of flagged) {
        const user = await prisma.user.findFirst({ where: { studentId: sId } });
        if (user) {
          await prisma.submission.upsert({
            where: { studentId_experimentId: { studentId: user.id, experimentId } },
            update: { isPlagiarised: true, plagiarismGroup: "Similarity > 60%" },
            create: {
              studentId: user.id,
              experimentId,
              isPlagiarised: true,
              plagiarismGroup: "Similarity > 60%",
            },
          });
        }
      }
      return Response.json({ count: flagged.size });
    } catch (e) {
      console.error("sim check failed", e);
      return Response.json({ error: "PLAGIARISM_CHECK_FAILED" }, { status: 500 });
    }
  }

  // grade
  const student = await prisma.user.findFirst({
    where: { OR: [{ id: body.studentId }, { studentId: body.studentId }] },
  });
  if (!student) return Response.json({ error: "STUDENT_NOT_FOUND" }, { status: 404 });

  const num = (v: unknown): number | null =>
    v === null || v === undefined || v === "" ? null : parseFloat(String(v));

  const data = {
    reportScore: num(body.reportScore),
    codeScore: num(body.codeScore),
    acceptanceScore: num(body.acceptanceScore),
    reportPenalty: body.reportPenalty,
    codePenalty: body.codePenalty,
    isPlagiarised: body.isPlagiarised,
    plagiarismGroup: body.plagiarismGroup ?? null,
    checkpointClaimed: body.checkpointClaimed,
    remark: body.remark ?? null,
  };

  const submission = await prisma.submission.upsert({
    where: { studentId_experimentId: { studentId: student.id, experimentId } },
    update: data,
    create: { studentId: student.id, experimentId, ...data },
  });

  return Response.json({ submission });
});
