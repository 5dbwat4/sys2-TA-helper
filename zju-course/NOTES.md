# 学在浙大 / ZJUAM 登录技术细节

记录时间：2026-09-15
账号：`3240102120`（AlabTNT / 刘新杰）
密码：请通过环境变量 `ZJU_PASSWORD` 或命令行参数传入，**不要写进仓库**

---

## 1. ZJUAM 统一身份认证（zjuam.zju.edu.cn）

参考实现：npm 包 [`login-zju`](https://github.com/5dbwat4/login-ZJU)（`~/projectives/zlb/node_modules/login-zju`）。

流程（纯 HTTP，无需浏览器）：

1. `GET https://zjuam.zju.edu.cn/cas/login`
   从 HTML 中提取：`name="execution" value="([^"]+)"` → `execution`。
2. `GET https://zjuam.zju.edu.cn/cas/v2/getPubKey`
   返回 `{"modulus": "<hex>", "exponent": "<hex>"}`。
3. **密码加密**（非标准 PKCS#1，而是裸模幂）：
   ```python
   pwd_int = 0
   for ch in password:
       pwd_int = pwd_int * 256 + ord(ch)      # 字符串按字节拼成一个大整数
   enc = pow(pwd_int, int(exponent,16), int(modulus,16))
   enc_hex = format(enc, "x").zfill(len(modulus))   # 左侧补 0 到 modulus 的 hex 长度
   ```
4. `POST https://zjuam.zju.edu.cn/cas/login`
   `Content-Type: application/x-www-form-urlencoded`，body：
   `username=<学号>&password=<enc_hex>&execution=<execution>&_eventId=submit&authcode=`
   且 **`redirect: manual`**。
   - 返回 **302** → 登录成功（Location 为跳转地址）。
   - 返回 **200** → 失败，错误信息在 `<span id="msg">...</span>`。

> 直接 POST 明文密码会失败，必须做上面的 RSA 加密。

## 2. 登录到 courses.zju.edu.cn（学在浙大）

`login-zju` 的 `COURSES` 类做法：

1. 从 `https://courses.zju.edu.cn/user/index` 开始，手动跟随 302，直到跳到 `zjuam.zju.edu.cn`。
2. 该 URL 形如 `https://zjuam.zju.edu.cn/cas/login?service=<service>`，取出 `service`。
3. `GET https://zjuam.zju.edu.cn/cas/login?service=<urlencode(service)>`
   （若 ZJUAM 会话已建立）→ 302 带 ticket 回到 `courses.zju.edu.cn`。
4. 跟随后续 302 / `meta http-equiv="refresh" content="0;URL=..."`，直到落地，此时
   cookie jar 里已有 `courses.zju.edu.cn` 的会话。

### 关键坑：`SSL: DH_KEY_TOO_SMALL`

`courses.zju.edu.cn` 用了 1024-bit DH 参数，Python/OpenSSL 3 默认拒绝。需要自定义 SSL context：

```python
from urllib3.util.ssl_ import create_urllib3_context
from requests.adapters import HTTPAdapter

class LegacySSLAdapter(HTTPAdapter):
    def init_poolmanager(self, *a, **kw):
        ctx = create_urllib3_context()
        ctx.set_ciphers("DEFAULT@SECLEVEL=1")   # 允许小 DH
        kw["ssl_context"] = ctx
        return super().init_poolmanager(*a, **kw)

s = requests.Session()
s.mount("https://", LegacySSLAdapter())
```

## 3. 课程列表 / 课程信息 API

- 我的课程（POST）：
  `POST https://courses.zju.edu.cn/api/my-courses`
  body 里 `fields` 要包含 `id,name,course_code,instructors(id,name),is_instructor,...`。
- 课程详情：`GET https://courses.zju.edu.cn/api/courses/{course_id}`
  （注意是复数 `courses`；`/api/course/{id}` 会 500）。
- 其它脚本用到的：`/api/course/{id}/activity-reads-for-user`、
  `/api/course/{id}/homework-scores?fields=id,title`、
  `/api/courses/{id}/exam-scores`、`/api/courses/{id}/exams`。

## 4. 本次目标课程

| 字段 | 值 |
| --- | --- |
| 名称 | 计算机系统Ⅱ |
| 课程 ID | **100199** |
| 课程代码 | `(2026-2027-1)-CS2052M-0019221-1` |
| 教师 | 吴磊、卢立 |
| `is_instructor` | **True**（当前账号是教师/助教） |
| 权限 | `allow_admin_update_basic_info=True`、`allow_edit_knowledge_base=True`、`allowed_to_invite_assistant=True`、`allowed_to_invite_student=True` |

> 另：账号对「计算机系统 Ⅰ（武伯熹）」(id=95623) 也是 `is_instructor=True`。

## 5. 助教功能确认

课程页（`/course/100199` 与 `/course/100199/index`）已拉回并存于 `pages/`，页面内包含：

- 「新增作业 / 编辑作业」弹窗（`<option value="0">&lt;新增作业&gt;</option>`）；
- 成员角色管理：`instructor_assistant = 助教`，可邀请助教。

作业相关接口（在 `pages/` 对应页面的 JS bundle 中）：
`/api/course/activities`、`/api/activities/{id}`、`/api/homework/{id}/...`、
`/api/course/activities-read/` 等。

**未真正创建任何作业**（仅 GET 拉取页面/接口）。

## 6. 复现方式

```bash
cd ~/projectives/zjustudy/2ss/ta/zju-course
python3 zju_login.py 3240102120 '<password>'    # 登录并列出全部课程
python3 zju_course.py                            # 拉取 100199 的页面与接口到 ./course100199
```

## 7. 新建 / 发布作业 API

| 操作 | 方法 | 路径 |
| --- | --- | --- |
| 列出课程活动 | GET | `/api/courses/{course_id}/activities` |
| 新建作业（草稿） | POST | `/api/courses/{course_id}/activities` |
| 修改 / 发布作业 | PUT | `/api/activities/{activity_id}` |
| 删除作业 | DELETE | `/api/activities/{activity_id}` |
| 单个活动详情 | GET | `/api/activities/{activity_id}` |

**时间格式**：`end_time` / `start_time` 用 UTC ISO8601（北京时间 -8h），例如
`2026-09-23 23:59:59`（北京）→ `2026-09-23T15:59:59Z`。

**POST 必填字段**（缺失时接口返回 `400 {"errors":{...}}`，可据此逐项补全）：

| 字段 | 说明 / 取值 |
| --- | --- |
| `title` | 作业标题 |
| `type` | 固定 `"homework"` |
| `module_id` | 必须属于该课程的模块（不能为 0）。100199 的模块 id=`761987` |
| `end_time` | 截止时间（UTC） |
| `description` | 作业说明，HTML（可含 `<p>`） |
| `completion_criterion` | `{"value": 0}` |
| `announce_answer_status` | `"no_announce"` |
| `announce_score_type` | `1` |
| `score_percentage` | `0`（0–100） |
| `score_rule` | `"highest"` |
| `submit_times` | `1` |
| `non_submit_times` | `true` |
| `review_by_instructor` | `true` |
| `review_by_inter` / `review_by_interGroup` / `review_by_intraGroup` | `false` |
| `rubric_id` / `intra_rubric_id` / `rubric_instance_id` / `intra_rubric_instance_id` / `score_item_group_id` | `0` |
| `homework_type` | `"file_upload"` |
| `published` | `false` 存草稿，`true` 直接发布 |
| `course_id` | 课程 id |

可选：`uploads`（附件）、`assign_group_ids` / `assign_student_ids` / `is_assigned_to_all`（发布对象）、
`start_time`、`visible_start_at` / `visible_end_at`、`allow_retract`、`submit_by_group` / `group_set_id`、
`syllabus_id`、`teaching_model`、`using_phase` 等。

脚本：`zju_create_homework.py`（示例见文件头注释）。

### 本次实际发布（2026-09-15）

- 课程 100199，作业 id=`1185298`，标题「lab0实验提交」，`type=homework`，`published=true`
- 截止 `2026-09-23T15:59:59Z`（= 北京时间 2026-09-23 23:59:59）
- 说明：`<p>请同学们提交lab0的代码和实验报告，代码压缩为zip，实验报告以pdf形式提交。请使用Checkpoint的同学不要提交本次作业，否则判定为一次抄袭</p>`
- 备注：`PUT /api/activities/{id}` 发布时接口返回 500，但更新实际已生效（`published` 变为 `true`），
  以随后的 GET 结果为准。
