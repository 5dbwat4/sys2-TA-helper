#!/usr/bin/env python3
"""Fetch 计算机系统II (course 100199) pages/APIs and inspect TA capabilities."""
import json
import os
import sys

from zju_login import ZJUAM, make_session

COURSE = "100199"
OUT = "/tmp/opencode/course100199"


def save(name, r):
    import os
    os.makedirs(OUT, exist_ok=True)
    path = f"{OUT}/{name}"
    with open(path, "wb") as f:
        f.write(r.content)
    ct = r.headers.get("content-type", "")
    print(f"  {name}: {r.status_code} {ct} ({len(r.content)} bytes)")


def main():
    username = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("ZJU_USERNAME", "")
    password = sys.argv[2] if len(sys.argv) > 2 else os.environ.get("ZJU_PASSWORD", "")
    if not username or not password:
        sys.exit("用法: python3 zju_course.py <学号> <密码>   （或设置 ZJU_USERNAME / ZJU_PASSWORD）")
    am = ZJUAM(username, password)
    am.login()
    am.login_service("https://courses.zju.edu.cn/user/index")
    s = am.s

    print("== course page ==")
    for name, url in [
        ("course_index.html", f"https://courses.zju.edu.cn/course/{COURSE}"),
        ("course_index2.html", f"https://courses.zju.edu.cn/course/{COURSE}/index"),
        ("user_index.html", "https://courses.zju.edu.cn/user/index"),
    ]:
        try:
            save(name, s.get(url, timeout=30))
        except Exception as e:
            print(f"  {name}: ERROR {e}")

    print("== APIs ==")
    apis = {
        "api_course.json": f"https://courses.zju.edu.cn/api/course/{COURSE}",
        "api_courses.json": f"https://courses.zju.edu.cn/api/courses/{COURSE}",
        "api_homework_activities.json": f"https://courses.zju.edu.cn/api/course/{COURSE}/homework-activities?fields=id,title,start_time,end_time,status",
        "api_activities.json": f"https://courses.zju.edu.cn/api/course/{COURSE}/activities?fields=id,title,type,status&page=1&page_size=100",
        "api_members.json": f"https://courses.zju.edu.cn/api/course/{COURSE}/members?page=1&page_size=50",
        "api_course_settings.json": f"https://courses.zju.edu.cn/api/course/{COURSE}/course-settings",
        "api_permissions.json": f"https://courses.zju.edu.cn/api/course/{COURSE}/permissions",
    }
    for name, url in apis.items():
        try:
            save(name, s.get(url, timeout=30))
        except Exception as e:
            print(f"  {name}: ERROR {e}")


if __name__ == "__main__":
    main()
