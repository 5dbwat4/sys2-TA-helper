import { prisma } from "@/lib/prisma";
import { requireStaff, withAuth } from "@/lib/auth";
import { ZJUAM } from "@/lib/zju/zjuam";
import { ZJUCourses, TARGET_COURSE_ID } from "@/lib/zju/zju_courses";

export const GET = withAuth(async () => {
  const session = await requireStaff();

  const taUser = await prisma.user.findUnique({ where: { id: session.id } });
  if (!taUser?.zjuamAccount || !taUser?.zjuamPassword) {
    return Response.json({ error: "ZJUAM_NOT_BOUND" }, { status: 400 });
  }

  try {
    const am = new ZJUAM(taUser.zjuamAccount, taUser.zjuamPassword);
    await am.login();
    const cookies = await am.loginService("https://courses.zju.edu.cn/user/index");
    const courses = new ZJUCourses(cookies);
    const data = await courses.getHomeworkActivities(TARGET_COURSE_ID);
    return Response.json({ data });
  } catch (err) {
    console.error("ZJU courses fetch failed:", err);
    return Response.json({ error: "ZJU_FETCH_FAILED" }, { status: 502 });
  }
});
