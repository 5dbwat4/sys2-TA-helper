# teach-assist (计算机系统Ⅱ 助教综合管理系统)

浙江大学「计算机系统II」(Computer Systems II) 助教综合管理与自动化工具系统。

全套系统已部署上线于生产环境：[https://ta.alabtnt.cn](https://ta.alabtnt.cn)

---

## 系统架构与目录结构

| 目录 / 文件 | 说明 |
| :--- | :--- |
| [`web/`](web/) | **新版全功能助教管理台**：基于 Next.js 16 + React 19 + Tailwind CSS v4 + Prisma ORM + MySQL 打造。支持毛玻璃 Glassmorphism 视觉风格，自适应深色/浅色高对比度主题切换。 |
| [`zju-course/`](zju-course/) | **学在浙大（courses.zju.edu.cn）集成工具**：ZJUAM 统一身份认证（RSA 裸模幂加密）、课程作业同步、Lab 成绩自动拉取与批量合并。 |
| [`2025_CS_II/`](2025_CS_II/) | **实验思考题题库**：LaTeX 格式编写的各 Lab 思考题与知识点索引（不含答案，保证评测严谨）。 |
| [`deploy.sh`](deploy.sh) | **生产环境一键部署脚本**：自动安装依赖、Prisma Schema 同步、数据库初始化与 PM2 平滑重启。 |

---

## 核心功能特性

### 1. 现场验收台 (Checkoff)
- **多维度快速定位**：支持通过学号尾号、学生姓名拼音缩写（如 `wrc`）、开发板 DB 编号或资产号极速检索定位学生。
- **高帧率高清条形码识别**：
  - 针对 Safari（macOS / iOS）深度优化，双通道并行解码（原生 Vision 硬件加速 + 高对比度中心 ROI 滤波）。
  - 支持摄像头连续扫描与物理条码枪自动回车录入。
- **动态现场抽题**：从题库中按 Lab 自动随机抽取 1~4 道思考题，现场问答并计分。
- **成绩自动折算**：助教录入 0~100 分验收成绩，系统依据实验权重自动折算入课程总评（全课程 8 个 Lab 累计 30 分）。
- **共用板卡与 Checkpoint 智能标记**：智能识别同组共用开发板学生；针对免做/申领 Checkpoint 学生自动合规记 0 分并展示清晰说明。

### 2. 实验板全生命周期管理 (Boards & Return)
- **借出与归还动态追踪**：精确实时记录 30 块 FPGA 开发板借用人、联系电话及借用时间。
- **连续扫码快速还板 (`/boards/return`)**：支持使用手机或电脑摄像头连续扫码批量注销借出记录，实时刷新未还清单并一键导出。
- **钉钉群机器人实时通知**：板卡借出与归还时自动向助教/课程钉钉群推送格式化 Markdown 卡片通知。

### 3. 作业与报告批改 (Assignments)
- **三维成绩构成**：每个实验按 50% 验收、20% 报告、30% 代码标准核算。
- **学在浙大成绩一键双向同步**：通过 `sync_and_merge_lab0.py` 自动化抓取作业提交与评分，与本地验收分无缝合并。
- **查重与迟交罚分**：支持集成代码查重告警标记与迟交扣分计算。

### 4. 学生端看板 (Student Dashboard)
- 学生使用学号与姓名登录，查看个人名下绑定的开发板资产编号、DB 编号与队友信息。
- 直观查看各 Lab 验收分、报告分、代码分、总评已得折算分以及 Checkpoint 状态。

### 5. 极致视觉与无障碍交互
- **双模自适应**：深色模式（Dark Glass）与浅色模式（Light Clean）无缝切换，完全解决白底白字问题，全站满足 WCAG 4.5:1 高对比度无障碍标准。
- **无感生物认证 (Passkey)**：助教端支持绑定设备的 Touch ID / Face ID / Windows Hello，实现一秒免密秒级登录。

---

## 快速开始

### 环境变量配置

请在 `web/` 目录下复制环境变量模板：
```bash
cp web/.env.example web/.env
```
编辑 `web/.env` 填写 MySQL 连接串与 JWT 密钥：
```env
DATABASE_URL="mysql://ta:your_password@localhost:3306/teach_assist"
JWT_SECRET="your_jwt_secret_key_change_me"
```

### 安装与运行

```bash
# 进入前端目录
cd web

# 安装依赖
npm install

# 同步数据库结构
npx prisma db push
node prisma/seed.js

# 启动开发服务器
npm run dev
```

---

## 安全说明

- **敏感信息排除**：助教登录密码、私有 API Key 及生产环境配置已严格从 Git 仓库排除。
- **生产配置**：严禁将真实名单、私钥证书提交至公共分支。

---

## License

GPL-3.0 (详见 [LICENSE](LICENSE))
