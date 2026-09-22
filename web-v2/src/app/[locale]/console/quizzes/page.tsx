"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "motion/react";
import { Button, Chip, Skeleton, Spinner } from "@heroui/react";
import useSWR from "swr";
import { toast } from "sonner";
import { fetcher } from "@/lib/api-hooks";
import { Icon } from "@/components/ui/Icon";

type QuizItem = {
  id: string;
  name: string;
  courseWeight: number;
  totalScore: number;
  publishDate: string;
  isPublished: boolean;
  createdAt: string;
  totalStudents: number;
  gradedCount: number;
  avgScore: number;
};

type StudentScoreItem = {
  id: string;
  studentId: string;
  name: string;
  pinyinInitial: string;
  score: number | null;
  remark: string;
  updatedAt: string | null;
};

const inputClass =
  "w-full rounded-xl border border-line bg-elevated px-3.5 py-2.5 text-sm outline-none transition-all focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15";

function CreateQuizForm({ onDone }: { onDone: (newId?: string) => void }) {
  const t = useTranslations("quizzes");
  const tc = useTranslations("common");
  const [name, setName] = useState("");
  const [courseWeight, setCourseWeight] = useState("2.0");
  const [totalScore, setTotalScore] = useState("100");
  const [publishDate, setPublishDate] = useState(new Date().toISOString().slice(0, 10));
  const [isPublished, setIsPublished] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/quizzes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          courseWeight: parseFloat(courseWeight) || 0,
          totalScore: parseFloat(totalScore) || 100,
          publishDate,
          isPublished,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(tc("success"));
      onDone(data.quiz?.id);
    } catch {
      toast.error(tc("error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.form
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      onSubmit={submit}
      className="rounded-2xl border border-line bg-elevated p-6"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-xs font-semibold text-fg-muted">{t("quizName")}</label>
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如: 随堂小测 1 (RISC-V 指令集)"
            autoFocus
            required
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-fg-muted">{t("courseWeight")}</label>
          <input
            type="number"
            step="0.1"
            min="0"
            className={inputClass + " tabular"}
            value={courseWeight}
            onChange={(e) => setCourseWeight(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-fg-muted">{t("totalScore")}</label>
          <input
            type="number"
            min="1"
            className={inputClass + " tabular"}
            value={totalScore}
            onChange={(e) => setTotalScore(e.target.value)}
            required
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-xs font-semibold text-fg-muted">{t("publishDate")}</label>
          <input
            type="date"
            className={inputClass + " tabular"}
            value={publishDate}
            onChange={(e) => setPublishDate(e.target.value)}
            required
          />
        </div>
        <div className="sm:col-span-2">
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-sunken p-3 text-sm">
            <input
              type="checkbox"
              checked={isPublished}
              onChange={(e) => setIsPublished(e.target.checked)}
              className="h-4 w-4 rounded border-line text-brand-600 focus:ring-brand-500"
            />
            <div>
              <div className="font-semibold text-fg">{t("isPublished")}</div>
              <div className="text-xs text-fg-subtle">勾选后学生将在时间线中看到此小测及其成绩</div>
            </div>
          </label>
        </div>
      </div>

      <Button
        type="submit"
        fullWidth
        size="lg"
        isPending={saving}
        className="mt-6 bg-gradient-to-r from-purple-600 to-indigo-600 font-semibold text-white shadow-lg"
      >
        {({ isPending }) => (
          <>
            {isPending ? <Spinner color="current" size="sm" /> : <Icon icon="lucide:check" width={16} />}
            {tc("create")}
          </>
        )}
      </Button>
    </motion.form>
  );
}

export default function QuizzesPage() {
  const t = useTranslations("quizzes");
  const tc = useTranslations("common");
  const { data, isLoading, mutate } = useSWR<{ quizzes: QuizItem[] }>("/api/quizzes", fetcher);

  const [creating, setCreating] = useState(false);
  const [selectedQuizId, setSelectedQuizId] = useState<string>("");

  const [roster, setRoster] = useState<StudentScoreItem[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);

  // Continuous Fast Keyboard Entry
  const [queryText, setQueryText] = useState("");
  const [matchedStudent, setMatchedStudent] = useState<StudentScoreItem | null>(null);
  const [scoreInput, setScoreInput] = useState("");
  const [remarkInput, setRemarkInput] = useState("");
  const [savingContinuous, setSavingContinuous] = useState(false);

  // Table filters
  const [tableSearch, setTableSearch] = useState("");
  const [filterMode, setFilterMode] = useState<"ALL" | "GRADED" | "UNGRADED">("ALL");

  const searchInputRef = useRef<HTMLInputElement>(null);
  const scoreInputRef = useRef<HTMLInputElement>(null);

  // Set default selected quiz
  useEffect(() => {
    if (data?.quizzes && data.quizzes.length > 0) {
      if (!selectedQuizId || !data.quizzes.some((q) => q.id === selectedQuizId)) {
        setSelectedQuizId(data.quizzes[0].id);
      }
    }
  }, [data?.quizzes, selectedQuizId]);

  // Load scores when selected quiz changes
  useEffect(() => {
    if (!selectedQuizId) {
      setRoster([]);
      return;
    }
    let cancelled = false;
    setRosterLoading(true);
    fetch(`/api/quizzes/${selectedQuizId}/scores`)
      .then((res) => res.json())
      .then((resData) => {
        if (!cancelled && resData.success) {
          setRoster(resData.roster);
        }
      })
      .catch((err) => console.error(err))
      .finally(() => {
        if (!cancelled) setRosterLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedQuizId]);

  const currentQuiz = useMemo(() => {
    return data?.quizzes.find((q) => q.id === selectedQuizId) ?? null;
  }, [data?.quizzes, selectedQuizId]);

  const togglePublish = async (quiz: QuizItem) => {
    const res = await fetch("/api/quizzes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: quiz.id, isPublished: !quiz.isPublished }),
    });
    if (res.ok) {
      toast.success(quiz.isPublished ? "已取消公布" : "已公布给学生");
      mutate();
    }
  };

  const deleteQuiz = async (quiz: QuizItem) => {
    if (!confirm(`确定要删除小测「${quiz.name}」吗？已录入成绩将被清除。`)) return;
    const res = await fetch(`/api/quizzes?id=${quiz.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("小测已删除");
      if (selectedQuizId === quiz.id) {
        setSelectedQuizId("");
      }
      mutate();
    }
  };

  // Autocomplete matching
  const candidateMatches = useMemo(() => {
    if (!queryText.trim()) return [];
    const q = queryText.trim().toLowerCase();
    return roster
      .filter((st) => {
        const idMatch = st.studentId.includes(q);
        const nameMatch = st.name.toLowerCase().includes(q);
        const pinyinMatch = st.pinyinInitial.toLowerCase().includes(q);
        return idMatch || nameMatch || pinyinMatch;
      })
      .slice(0, 6);
  }, [queryText, roster]);

  const selectCandidate = (st: StudentScoreItem) => {
    setMatchedStudent(st);
    setQueryText(`${st.name} (${st.studentId})`);
    setScoreInput(st.score !== null ? st.score.toString() : "");
    setRemarkInput(st.remark || "");
    setTimeout(() => {
      scoreInputRef.current?.focus();
      scoreInputRef.current?.select();
    }, 50);
  };

  const handleQueryKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "Tab" || e.key === "Enter") && candidateMatches.length > 0) {
      e.preventDefault();
      selectCandidate(candidateMatches[0]);
    }
  };

  const handleContinuousSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuizId) return;

    let target = matchedStudent;
    if (!target && candidateMatches.length > 0) {
      target = candidateMatches[0];
    }
    if (!target) {
      toast.error("请先选择或匹配到有效学生");
      searchInputRef.current?.focus();
      return;
    }

    const parsedScore = scoreInput.trim() === "" ? null : parseFloat(scoreInput);
    if (parsedScore !== null && (isNaN(parsedScore) || parsedScore < 0 || parsedScore > 1000)) {
      toast.error("请输入有效的成绩");
      return;
    }

    setSavingContinuous(true);
    try {
      const res = await fetch(`/api/quizzes/${selectedQuizId}/scores`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: target.studentId,
          score: parsedScore,
          remark: remarkInput.trim() || null,
        }),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error);

      setRoster((prev) =>
        prev.map((st) =>
          st.studentId === target!.studentId
            ? { ...st, score: parsedScore, remark: remarkInput.trim(), updatedAt: new Date().toISOString() }
            : st,
        ),
      );

      toast.success(`已登记 ${target.name}: ${parsedScore !== null ? `${parsedScore} 分` : "已清除"}`);

      setMatchedStudent(null);
      setQueryText("");
      setScoreInput("");
      setRemarkInput("");
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);

      mutate();
    } catch (err: any) {
      toast.error(err.message || tc("error"));
    } finally {
      setSavingContinuous(false);
    }
  };

  const filteredRoster = useMemo(() => {
    return roster.filter((st) => {
      const q = tableSearch.trim().toLowerCase();
      const match =
        !q ||
        st.studentId.includes(q) ||
        st.name.toLowerCase().includes(q) ||
        st.pinyinInitial.toLowerCase().includes(q);
      if (!match) return false;

      if (filterMode === "GRADED") return st.score !== null;
      if (filterMode === "UNGRADED") return st.score === null;
      return true;
    });
  }, [roster, tableSearch, filterMode]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="flex items-end justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{t("title")}</h1>
          <p className="mt-1 text-sm text-fg-muted">{t("fastEntryHint")}</p>
        </div>
        <Button size="lg" onPress={() => setCreating((v) => !v)} variant={creating ? "ghost" : "primary"}>
          <Icon icon={creating ? "lucide:x" : "lucide:plus"} width={16} />
          {t("newQuiz")}
        </Button>
      </motion.div>

      <AnimatePresence mode="wait">
        {creating && (
          <CreateQuizForm
            onDone={(newId) => {
              setCreating(false);
              if (newId) setSelectedQuizId(newId);
              mutate();
            }}
          />
        )}
      </AnimatePresence>

      {/* Quiz Cards */}
      {isLoading || !data ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      ) : data.quizzes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line p-12 text-center text-sm text-fg-muted">
          暂无随堂小测，请点击右上角「{t("newQuiz")}」创建。
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.quizzes.map((quiz) => {
            const isSelected = quiz.id === selectedQuizId;
            return (
              <div
                key={quiz.id}
                onClick={() => setSelectedQuizId(quiz.id)}
                className={`relative cursor-pointer rounded-2xl border p-5 transition-all ${
                  isSelected
                    ? "border-purple-500 bg-purple-500/10 shadow-lg shadow-purple-500/10 ring-2 ring-purple-500/25"
                    : "border-line bg-elevated hover:border-line-hover"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="truncate text-base font-bold text-fg">{quiz.name}</h3>
                  <Chip size="sm" color={quiz.isPublished ? "success" : "default"} variant="soft">
                    {quiz.isPublished ? "已公布" : "草稿"}
                  </Chip>
                </div>
                <div className="tabular mt-3 space-y-1 text-xs text-fg-muted">
                  <div className="flex justify-between">
                    <span>总评权重</span>
                    <span className="font-semibold text-purple-600 dark:text-purple-400">{quiz.courseWeight} 分</span>
                  </div>
                  <div className="flex justify-between">
                    <span>进行日期</span>
                    <span>{new Date(quiz.publishDate).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>已登记进度</span>
                    <span>
                      {quiz.gradedCount} / {quiz.totalStudents} 人
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-xs">
                  <Button
                    size="sm"
                    variant={quiz.isPublished ? "danger-soft" : "secondary"}
                    onPress={() => togglePublish(quiz)}
                  >
                    <Icon icon={quiz.isPublished ? "lucide:eye-off" : "lucide:eye"} width={14} />
                    {quiz.isPublished ? "撤回公布" : "立即公布"}
                  </Button>
                  <Button size="sm" variant="ghost" onPress={() => deleteQuiz(quiz)}>
                    <Icon icon="lucide:trash-2" width={14} className="text-danger" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Grade Entry & Roster Area */}
      {currentQuiz && (
        <div className="space-y-6">
          {/* Continuous Fast Entry Bar */}
          <div className="rounded-2xl border border-purple-500/30 bg-purple-500/5 p-6 shadow-sm">
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
              <div>
                <h3 className="flex items-center gap-2 text-base font-bold text-fg">
                  <span className="h-2.5 w-2.5 rounded-full bg-purple-500 animate-pulse" />
                  连续记分: <span className="text-purple-600 dark:text-purple-400">{currentQuiz.name}</span>
                </h3>
                <p className="text-xs text-fg-subtle">
                  输入学号、姓名或拼音缩写（如 <code className="text-purple-500">czy</code>），按 Tab 自动匹配，回车保存并循环。
                </p>
              </div>
              <div className="tabular text-xs text-fg-muted">
                满分 {currentQuiz.totalScore} · 总评占比 {currentQuiz.courseWeight} 分
              </div>
            </div>

            <form onSubmit={handleContinuousSubmit} className="mt-4">
              <div className="relative grid gap-3 sm:grid-cols-12">
                <div className="relative sm:col-span-5">
                  <label className="mb-1 block text-xs font-semibold text-fg-muted">1. 学号 / 姓名 / 拼音缩写</label>
                  <input
                    ref={searchInputRef}
                    className={inputClass}
                    value={queryText}
                    onChange={(e) => {
                      setQueryText(e.target.value);
                      setMatchedStudent(null);
                    }}
                    onKeyDown={handleQueryKeyDown}
                    placeholder="如: 324010 / 张三 / zs"
                    autoFocus
                  />
                  {!matchedStudent && candidateMatches.length > 0 && (
                    <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-xl border border-line bg-elevated shadow-xl">
                      {candidateMatches.map((st, idx) => (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => selectCandidate(st)}
                          className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-xs transition-colors ${
                            idx === 0 ? "bg-purple-500/10 text-purple-600 dark:text-purple-300" : "hover:bg-sunken text-fg"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-bold">{st.name}</span>
                            <span className="tabular text-fg-muted font-mono">{st.studentId}</span>
                            <span className="rounded bg-purple-500/20 px-1 py-0.5 font-mono text-[10px] text-purple-500">
                              {st.pinyinInitial}
                            </span>
                          </div>
                          <span className="tabular text-fg-subtle font-mono">
                            {st.score !== null ? `${st.score}分` : "待录入"}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="sm:col-span-3">
                  <label className="mb-1 block text-xs font-semibold text-fg-muted">2. 小测得分</label>
                  <input
                    ref={scoreInputRef}
                    type="number"
                    step="0.5"
                    min="0"
                    max="100"
                    className={inputClass + " tabular font-bold text-purple-600 dark:text-purple-400"}
                    value={scoreInput}
                    onChange={(e) => setScoreInput(e.target.value)}
                    placeholder="分数"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-fg-muted">3. 备注</label>
                  <input
                    className={inputClass}
                    value={remarkInput}
                    onChange={(e) => setRemarkInput(e.target.value)}
                    placeholder="选填"
                  />
                </div>

                <div className="flex items-end sm:col-span-2">
                  <Button
                    type="submit"
                    fullWidth
                    size="md"
                    isPending={savingContinuous}
                    className="bg-purple-600 font-semibold text-white shadow"
                  >
                    登记回车 ↵
                  </Button>
                </div>
              </div>
            </form>
          </div>

          {/* Roster Table */}
          <div className="space-y-4">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div className="flex rounded-xl border border-line bg-sunken p-1 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setFilterMode("ALL")}
                  className={`rounded-lg px-3 py-1.5 transition-all ${
                    filterMode === "ALL" ? "bg-elevated text-fg shadow-sm" : "text-fg-subtle hover:text-fg"
                  }`}
                >
                  全部 ({roster.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode("GRADED")}
                  className={`rounded-lg px-3 py-1.5 transition-all ${
                    filterMode === "GRADED" ? "bg-elevated text-fg shadow-sm" : "text-fg-subtle hover:text-fg"
                  }`}
                >
                  已登记 ({roster.filter((s) => s.score !== null).length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode("UNGRADED")}
                  className={`rounded-lg px-3 py-1.5 transition-all ${
                    filterMode === "UNGRADED" ? "bg-elevated text-fg shadow-sm" : "text-fg-subtle hover:text-fg"
                  }`}
                >
                  待录入 ({roster.filter((s) => s.score === null).length})
                </button>
              </div>

              <div className="w-full sm:w-64">
                <input
                  className={inputClass}
                  placeholder="搜索学号、姓名、缩写..."
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-line bg-elevated">
              {rosterLoading ? (
                <div className="p-12 text-center text-sm text-fg-subtle">正在加载成绩列表...</div>
              ) : filteredRoster.length === 0 ? (
                <div className="p-12 text-center text-sm text-fg-subtle">未找到匹配的学生</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-line bg-sunken/50 text-xs font-semibold uppercase tracking-wider text-fg-muted">
                      <tr>
                        <th className="px-5 py-3">学号</th>
                        <th className="px-5 py-3">姓名</th>
                        <th className="px-5 py-3">缩写</th>
                        <th className="px-5 py-3">小测得分</th>
                        <th className="px-5 py-3">折算总评分</th>
                        <th className="px-5 py-3">备注</th>
                        <th className="px-5 py-3 text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {filteredRoster.map((st) => {
                        const graded = st.score !== null;
                        const courseScore = graded
                          ? Math.round((st.score! / currentQuiz.totalScore) * currentQuiz.courseWeight * 100) / 100
                          : null;
                        return (
                          <tr key={st.id} className="transition-colors hover:bg-sunken/40">
                            <td className="tabular font-mono px-5 py-3 text-fg-muted">{st.studentId}</td>
                            <td className="px-5 py-3 font-medium text-fg">{st.name}</td>
                            <td className="tabular font-mono px-5 py-3 text-xs text-purple-500">{st.pinyinInitial}</td>
                            <td className="tabular font-mono px-5 py-3">
                              {graded ? (
                                <span className="font-bold text-purple-600 dark:text-purple-400">
                                  {st.score} <span className="text-xs font-normal text-fg-subtle">/ {currentQuiz.totalScore}</span>
                                </span>
                              ) : (
                                <span className="text-xs text-fg-subtle">待录入</span>
                              )}
                            </td>
                            <td className="tabular font-mono px-5 py-3">
                              {graded ? (
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                  +{courseScore?.toFixed(2)} / {currentQuiz.courseWeight}
                                </span>
                              ) : (
                                <span className="text-xs text-fg-subtle">—</span>
                              )}
                            </td>
                            <td className="max-w-xs truncate px-5 py-3 text-xs text-fg-subtle">{st.remark || "—"}</td>
                            <td className="px-5 py-3 text-right">
                              <Button size="sm" variant="secondary" onPress={() => selectCandidate(st)}>
                                {graded ? "修改" : "录入"}
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
