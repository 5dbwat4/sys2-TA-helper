"""成绩查询 / 批改模块（并入 ta.alabtnt.cn，与用户系统贯通）。

- 学生 (role=student)：查看本人成绩
- 助教 / 教师 (role=ta/teacher)：查看学生列表、编辑、批量录入、按尾号批改
数据文件：grades.csv（学号,姓名,<item>_exp,<item>_rpt,...）、comments.json
"""
import csv
import json
import os

from flask import (Blueprint, jsonify, redirect, render_template, request,
                   session, url_for)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
GRADES_CSV = os.path.join(BASE_DIR, "grades.csv")
COMMENTS_FILE = os.path.join(BASE_DIR, "comments.json")

# ── 计分项配置（可按学期调整） ──
LAB_CONFIG = [
    {"csv_key": "Lab0", "display": "Lab0", "points": 0, "has_exp": True, "bonus": False, "comment_key": "comment_Lab0", "show_comment": True},
    {"csv_key": "Lab1", "display": "Lab1", "points": 10, "has_exp": True, "bonus": False, "comment_key": "comment_Lab1", "show_comment": True},
    {"csv_key": "Lab2", "display": "Lab2", "points": 10, "has_exp": True, "bonus": False, "comment_key": "comment_Lab2", "show_comment": True},
    {"csv_key": "Lab3", "display": "Lab3", "points": 10, "has_exp": True, "bonus": False, "comment_key": "comment_Lab3", "show_comment": True},
    {"csv_key": "Lab4", "display": "Lab4-1", "points": 5, "has_exp": True, "bonus": True, "comment_key": "comment_Lab4", "show_comment": True},
    {"csv_key": "Lab4 Bonus", "display": "Lab4-2", "points": 5, "has_exp": True, "bonus": True, "comment_key": "comment_Lab4", "show_comment": False},
    {"csv_key": "Lab5", "display": "Lab5", "points": 10, "has_exp": False, "bonus": False, "comment_key": "comment_Lab5", "show_comment": True},
    {"csv_key": "Project", "display": "Project", "points": 10, "has_exp": True, "bonus": False, "comment_key": "comment_Project", "show_comment": True},
    {"csv_key": "Project-bonus", "display": "Project-bonus", "points": 5, "has_exp": True, "bonus": True, "comment_key": "comment_Project", "show_comment": False},
]
DAILY_CONFIG = [
    {"csv_key": "Quiz1", "display": "Quiz1", "points": 2, "has_exp": False, "bonus": False, "comment_key": "comment_Quiz1", "show_comment": True},
    {"csv_key": "Quiz2", "display": "Quiz2", "points": 2, "has_exp": False, "bonus": False, "comment_key": "comment_Quiz2", "show_comment": True},
    {"csv_key": "MidtermQuiz", "display": "期中测验", "points": 5, "has_exp": False, "bonus": False, "comment_key": "comment_MidtermQuiz", "show_comment": True},
    {"csv_key": "Quiz3", "display": "Quiz3", "points": 2, "has_exp": False, "bonus": False, "comment_key": "comment_Quiz3", "show_comment": True},
    {"csv_key": "Quiz4", "display": "Quiz4", "points": 2, "has_exp": False, "bonus": False, "comment_key": "comment_Quiz4", "show_comment": True},
    {"csv_key": "FinalQuiz", "display": "期末测验", "points": 2, "has_exp": False, "bonus": False, "comment_key": "comment_FinalQuiz", "show_comment": True},
    {"csv_key": "Participation", "display": "课堂加分", "points": 5, "has_exp": False, "bonus": True, "comment_key": "comment_Participation", "show_comment": True},
]
ALL_CONFIG = LAB_CONFIG + DAILY_CONFIG
LAB_COUNT = len(LAB_CONFIG)

grades_bp = Blueprint("grades", __name__, url_prefix="/grade")


# ── helpers ──
def safe_num(val):
    if val is None or str(val).strip() == "":
        return None
    try:
        f = float(val)
        return int(f) if f == int(f) else f
    except (ValueError, TypeError):
        return None


def load_json(path, default=None):
    if default is None:
        default = {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return default


def save_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def load_csv_rows():
    with open(GRADES_CSV, "r", encoding="utf-8-sig") as f:
        reader = csv.reader(f)
        header = next(reader)
        rows = list(reader)
    return header, rows


def save_csv(header, rows):
    with open(GRADES_CSV, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(header)
        writer.writerows(rows)


def find_student_row(rows, sid):
    for i, row in enumerate(rows):
        if len(row) > 0 and row[0].strip() == sid:
            return i
    return None


def _ensure_len(lst, n):
    while len(lst) < n:
        lst.append("")


def build_score_items(config, row, start_ci, stu_comments):
    items = []
    total_base = 0.0
    total_bonus = 0.0
    for di, cfg in enumerate(config):
        ci = start_ci + di
        exp_idx = 2 + ci * 2
        rpt_idx = 2 + ci * 2 + 1
        exp_val = safe_num(row[exp_idx]) if exp_idx < len(row) else None
        rpt_val = safe_num(row[rpt_idx]) if rpt_idx < len(row) else None
        combined = None
        if exp_val is not None or rpt_val is not None:
            e = exp_val if exp_val is not None else 0
            r = rpt_val if rpt_val is not None else 0
            if cfg["has_exp"]:
                combined = round((e / 100.0) * (cfg["points"] * 0.5) + (r / 100.0) * (cfg["points"] * 0.5), 2)
            else:
                combined = round((r / 100.0) * cfg["points"], 2)
            if cfg["bonus"]:
                total_bonus += combined
            else:
                total_base += combined
        items.append({"display": cfg["display"], "csv_key": cfg["csv_key"], "points": cfg["points"],
                      "has_exp": cfg["has_exp"], "bonus": cfg["bonus"],
                      "exp_score": exp_val if cfg["has_exp"] else None, "rpt_score": rpt_val,
                      "combined": combined, "comment": stu_comments.get(cfg["comment_key"], "")})
    return items, round(total_base, 2), round(total_bonus, 2)


def load_students():
    header, rows = load_csv_rows()
    all_comments = load_json(COMMENTS_FILE, {})
    students = {}
    for row in rows:
        if len(row) < 3:
            continue
        sid = row[0].strip()
        name = row[1].strip()
        if not sid or not name:
            continue
        stu_comments = all_comments.get(sid, {})
        labs, lab_base, lab_bonus = build_score_items(LAB_CONFIG, row, 0, stu_comments)
        dailies, daily_base, daily_bonus = build_score_items(DAILY_CONFIG, row, LAB_COUNT, stu_comments)
        students[sid] = {"学号": sid, "姓名": name, "labs": labs, "dailies": dailies,
                         "lab_base": lab_base, "lab_bonus": lab_bonus,
                         "daily_base": daily_base, "daily_bonus": daily_bonus}
    return students


def _find_config_ci(csv_key):
    for i, cfg in enumerate(ALL_CONFIG):
        if cfg["csv_key"] == csv_key:
            return i
    return None


def is_staff():
    return session.get("role") in ("ta", "teacher")


def staff_required():
    return not is_staff()


# ── student view ──
@grades_bp.route("/")
def student_home():
    if not session.get("role"):
        return redirect(url_for("index"))
    if is_staff():
        return redirect(url_for("grades.staff_list"))
    sid = session.get("uid")
    student = load_students().get(sid)
    if not student:
        return render_template("grade_none.html", user={"name": session.get("uname"), "id": sid}), 404
    return render_template("grade_student.html", student=student,
                           user={"name": session.get("uname"), "id": sid})


# ── staff views ──
@grades_bp.route("/staff")
def staff_list():
    if staff_required():
        return redirect(url_for("index"))
    students = load_students()
    return render_template("grade_list.html",
                           students=sorted(students.values(), key=lambda s: s["学号"]))


@grades_bp.route("/edit/<sid>")
def edit(sid):
    if staff_required():
        return redirect(url_for("index"))
    header, rows = load_csv_rows()
    idx = find_student_row(rows, sid)
    if idx is None:
        return "Student not found", 404
    row = rows[idx]
    all_comments = load_json(COMMENTS_FILE, {})
    scores = {}
    for ci, cfg in enumerate(ALL_CONFIG):
        key = cfg["csv_key"]
        exp_idx = 2 + ci * 2
        rpt_idx = 2 + ci * 2 + 1
        scores[key + "_exp"] = row[exp_idx].strip() if exp_idx < len(row) else ""
        scores[key + "_rpt"] = row[rpt_idx].strip() if rpt_idx < len(row) else ""
    return render_template("grade_edit.html", sid=sid, name=row[1].strip(), scores=scores,
                           comments=all_comments.get(sid, {}),
                           lab_config=LAB_CONFIG, daily_config=DAILY_CONFIG, all_config=ALL_CONFIG)


@grades_bp.route("/save/<sid>", methods=["POST"])
def save(sid):
    if staff_required():
        return redirect(url_for("index"))
    header, rows = load_csv_rows()
    idx = find_student_row(rows, sid)
    if idx is None:
        return "Student not found", 404
    row = rows[idx]
    for ci, cfg in enumerate(ALL_CONFIG):
        key = cfg["csv_key"]
        exp_idx = 2 + ci * 2
        rpt_idx = 2 + ci * 2 + 1
        _ensure_len(row, max(exp_idx, rpt_idx) + 1)
        row[exp_idx] = request.form.get("exp_" + key, "").strip()
        row[rpt_idx] = request.form.get("rpt_" + key, "").strip()
    _ensure_len(row, len(header))
    save_csv(header, rows)

    all_comments = load_json(COMMENTS_FILE, {})
    stu_comments = {}
    for cfg in ALL_CONFIG:
        val = request.form.get("comment_" + cfg["comment_key"], "").strip()
        if val:
            stu_comments[cfg["comment_key"]] = val
    if stu_comments:
        all_comments[sid] = stu_comments
    elif sid in all_comments:
        del all_comments[sid]
    save_json(COMMENTS_FILE, all_comments)
    return redirect(url_for("grades.staff_list"))


@grades_bp.route("/batch")
def batch():
    if staff_required():
        return redirect(url_for("index"))
    students = load_students()
    ref = [{"tail": s["学号"][-4:], "sid": s["学号"], "name": s["姓名"]}
           for s in sorted(students.values(), key=lambda x: x["学号"])]
    return render_template("grade_batch.html", lab_config=LAB_CONFIG, daily_config=DAILY_CONFIG, ref=ref)


@grades_bp.route("/batch/submit", methods=["POST"])
def batch_submit():
    if staff_required():
        return jsonify({"ok": False, "error": "未登录"}), 403
    csv_key = request.form.get("csv_key", "").strip()
    score_type = request.form.get("score_type", "").strip()
    raw = request.form.get("data", "").strip()
    if not csv_key or score_type not in ("exp", "rpt") or not raw:
        return jsonify({"ok": False, "error": "参数不完整"}), 400
    ci = _find_config_ci(csv_key)
    if ci is None:
        return jsonify({"ok": False, "error": "未知项目"}), 400
    col_idx = 2 + ci * 2 + (1 if score_type == "rpt" else 0)
    header, rows = load_csv_rows()
    tail_map = {}
    for i, row in enumerate(rows):
        if len(row) > 0 and row[0].strip():
            tail_map.setdefault(row[0].strip()[-4:], []).append(i)
    results, errors = [], []
    for line in raw.split("\n"):
        line = line.strip()
        if not line:
            continue
        parts = line.split()
        if len(parts) < 2:
            errors.append(f"格式错误: {line}")
            continue
        tail, score_str = parts[0].strip(), parts[1].strip()
        if tail not in tail_map:
            errors.append(f"尾号 {tail} 未找到匹配学生")
            continue
        matches = tail_map[tail]
        if len(matches) > 1:
            errors.append(f"尾号 {tail} 匹配多个学生")
            continue
        row = rows[matches[0]]
        _ensure_len(row, col_idx + 1)
        old = row[col_idx].strip()
        row[col_idx] = score_str
        results.append({"tail": tail, "sid": row[0].strip(), "name": row[1].strip(), "old": old, "new": score_str})
    save_csv(header, rows)
    return jsonify({"ok": True, "count": len(results), "results": results, "errors": errors})


@grades_bp.route("/single")
def single():
    if staff_required():
        return redirect(url_for("index"))
    students = load_students()
    ref = [{"tail": s["学号"][-4:], "sid": s["学号"], "name": s["姓名"]}
           for s in sorted(students.values(), key=lambda x: x["学号"])]
    return render_template("grade_single.html", lab_config=LAB_CONFIG, daily_config=DAILY_CONFIG, ref=ref)


@grades_bp.route("/single/submit", methods=["POST"])
def single_submit():
    if staff_required():
        return jsonify({"ok": False, "error": "未登录"}), 403
    csv_key = request.form.get("csv_key", "").strip()
    score_type = request.form.get("score_type", "").strip()
    tail = request.form.get("tail", "").strip()
    score_str = request.form.get("score", "").strip()
    comment = request.form.get("comment", "").strip()
    if not csv_key or score_type not in ("exp", "rpt") or not tail or not score_str:
        return jsonify({"ok": False, "error": "参数不完整"}), 400
    ci = _find_config_ci(csv_key)
    if ci is None:
        return jsonify({"ok": False, "error": "未知项目"}), 400
    col_idx = 2 + ci * 2 + (1 if score_type == "rpt" else 0)
    header, rows = load_csv_rows()
    matches = [i for i, row in enumerate(rows)
               if len(row) > 0 and row[0].strip() and row[0].strip()[-4:] == tail]
    if not matches:
        return jsonify({"ok": False, "error": f"尾号 {tail} 未找到匹配学生"}), 400
    if len(matches) > 1:
        return jsonify({"ok": False, "error": f"尾号 {tail} 匹配多个学生"}), 400
    row = rows[matches[0]]
    sid = row[0].strip()
    _ensure_len(row, col_idx + 1)
    old = row[col_idx].strip()
    row[col_idx] = score_str
    all_comments = load_json(COMMENTS_FILE, {})
    if comment:
        all_comments.setdefault(sid, {})[csv_key] = comment
    save_csv(header, rows)
    save_json(COMMENTS_FILE, all_comments)
    return jsonify({"ok": True, "result": {"tail": tail, "sid": sid, "name": row[1].strip(),
                                           "old": old, "new": score_str, "comment": comment}})
