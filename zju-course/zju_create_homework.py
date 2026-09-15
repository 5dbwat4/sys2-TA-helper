#!/usr/bin/env python3
"""在学在浙大（courses.zju.edu.cn）某课程下新建/发布一个作业。

用法：
  python3 zju_create_homework.py --course 100199 --title "lab0实验提交" \
      --desc-file desc.html --deadline "2026-09-23 23:59:59" [--publish]

关键接口：
  POST /api/courses/{course_id}/activities   # 新建（草稿 published=false）
  PUT  /api/activities/{activity_id}         # 修改 / 发布（published=true）
  GET  /api/courses/{course_id}/activities   # 列出课程活动

注意：end_time 等时间用 UTC（北京时间 -8h）。
"""
import argparse
import datetime
import json
import sys

from zju_login import ZJUAM

REQUIRED_TEMPLATE = {
    "completion_criterion": {"value": 0},
    "announce_answer_status": "no_announce",
    "announce_score_type": 1,
    "score_percentage": 0,
    "score_rule": "highest",
    "submit_times": 1,
    "non_submit_times": True,
    "review_by_instructor": True,
    "review_by_inter": False,
    "review_by_interGroup": False,
    "review_by_intraGroup": False,
    "rubric_id": 0,
    "intra_rubric_id": 0,
    "rubric_instance_id": 0,
    "intra_rubric_instance_id": 0,
    "score_item_group_id": 0,
    "homework_type": "file_upload",
    "allow_retract": True,
    "mode": "normal",
    "reference_answer": "",
    "uploads": [],
    "assign_group_ids": [],
    "assign_student_ids": [],
    "is_assigned_to_all": True,
    "group_set_id": 0,
    "submit_by_group": False,
    "start_time": None,
    "visible_start_at": None,
    "visible_end_at": None,
    "syllabus_id": 0,
    "teaching_model": "online",
    "using_phase": "unspecified",
}


def to_utc(s):
    dt = datetime.datetime.strptime(s, "%Y-%m-%d %H:%M:%S")
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--user", default="3240102120")
    ap.add_argument("--password", required=True)
    ap.add_argument("--course", required=True)
    ap.add_argument("--title", required=True)
    ap.add_argument("--desc-file", required=True, help="作业说明 HTML 文件")
    ap.add_argument("--deadline", required=True, help="北京时间，格式 'YYYY-MM-DD HH:MM:SS'")
    ap.add_argument("--module-id", type=int, required=True)
    ap.add_argument("--publish", action="store_true")
    args = ap.parse_args()

    desc = open(args.desc_file, encoding="utf-8").read()
    payload = dict(REQUIRED_TEMPLATE)
    payload.update({
        "course_id": int(args.course),
        "title": args.title,
        "type": "homework",
        "module_id": args.module_id,
        "end_time": to_utc(args.deadline),
        "description": desc,
        "published": bool(args.publish),
    })

    am = ZJUAM(args.user, args.password)
    am.login()
    am.login_service("https://courses.zju.edu.cn/user/index")
    s = am.s

    r = s.post(f"https://courses.zju.edu.cn/api/courses/{args.course}/activities",
               json=payload, timeout=30)
    print("create:", r.status_code, r.text[:300])
    if r.status_code not in (200, 201):
        sys.exit(1)
    activity = r.json()
    aid = activity["id"]
    print("created id:", aid, "published:", activity.get("published"))

    if args.publish and not activity.get("published"):
        payload["id"] = aid
        payload["published"] = True
        r = s.put(f"https://courses.zju.edu.cn/api/activities/{aid}", json=payload, timeout=30)
        print("publish:", r.status_code)
        acts = s.get(f"https://courses.zju.edu.cn/api/courses/{args.course}/activities",
                     timeout=30).json().get("activities", [])
        print([(a["id"], a["title"], a["published"], a["end_time"]) for a in acts])


if __name__ == "__main__":
    main()
