"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Providers } from "./providers";

const TEXT = {
  brand: "FlowUs GTD",
  title: "\u4efb\u52a1\u89c6\u56fe",
  viewToken: "\u8bbf\u95ee\u53e3\u4ee4",
  tokenPlaceholder: "\u8f93\u5165 FlowUs \u91cc\u7684\u5f53\u524d\u53e3\u4ee4",
  login: "\u8fdb\u5165",
  logout: "\u9000\u51fa",
  refresh: "\u5237\u65b0",
  active: "\u5f85\u5904\u7406",
  done: "\u5df2\u5b8c\u6210",
  trash: "\u56de\u6536\u7ad9",
  task: "\u4efb\u52a1",
  status: "\u72b6\u6001",
  priority: "\u4f18\u5148\u7ea7",
  due: "\u622a\u6b62",
  loading: "\u6b63\u5728\u8bfb\u53d6 FlowUs\u3002",
  noTasks: "\u6ca1\u6709\u5339\u914d\u7684\u4efb\u52a1\u3002",
  chooseTask: "\u9009\u62e9\u4e00\u6761\u4efb\u52a1\u3002",
  list: "\u6e05\u5355",
  dueDate: "\u622a\u6b62\u65e5\u671f",
  steps: "\u6b65\u9aa4",
  loadingSteps: "\u6b63\u5728\u8bfb\u53d6\u6b65\u9aa4\u3002",
  noSteps: "\u6682\u65e0\u6b65\u9aa4\u3002",
  failed: "\u8bfb\u53d6\u5931\u8d25",
  requestFailed: "\u8bf7\u6c42\u5931\u8d25\u3002",
  loginRequired: "\u9700\u8981\u53e3\u4ee4",
  loginHint: "\u8bf7\u6253\u5f00 FlowUs \u7684 GTD/\u5f53\u524d\u8bbf\u95ee\u53e3\u4ee4 \u9875\u9762\uff0c\u8f93\u5165\u6700\u65b0\u53e3\u4ee4\u3002",
  loggingIn: "\u6b63\u5728\u6821\u9a8c\u3002",
  navLabel: "GTD \u6e05\u5355",
  taskListLabel: "\u4efb\u52a1\u5217\u8868",
  detailLabel: "\u4efb\u52a1\u8be6\u60c5"
};

const LISTS = [
  "\u6536\u96c6\u7bb1",
  "\u6267\u884c\u6e05\u5355",
  "\u9879\u76ee\u6e05\u5355",
  "\u7b49\u5f85\u6e05\u5355",
  "\u56de\u6536\u7ad9"
];

const STATUS_TEXT = {
  "\u672a\u5f00\u59cb": "\u672a\u5f00\u59cb",
  "\u8fdb\u884c\u4e2d": "\u8fdb\u884c\u4e2d",
  "\u5df2\u5b8c\u6210": "\u5df2\u5b8c\u6210"
};

const STATUS_CLASS = {
  "\u672a\u5f00\u59cb": "todo",
  "\u8fdb\u884c\u4e2d": "doing",
  "\u5df2\u5b8c\u6210": "done"
};

export default function Page() {
  return (
    <Providers>
      <GtdDashboard />
    </Providers>
  );
}

function GtdDashboard() {
  const [passcode, setPasscode] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [selectedList, setSelectedList] = useState("\u6267\u884c\u6e05\u5355");
  const [selectedTaskId, setSelectedTaskId] = useState("");

  const tasksQuery = useQuery({
    queryKey: ["tasks"],
    queryFn: () => fetchJson("/api/tasks"),
    retry: false
  });

  const tasks = tasksQuery.data?.tasks || [];
  const visibleTasks = useMemo(() => {
    return tasks.filter((task) => task.list === selectedList);
  }, [tasks, selectedList]);

  useEffect(() => {
    if (!selectedTaskId && visibleTasks[0]) {
      setSelectedTaskId(visibleTasks[0].id);
      return;
    }

    if (selectedTaskId && visibleTasks.length > 0 && !visibleTasks.some((task) => task.id === selectedTaskId)) {
      setSelectedTaskId(visibleTasks[0].id);
    }
  }, [selectedTaskId, visibleTasks]);

  const detailQuery = useQuery({
    queryKey: ["task", selectedTaskId],
    queryFn: () => fetchJson(`/api/tasks/${selectedTaskId}`),
    enabled: Boolean(selectedTaskId),
    retry: false
  });

  const needsLogin = tasksQuery.error?.code === "missing_session" ||
    tasksQuery.error?.code === "stale_session" ||
    tasksQuery.error?.code === "expired_session" ||
    tasksQuery.error?.code === "invalid_session";

  const counts = countByList(tasks);
  const activeCount = tasks.filter((task) => !task.completed && task.list !== "\u56de\u6536\u7ad9").length;
  const doneCount = tasks.filter((task) => task.completed && task.list !== "\u56de\u6536\u7ad9").length;
  const selectedTask = detailQuery.data?.task || tasks.find((task) => task.id === selectedTaskId);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">{TEXT.brand}</p>
          <h1>{TEXT.title}</h1>
        </div>
        <div className="top-actions">
          {needsLogin ? null : <button type="button" onClick={handleLogout}>{TEXT.logout}</button>}
          <button type="button" onClick={() => tasksQuery.refetch()}>
            {TEXT.refresh}
          </button>
        </div>
      </header>

      {needsLogin ? (
        <section className="auth-panel">
          <div className="photo-strip" aria-hidden="true" />
          <form className="auth-form" onSubmit={handleLogin}>
            <p className="eyebrow">{TEXT.loginRequired}</p>
            <h2>{TEXT.viewToken}</h2>
            <p>{TEXT.loginHint}</p>
            <label className="token-field">
              <span>{TEXT.viewToken}</span>
              <input
                value={passcode}
                onChange={(event) => setPasscode(event.target.value)}
                placeholder={TEXT.tokenPlaceholder}
                type="password"
                autoComplete="current-password"
              />
            </label>
            <button type="submit" disabled={isLoggingIn}>
              {isLoggingIn ? TEXT.loggingIn : TEXT.login}
            </button>
            {loginError ? <p className="auth-error">{loginError}</p> : null}
          </form>
        </section>
      ) : null}

      {needsLogin ? null : <section className="summary-band">
        <div className="photo-strip" aria-hidden="true" />
        <Metric label={TEXT.active} value={activeCount} tone="green" />
        <Metric label={TEXT.done} value={doneCount} tone="blue" />
        <Metric label={TEXT.trash} value={counts["\u56de\u6536\u7ad9"] || 0} tone="red" />
      </section>}

      {needsLogin ? null : <section className="workspace">
        <nav className="list-nav" aria-label={TEXT.navLabel}>
          {LISTS.map((list) => (
            <button
              key={list}
              type="button"
              className={list === selectedList ? "active" : ""}
              onClick={() => {
                setSelectedList(list);
                setSelectedTaskId("");
              }}
            >
              <span>{list}</span>
              <strong>{counts[list] || 0}</strong>
            </button>
          ))}
        </nav>

        <section className="task-table" aria-label={TEXT.taskListLabel}>
          <div className="table-head">
            <span>{TEXT.task}</span>
            <span>{TEXT.status}</span>
            <span>{TEXT.priority}</span>
            <span>{TEXT.due}</span>
          </div>
          {tasksQuery.isLoading ? (
            <p className="state-line">{TEXT.loading}</p>
          ) : tasksQuery.error ? (
            <ErrorBlock error={tasksQuery.error} />
          ) : visibleTasks.length === 0 ? (
            <p className="state-line">{TEXT.noTasks}</p>
          ) : (
            visibleTasks.map((task) => (
              <button
                key={task.id}
                type="button"
                className={`task-row ${task.id === selectedTaskId ? "selected" : ""}`}
                onClick={() => setSelectedTaskId(task.id)}
              >
                <span className="task-title">{task.title || "-"}</span>
                <StatusPill status={task.status} />
                <span>{task.priority || "-"}</span>
                <span>{task.dueDate || "-"}</span>
              </button>
            ))
          )}
        </section>

        <aside className="detail-panel" aria-label={TEXT.detailLabel}>
          {!selectedTask ? (
            <p className="state-line">{TEXT.chooseTask}</p>
          ) : (
            <>
              <p className="eyebrow">{selectedTask.shortId}</p>
              <h2>{selectedTask.title || "-"}</h2>
              <dl className="detail-grid">
                <div><dt>{TEXT.list}</dt><dd>{selectedTask.list || "-"}</dd></div>
                <div><dt>{TEXT.status}</dt><dd>{selectedTask.status || "-"}</dd></div>
                <div><dt>{TEXT.priority}</dt><dd>{selectedTask.priority || "-"}</dd></div>
                <div><dt>{TEXT.dueDate}</dt><dd>{selectedTask.dueDate || "-"}</dd></div>
              </dl>
              <div className="steps">
                <h3>{TEXT.steps}</h3>
                {detailQuery.isLoading ? (
                  <p className="state-line">{TEXT.loadingSteps}</p>
                ) : detailQuery.error ? (
                  <ErrorBlock error={detailQuery.error} />
                ) : selectedTask.steps && selectedTask.steps.length > 0 ? (
                  selectedTask.steps.map((step) => (
                    <div className="step-row" key={step.id}>
                      <span>{step.checked ? "\u2713" : ""}</span>
                      <p>{step.text || "-"}</p>
                    </div>
                  ))
                ) : (
                  <p className="state-line">{TEXT.noSteps}</p>
                )}
              </div>
            </>
          )}
        </aside>
      </section>}
    </main>
  );

  async function handleLogin(event) {
    event.preventDefault();
    setLoginError("");
    setIsLoggingIn(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ passcode })
      });
      const data = await response.json();
      if (!response.ok || data.ok === false) {
        throw new Error(data.error?.message || TEXT.requestFailed);
      }
      setPasscode("");
      await tasksQuery.refetch();
    } catch (error) {
      setLoginError(error.message);
    } finally {
      setIsLoggingIn(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setSelectedTaskId("");
    await tasksQuery.refetch();
  }
}

function Metric({ label, value, tone }) {
  return (
    <div className={`metric ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatusPill({ status }) {
  return <span className={`status-pill status-${STATUS_CLASS[status] || "empty"}`}>{STATUS_TEXT[status] || "-"}</span>;
}

function ErrorBlock({ error }) {
  return (
    <div className="error-block">
      <strong>{TEXT.failed}</strong>
      <span>{error.message}</span>
    </div>
  );
}

function countByList(tasks) {
  return tasks.reduce((acc, task) => {
    acc[task.list] = (acc[task.list] || 0) + 1;
    return acc;
  }, {});
}

async function fetchJson(url) {
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok || data.ok === false) {
    const error = new Error(data.error?.message || TEXT.requestFailed);
    error.code = data.error?.code || "request_failed";
    throw error;
  }
  return data;
}
