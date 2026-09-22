const { PrismaClient } = require('@prisma/client');
const xlsx = require('xlsx');
const fs = require('fs');
const { parse } = require('csv-parse/sync');
const path = require('path');
const { pinyin } = require('pinyin-pro');

const prisma = new PrismaClient();

function computePinyin(name) {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return { pinyin: null, pinyinInitials: null };
  const full = pinyin(trimmed, { toneType: 'none', type: 'array', nonZh: 'consecutive' })
    .join('')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
  const initials = pinyin(trimmed, {
    pattern: 'first',
    toneType: 'none',
    type: 'array',
    nonZh: 'consecutive',
  })
    .join('')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
  return { pinyin: full || null, pinyinInitials: initials || null };
}

const TA_MAPPING = [
  { studentId: '3240102049', name: '5dbwat4' },
  { studentId: '3240102120', name: 'AlabTNT' },
  { studentId: '3240102072', name: 'Taolu' },
];

const TEACHER_ACCOUNTS = [
  { studentId: 'teacher_wulei', name: '吴磊' },
  { studentId: 'teacher_luli', name: '卢立' },
];

const CHECKPOINT_STUDENT_NAMES = ['王若辰', '汝以恒'];

function cleanLatex(text) {
  return text
    .replace(/\\texttt\{([^}]+)\}/g, '$1')
    .replace(/\\textbf\{([^}]+)\}/g, '$1')
    .replace(/\\textit\{([^}]+)\}/g, '$1')
    .replace(/\\text\{([^}]+)\}/g, '$1')
    .replace(/\\_/g, '_')
    .replace(/\\%/g, '%')
    .replace(/\\\$/g, '$')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractFromTex(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf-8');
  // Match ONLY question content Q:, strictly ignore answer A:
  const matches = [...content.matchAll(/\\item\s*\\textbf\{Q[：:]\}\s*([\s\S]*?)(?=\\textbf\{A[：:]\}|$)/g)];
  return matches.map(m => cleanLatex(m[1])).filter(Boolean);
}

async function main() {
  console.log('Seeding database...');
  
  // 1. Process dmc.xlsx (Students)
  const dmcPath = path.join(__dirname, '../../dmc.xlsx');
  if (fs.existsSync(dmcPath)) {
    const workbook = xlsx.readFile(dmcPath);
    const sheetName = workbook.SheetNames[0];
    const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
    
    for (let i = 4; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length < 4) continue;
      const studentId = row[1]?.toString().trim();
      const name = row[3]?.toString().trim();
      
      if (studentId && name && /^\d+$/.test(studentId)) {
        await prisma.user.upsert({
          where: { studentId },
          update: { name, ...computePinyin(name) },
          create: {
            studentId,
            name,
            role: 'STUDENT',
            ...computePinyin(name)
          }
        });
      }
    }
    console.log('Processed dmc.xlsx (70 students)');
  }

  // 2. Process sign.csv (Boards and Assignments)
  const signPath = path.join(__dirname, '../../sign.csv');
  if (fs.existsSync(signPath)) {
    const csvData = fs.readFileSync(signPath, 'utf-8');
    const records = parse(csvData, { columns: true, skip_empty_lines: true });
    
    for (const row of records) {
      const assetNo = (row['资产号'] || row['assetNo'])?.toString().trim();
      const dbNo = (row['DB编号'] || row['DB号'] || row['dbNo'])?.toString().trim();
      const contactPhone = (row['电话'] || row['联系电话'])?.toString().trim() || null;
      
      if (assetNo && dbNo) {
        const board = await prisma.board.upsert({
          where: { assetNo },
          update: { dbNo, contactPhone },
          create: {
            assetNo,
            dbNo,
            contactPhone
          }
        });

        // Link board assignment to borrower & team members
        const borrowerName = (row['姓名'] || '').trim();
        const rawGroup = (row['组成员'] || '').toString();
        const groupMembers = rawGroup.split(/[；;,，\s]+/).map(s => s.trim()).filter(Boolean);
        const allNames = [borrowerName, ...groupMembers].filter(Boolean);

        for (const sName of allNames) {
          const student = await prisma.user.findFirst({
            where: { name: sName, role: 'STUDENT' }
          });
          if (student) {
            await prisma.boardAssignment.upsert({
              where: {
                boardId_studentId: {
                  boardId: board.id,
                  studentId: student.id
                }
              },
              update: { isReturned: false },
              create: {
                boardId: board.id,
                studentId: student.id,
                isReturned: false
              }
            });
          }
        }
      }
    }
    console.log('Processed sign.csv (Boards and Assignments)');
  }

  // 3. Upsert TAs with default Nicknames
  for (const ta of TA_MAPPING) {
    await prisma.user.upsert({
      where: { studentId: ta.studentId },
      update: { name: ta.name, role: 'TA' },
      create: {
        studentId: ta.studentId,
        name: ta.name,
        role: 'TA'
      }
    });
  }
  console.log('Configured TAs: 5dbwat4, AlabTNT, Taolu');

  // 4. Upsert Teachers (吴磊, 卢立)
  for (const teacher of TEACHER_ACCOUNTS) {
    await prisma.user.upsert({
      where: { studentId: teacher.studentId },
      update: { name: teacher.name, role: 'TEACHER' },
      create: {
        studentId: teacher.studentId,
        name: teacher.name,
        role: 'TEACHER'
      }
    });
  }
  console.log('Configured Teachers: 吴磊, 卢立');

  // 5. Clean up old non-lab0 experiments
  await prisma.experiment.deleteMany({
    where: {
      number: { in: ['实验一', '实验二', '实验三'] }
    }
  });

  // 6. Define All Experiments: Lab0 ~ Project (Lab7)
  // Scoring composition: 50% 验收, 20% 报告, 30% 代码
  // Course weight: Lab0: 2, Lab1: 4, Lab2: 4, Lab3: 4, Lab4: 2, Lab5: 3, Lab6: 4, Project: 7. (Total: 30)
  const allExperiments = [
    {
      number: 'Lab0',
      name: 'Lab0：单周期处理器设计',
      publishDate: new Date('2026-09-16T00:00:00Z'),
      dueDate: new Date('2026-09-30T15:59:59Z'), // 9.30
      totalScore: 100,
      courseWeight: 2.0,
      acceptanceRatio: 0.5,
      reportRatio: 0.2,
      codeRatio: 0.3,
      type: 'HARDWARE',
      isPublished: true,
    },
    {
      number: 'Lab1',
      name: 'Lab1：基础六级流水线',
      publishDate: new Date('2026-09-23T00:00:00Z'), // 9.23
      dueDate: new Date('2026-10-14T15:59:59Z'),     // 10.14
      totalScore: 100,
      courseWeight: 4.0,
      acceptanceRatio: 0.5,
      reportRatio: 0.2,
      codeRatio: 0.3,
      type: 'HARDWARE',
      isPublished: false,
    },
    {
      number: 'Lab2',
      name: 'Lab2：竞争处理I Forwarding 和 stall',
      publishDate: new Date('2026-10-14T00:00:00Z'), // 10.14
      dueDate: new Date('2026-11-04T15:59:59Z'),     // 11.4
      totalScore: 100,
      courseWeight: 4.0,
      acceptanceRatio: 0.5,
      reportRatio: 0.2,
      codeRatio: 0.3,
      type: 'HARDWARE',
      isPublished: false,
    },
    {
      number: 'Lab3',
      name: 'Lab3：竞争处理II 动态分支预测',
      publishDate: new Date('2026-10-28T00:00:00Z'), // 10.28
      dueDate: new Date('2026-11-11T15:59:59Z'),     // 11.11
      totalScore: 100,
      courseWeight: 4.0,
      acceptanceRatio: 0.5,
      reportRatio: 0.2,
      codeRatio: 0.3,
      type: 'HARDWARE',
      isPublished: false,
    },
    {
      number: 'Lab4',
      name: 'Lab4：RV64 内核引导',
      publishDate: new Date('2026-11-04T00:00:00Z'), // 11.4
      dueDate: new Date('2026-11-18T15:59:59Z'),     // 11.18
      totalScore: 100,
      courseWeight: 2.0,
      acceptanceRatio: 0.5,
      reportRatio: 0.2,
      codeRatio: 0.3,
      type: 'SOFTWARE',
      isPublished: false,
    },
    {
      number: 'Lab5',
      name: 'Lab5：RV64 时钟中断处理',
      publishDate: new Date('2026-11-11T00:00:00Z'), // 11.11
      dueDate: new Date('2026-11-25T15:59:59Z'),     // 11.25
      totalScore: 100,
      courseWeight: 3.0,
      acceptanceRatio: 0.5,
      reportRatio: 0.2,
      codeRatio: 0.3,
      type: 'SOFTWARE',
      isPublished: false,
    },
    {
      number: 'Lab6',
      name: 'Lab6：RV64 内核线程调度',
      publishDate: new Date('2026-11-18T00:00:00Z'), // 11.18
      dueDate: new Date('2026-12-09T15:59:59Z'),     // 12.9
      totalScore: 100,
      courseWeight: 4.0,
      acceptanceRatio: 0.5,
      reportRatio: 0.2,
      codeRatio: 0.3,
      type: 'SOFTWARE',
      isPublished: false,
    },
    {
      number: 'Lab7',
      name: 'Project：综合实验',
      publishDate: new Date('2026-11-25T00:00:00Z'), // 11.25
      dueDate: new Date('2027-01-03T15:59:59Z'),     // 2027.1.3
      totalScore: 100,
      courseWeight: 7.0,
      acceptanceRatio: 0.5,
      reportRatio: 0.2,
      codeRatio: 0.3,
      type: 'BOTH',
      isPublished: false,
    },
  ];

  for (const labData of allExperiments) {
    await prisma.experiment.upsert({
      where: { number: labData.number },
      update: labData,
      create: labData
    });
  }
  console.log('Seeded Lab0 ~ Project (Lab7) with courseWeight & 50/20/30 score ratio.');

  // 7. Seed Question Bank from 2025_CS_II and Docs (WITHOUT ANY ANSWERS!)
  const cs2025Dir = path.join(__dirname, '../../2025_CS_II');
  const questionsMap = {
    Lab0: extractFromTex(path.join(cs2025Dir, 'chapter1.tex')),
    Lab1: extractFromTex(path.join(cs2025Dir, 'chapter2.tex')),
    Lab2: extractFromTex(path.join(cs2025Dir, 'chapter3.tex')),
    Lab3: extractFromTex(path.join(cs2025Dir, 'chapter4.tex')),
    Lab4: extractFromTex(path.join(cs2025Dir, 'chapter5.tex')),
    Lab5: [
      '在实现上下文切换部分，我们需要保存寄存器，谈谈为什么需要保存通用寄存器和 sepc，而其他的特权寄存器不需要，以及为什么要保存在内核栈上？',
      '在使用 make run 时，OpenSBI 会产生平台相关信息与引导日志，简述其在初始化定时器时完成了哪些配置？',
      '如何在不支持 M 扩展硬件指令集的处理器上执行 M 扩展指令？有哪些软件模拟机制？',
      '如果完全按照实验指导实现，在运行一段时间后，为什么可能会观察到 test 函数的输出和时钟中断的输出失去同步的现象？',
      '请简要设计一个方案，测试 test 函数中 printk 输出信息所消耗的时间。假定时钟频率为 10 MHz，如何准确测量？',
    ],
    Lab6: [
      '在 RV64 中共有 32 个通用寄存器，为什么在 __switch_to 中只需要保存 14 个 callee-saved 寄存器？',
      '在线程调度模型中，线程之间什么是共享的，什么是独有的？具体体现在本次实验中分别是哪些结构？',
      '当线程第一次被调用调度时，其 ra 寄存器恢复的返回地址是 __dummy；线程在之后对 __switch_to 的调用中恢复的返回地址是什么？',
      'dummy_task 的实现中提到了 priority 为 1 时的特殊情况。请解释为什么 priority 为 1 时可能造成饿死或调度异常？',
      '为什么线程的上下文切换必须要在 S 态进行而不能在 U 态进行？如果在 U 态进行会有什么系统安全和特权级问题？',
      '本次实验是在所有线程的时间片都消耗为 0 后再进行重新分配与调度，如果改成每运行减少 10 次之后就重新分配，会出现什么调度特性变化？',
    ],
    Lab7: [
      '使用 printk 函数输出一个字符的过程中需要发生几次特权态切换？请将切换前后的特权态和切换的原因一一列举出来。',
      '如果流水线的 IF、ID、MEM 阶段都检测到了异常发生，应该选择哪个流水级的异常作为 trap_handler 处理的最高优先级异常？请阐明原因。',
      '在处理器差分测试（Co-simulation）中，如果遇到 CSR UNMATCH 报错，通常说明了什么问题？在流水线中应该如何顺藤摸瓜定位？',
      '在下板验证时如果遇到处理器死循环在 PC=0x5c，这通常与 DDR MIG 内存初始化模块的哪些时序机制有关？有哪些排查与解决方法？',
      '外设（如 UART 串口或 Timer）通过 Memory-Mapped I/O (MMIO) 访问时，CPU 内核与总线接口的握手通信过程是怎样的？',
    ]
  };

  for (const [labNumber, qList] of Object.entries(questionsMap)) {
    const exp = await prisma.experiment.findUnique({ where: { number: labNumber } });
    if (exp && qList.length > 0) {
      // Clear old questions for this experiment and insert cleanly
      await prisma.question.deleteMany({ where: { experimentId: exp.id } });
      for (const qContent of qList) {
        await prisma.question.create({
          data: {
            experimentId: exp.id,
            content: qContent
          }
        });
      }
      console.log(`Loaded ${qList.length} questions for ${labNumber} (strictly question only, no answers)`);
    }
  }

  // 8. Mark Checkpoint Students (王若辰, 汝以恒) and set Lab0 score to 0
  const lab0 = await prisma.experiment.findUnique({ where: { number: 'Lab0' } });
  for (const sName of CHECKPOINT_STUDENT_NAMES) {
    const student = await prisma.user.findFirst({
      where: { name: sName, role: 'STUDENT' }
    });
    if (student && lab0) {
      await prisma.user.update({
        where: { id: student.id },
        data: { hasCheckpoint: true }
      });

      await prisma.submission.upsert({
        where: {
          studentId_experimentId: {
            studentId: student.id,
            experimentId: lab0.id
          }
        },
        update: {
          acceptanceScore: 0,
          reportScore: 0,
          codeScore: 0,
          reportPenalty: 0,
          codePenalty: 0,
          checkpointClaimed: true,
          remark: '申领了Checkpoint'
        },
        create: {
          studentId: student.id,
          experimentId: lab0.id,
          acceptanceScore: 0,
          reportScore: 0,
          codeScore: 0,
          reportPenalty: 0,
          codePenalty: 0,
          checkpointClaimed: true,
          remark: '申领了Checkpoint'
        }
      });
      console.log(`Marked ${sName} (${student.studentId}) with Checkpoint and 0 score on Lab0.`);
    }
  }

  console.log('Seeding finished successfully.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
