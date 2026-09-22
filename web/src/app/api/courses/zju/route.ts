import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import * as jwt from 'jsonwebtoken';
import { ZJUAM } from '@/lib/zju/zjuam';
import { ZJUCourses, TARGET_COURSE_ID, IGNORED_COURSE_IDS } from '@/lib/zju/zju_courses';

const JWT_SECRET = process.env.JWT_SECRET || 'ta_super_secret_jwt_key_2026';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded: any = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'TA' && decoded.role !== 'TEACHER') {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const taUser = await prisma.user.findUnique({
      where: { id: decoded.id }
    });

    if (!taUser || !taUser.zjuamAccount || !taUser.zjuamPassword) {
      return NextResponse.json({
        error: 'TA credentials not found. Please log in via ZJUAM to enable courses sync.'
      }, { status: 400 });
    }

    // Authenticate with courses.zju.edu.cn
    const am = new ZJUAM(taUser.zjuamAccount, taUser.zjuamPassword);
    await am.login();
    const serviceCookies = await am.loginService("https://courses.zju.edu.cn/user/index");

    const zjuCourses = new ZJUCourses(serviceCookies);
    // Strictly retrieve only 2026 TA courses, completely ignoring 2025 student courses (e.g. 87493)
    const taCourses = await zjuCourses.getTACourses();

    // Fetch homework activities for the target 2026 course
    let homeworkList: any[] = [];
    try {
      const hwData = await zjuCourses.getHomeworkActivities(TARGET_COURSE_ID);
      homeworkList = hwData?.homework_activities || [];
    } catch (e: any) {
      console.warn('Could not fetch homework activities:', e.message);
    }

    return NextResponse.json({
      success: true,
      activeCourseId: TARGET_COURSE_ID,
      ignoredCourseIds: IGNORED_COURSE_IDS,
      taCourses,
      homeworkList
    });
  } catch (error: any) {
    console.error('Fetch ZJU courses error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
