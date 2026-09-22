import sys
import os
import json
import urllib3
urllib3.disable_warnings()
import pymysql
import uuid

sys.path.append('/root/teach-assist/zju-course')
from zju_login import ZJUAM

db_host = os.environ.get('DB_HOST', '127.0.0.1')
db_user = os.environ.get('DB_USER', 'ta')
db_pass = os.environ.get('DB_PASSWORD', 'ta_password')
db_name = os.environ.get('DB_NAME', 'teach_assist')

ta_student_id = sys.argv[1] if len(sys.argv) > 1 else os.environ.get('TA_STUDENT_ID')

conn = pymysql.connect(host=db_host, user=db_user, password=db_pass, database=db_name)
cur = conn.cursor(pymysql.cursors.DictCursor)

if ta_student_id:
    cur.execute("SELECT studentId, zjuamAccount, zjuamPassword FROM User WHERE studentId=%s", (ta_student_id,))
else:
    cur.execute("SELECT studentId, zjuamAccount, zjuamPassword FROM User WHERE role='TA' AND zjuamPassword IS NOT NULL LIMIT 1")

row = cur.fetchone()
if not row:
    sys.exit("未找到已录入 ZJUAM 认证信息的助教账号。请先通过助教端登录或指定 TA_STUDENT_ID。")

am = ZJUAM(row['zjuamAccount'], row['zjuamPassword'])
am.s.verify = False
am.login()
am.login_service('https://courses.zju.edu.cn/user/index')

# 1. Fetch student mapping from courses
r_st = am.s.get("https://courses.zju.edu.cn/api/course/100199/students?page=1&page_size=200")
students = r_st.json().get("students", [])
print(f"Total students on courses: {len(students)}")

zju_students = {}
for st in students:
    sid = str(st.get("user_no", "")).strip()
    name = str(st.get("name", "")).strip()
    if sid:
        zju_students[st.get("id")] = {
            "studentId": sid,
            "name": name
        }

# 2. Fetch homework scores
r_sc = am.s.get("https://courses.zju.edu.cn/api/course/100199/homework-scores")
sc_data = r_sc.json()

# Find Lab0 experiment in DB
cur.execute("SELECT id FROM Experiment WHERE number='Lab0'")
lab0_exp = cur.fetchone()
if not lab0_exp:
    print("Error: Lab0 experiment not found in DB")
    sys.exit(1)
lab0_id = lab0_exp['id']

# Group scores by studentId
student_scores = {}

for sc_group in sc_data.get("scores", []):
    hid = sc_group.get("homework_id")
    for s in sc_group.get("scores", []):
        sid = s.get("student_id")
        final_score_str = s.get("final_score")
        if final_score_str is None or sid not in zju_students:
            continue
        
        final_score = float(final_score_str)
        st_meta = zju_students[sid]
        st_code = st_meta["studentId"]
        st_name = st_meta["name"]
        
        if st_code not in student_scores:
            student_scores[st_code] = {"name": st_name}
            
        if hid == 1185298: # lab0验收 (out of 50.0)
            raw_pct = min(100.0, max(0.0, (final_score / 50.0) * 100.0))
            student_scores[st_code]["acceptance"] = round(raw_pct, 1)
        elif hid == 1186048: # lab0报告/代码 (out of 50.0)
            raw_pct = min(100.0, max(0.0, (final_score / 50.0) * 100.0))
            student_scores[st_code]["report"] = round(raw_pct, 1)
            student_scores[st_code]["code"] = round(raw_pct, 1)

print(f"\nExtracted scores for {len(student_scores)} distinct students from ZJU:")

# 3. Merge into MySQL teach_assist
CHECKPOINT_STUDENTS = {"3250104783", "3250104851", "王若辰", "汝以恒"}

updated_count = 0
created_count = 0

for st_code, sc in student_scores.items():
    st_name = sc.get("name")
    is_checkpoint = (st_code in CHECKPOINT_STUDENTS or st_name in CHECKPOINT_STUDENTS)
    
    # Check if student exists in User table
    cur.execute("SELECT id, name, hasCheckpoint FROM User WHERE studentId=%s", (st_code,))
    user = cur.fetchone()
    if not user:
        user_id = f"cmu_gen_{uuid.uuid4().hex[:20]}"
        cur.execute(
            "INSERT INTO User (id, studentId, name, role, hasCheckpoint, createdAt, updatedAt) VALUES (%s, %s, %s, 'STUDENT', %s, NOW(), NOW())",
            (user_id, st_code, st_name, is_checkpoint)
        )
        conn.commit()
        db_user_id = user_id
    else:
        db_user_id = user['id']
        if is_checkpoint and not user['hasCheckpoint']:
            cur.execute("UPDATE User SET hasCheckpoint=TRUE WHERE id=%s", (db_user_id,))
            conn.commit()

    # Check existing submission for Lab0
    cur.execute("SELECT * FROM Submission WHERE studentId=%s AND experimentId=%s", (db_user_id, lab0_id))
    existing_sub = cur.fetchone()
    
    if is_checkpoint:
        acc = 0.0
        rep = 0.0
        code = 0.0
        claimed = True
        remark = "申领了Checkpoint"
    else:
        # ZJU acceptance
        acc = sc.get("acceptance")
        if existing_sub and existing_sub['acceptanceScore'] is not None:
            acc = max(float(existing_sub['acceptanceScore']), acc if acc is not None else 0.0)
            
        # ZJU report
        rep = sc.get("report")
        if rep is None and existing_sub and existing_sub['reportScore'] is not None:
            rep = float(existing_sub['reportScore'])
            
        # ZJU code
        code = sc.get("code")
        if code is None and existing_sub and existing_sub['codeScore'] is not None:
            code = float(existing_sub['codeScore'])
            
        claimed = existing_sub['checkpointClaimed'] if existing_sub else False
        remark = existing_sub['remark'] if existing_sub else None

    if existing_sub:
        cur.execute("""
            UPDATE Submission
            SET acceptanceScore=%s, reportScore=%s, codeScore=%s, checkpointClaimed=%s, remark=%s
            WHERE id=%s
        """, (acc, rep, code, claimed, remark, existing_sub['id']))
        updated_count += 1
    else:
        sub_id = f"sub_{uuid.uuid4().hex[:20]}"
        cur.execute("""
            INSERT INTO Submission (id, studentId, experimentId, acceptanceScore, reportScore, codeScore, checkpointClaimed, remark)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (sub_id, db_user_id, lab0_id, acc, rep, code, claimed, remark))
        created_count += 1

conn.commit()
print(f"\n[Merge Complete] Updated: {updated_count}, Created: {created_count}")

# Verify current submissions count
cur.execute("SELECT COUNT(*) as cnt FROM Submission WHERE experimentId=%s", (lab0_id,))
res_cnt = cur.fetchone()
print(f"Total Lab0 submissions in DB now: {res_cnt['cnt']}")

# Print checkpoint students verification
cur.execute("""
    SELECT u.studentId, u.name, s.acceptanceScore, s.reportScore, s.codeScore, s.checkpointClaimed, s.remark
    FROM Submission s JOIN User u ON s.studentId=u.id
    WHERE s.experimentId=%s AND u.studentId IN ('3250104783', '3250104851')
""", (lab0_id,))
chk = cur.fetchall()
print("\nCheckpoint Students Status:")
for row in chk:
    print(" ", row)

# Also show sample 5 merged students
cur.execute("""
    SELECT u.studentId, u.name, s.acceptanceScore, s.reportScore, s.codeScore, s.checkpointClaimed
    FROM Submission s JOIN User u ON s.studentId=u.id
    WHERE s.experimentId=%s
    ORDER BY s.id LIMIT 5
""", (lab0_id,))
samples = cur.fetchall()
print("\nSample Merged Students:")
for row in samples:
    print(" ", row)
