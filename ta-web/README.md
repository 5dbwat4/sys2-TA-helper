# ta-web

计算机系统II 用户系统（Flask），部署于 `ta.alabtnt.cn`。与成绩模块贯通：

- **学生**：学号 + 姓名登录 → 查看本人成绩
- **教师**：`SysTeacher` + 密码登录
- **助教**：ZJUAM（浙大统一身份认证）登录，仅允许指定学号尾号（页面不提示该限制）

## 文件

| 文件 | 说明 |
| --- | --- |
| `app.py` | 应用入口、登录 / 角色 / 会话 |
| `grades.py` | 成绩查询与批改（Blueprint，`/grade/...`） |
| `zjuam.py` | 服务端 ZJUAM 登录（RSA 加密密码） |
| `config.json` | 教师账号、助教尾号等（**不提交**，见 `config.example.json`） |
| `roster.json` | 学生名单 `{"学号": "姓名"}`（**不提交**） |
| `grades.csv` | 成绩数据（**不提交**） |
| `comments.json` | 评语（**不提交**） |
| `secret.key` | Flask session 密钥，首次运行自动生成（**不提交**） |

## 部署

```bash
python3 -m venv venv
./venv/bin/pip install -r requirements.txt
cp config.example.json config.json      # 填入教师密码哈希、助教尾号
cp roster.example.json roster.json      # 填入学生名单
printf '学号,姓名,Lab0_exp,Lab0_rpt,...\n' > grades.csv   # 表头见 grades.py 的 ALL_CONFIG
./venv/bin/gunicorn -w 2 -b 127.0.0.1:5060 app:app
```

计分项（Lab / Quiz / Project 等）在 `grades.py` 的 `LAB_CONFIG` / `DAILY_CONFIG` 中调整。

## 路由

| 路由 | 角色 | 说明 |
| --- | --- | --- |
| `/` | 所有人 | 登录页（学生 / 管理员两个入口） |
| `/login/student` | 学生 | 学号 + 姓名 |
| `/login/admin` | 教师 / 助教 | 教师用固定账号密码；助教用 ZJUAM |
| `/dashboard` | 已登录 | 控制台 |
| `/grade/` | 学生 | 查看本人成绩 |
| `/grade/staff` | 助教 / 教师 | 学生列表 |
| `/grade/edit/<学号>` | 助教 / 教师 | 编辑单人成绩与评语 |
| `/grade/batch` | 助教 / 教师 | 按尾号批量录入 |
| `/grade/single` | 助教 / 教师 | 按尾号批改 |
