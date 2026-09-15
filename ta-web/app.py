"""ta.alabtnt.cn — 计算机系统II 用户系统.

Roles
-----
student : 学号 + 姓名 (validated against roster.json)
ta      : ZJUAM 登录, 仅允许学号尾号为 config.ta_tails 的账号
teacher : 固定账号/密码 (config.teacher)

登录页面不暴露任何关于「允许哪些学号」的提示。
"""
import json
import os
from functools import wraps

from flask import (Flask, jsonify, redirect, render_template, request, session,
                   url_for)
from werkzeug.security import check_password_hash

from grades import grades_bp
from zjuam import zjuam_verify

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_FILE = os.path.join(BASE_DIR, "config.json")
ROSTER_FILE = os.path.join(BASE_DIR, "roster.json")
SECRET_FILE = os.path.join(BASE_DIR, "secret.key")


def load_json(path, default):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return default


def load_config():
    return load_json(CONFIG_FILE, {})


def load_roster():
    """Return dict {学号: 姓名}."""
    data = load_json(ROSTER_FILE, {})
    if isinstance(data, list):  # allow [{"id":..,"name":..}, ...]
        return {str(x["id"]).strip(): str(x["name"]).strip() for x in data}
    return {str(k).strip(): str(v).strip() for k, v in data.items()}


def load_secret():
    if os.path.exists(SECRET_FILE):
        with open(SECRET_FILE, "r", encoding="utf-8") as f:
            return f.read().strip()
    import secrets
    value = secrets.token_hex(32)
    with open(SECRET_FILE, "w", encoding="utf-8") as f:
        f.write(value)
    os.chmod(SECRET_FILE, 0o600)
    return value


app = Flask(__name__)
app.secret_key = load_secret()
app.config.update(SESSION_COOKIE_HTTPONLY=True,
                  SESSION_COOKIE_SAMESITE="Lax",
                  SESSION_COOKIE_SECURE=True)


def current_user():
    if "role" not in session:
        return None
    return {"role": session.get("role"), "id": session.get("uid"),
            "name": session.get("uname")}


app.register_blueprint(grades_bp)


@app.context_processor
def inject_user():
    return {"user": current_user()}


def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if current_user() is None:
            return redirect(url_for("index"))
        return fn(*args, **kwargs)
    return wrapper


def role_required(*roles):
    def deco(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            u = current_user()
            if u is None:
                return redirect(url_for("index"))
            if u["role"] not in roles:
                return redirect(url_for("dashboard"))
            return fn(*args, **kwargs)
        return wrapper
    return deco


def do_login(role, uid, name):
    session.clear()
    session.permanent = True
    session["role"] = role
    session["uid"] = uid
    session["uname"] = name


# ── routes ────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    if current_user():
        return redirect(url_for("dashboard"))
    return render_template("login.html")


@app.route("/login/student", methods=["POST"])
def login_student():
    sid = (request.form.get("student_id") or "").strip()
    name = (request.form.get("student_name") or "").strip()
    if not sid or not name:
        return render_template("login.html", student_error="请输入学号和姓名", tab="student"), 400
    real_name = load_roster().get(sid)
    if real_name is None or real_name != name:
        return render_template("login.html", student_error="学号或姓名有误，请核对后重试", tab="student"), 401
    do_login("student", sid, real_name)
    return redirect(url_for("dashboard"))


@app.route("/login/admin", methods=["POST"])
def login_admin():
    account = (request.form.get("admin_account") or "").strip()
    password = request.form.get("admin_password") or ""
    if not account or not password:
        return render_template("login.html", admin_error="请输入账号和密码", tab="admin"), 400

    cfg = load_config()
    teacher = cfg.get("teacher", {})
    if account == teacher.get("account") and teacher.get("password_hash") \
            and check_password_hash(teacher["password_hash"], password):
        do_login("teacher", account, teacher.get("name", "教师"))
        return redirect(url_for("dashboard"))

    # Otherwise treat the account as a ZJUAM username (助教).
    ok, _ = zjuam_verify(account, password)
    if ok and account[-4:] in set(cfg.get("ta_tails", [])):
        name = cfg.get("ta_names", {}).get(account[-4:], account)
        do_login("ta", account, name)
        return redirect(url_for("dashboard"))

    return render_template("login.html", admin_error="账号或密码错误", tab="admin"), 401


@app.route("/dashboard")
@login_required
def dashboard():
    return render_template("dashboard.html", user=current_user())


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("index"))


@app.route("/healthz")
def healthz():
    return jsonify({"ok": True, "roster": len(load_roster())})


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5060, debug=False)
