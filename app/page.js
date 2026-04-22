"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  detailLabel: "\u4efb\u52a1\u8be6\u60c5",
  saving: "\u6b63\u5728\u5199\u5165 FlowUs\u3002",
  saveFailed: "\u5199\u5165\u5931\u8d25",
  clearDate: "\u6e05\u9664\u65e5\u671f",
  previousMonth: "\u4e0a\u4e00\u6708",
  nextMonth: "\u4e0b\u4e00\u6708"
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

const STATUSES = ["\u672a\u5f00\u59cb", "\u8fdb\u884c\u4e2d", "\u5df2\u5b8c\u6210"];
const PRIORITIES = ["\u4f4e", "\u4e2d", "\u9ad8"];

export default function Page() {
  return (
    <Providers>
      <GtdDashboard />
    </Providers>
  );
}

function GtdDashboard() {
  const queryClient = useQueryClient();
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
  const taskMutation = useMutation({
    mutationFn: (fields) => fetchJson(`/api/tasks/${selectedTaskId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(fields)
    }),
    onSuccess: (data) => {
      const task = data.task;
      queryClient.setQueryData(["task", task.id], data);
      queryClient.setQueryData(["tasks"], (oldData) => {
        if (!oldData?.tasks) return oldData;
        return {
          ...oldData,
          tasks: oldData.tasks.map((item) => item.id === task.id ? toTaskListItem(task) : item)
        };
      });
      setSelectedList(task.list);
      setSelectedTaskId(task.id);
    }
  });

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
                <span className={`task-title ${priorityClass(task.priority)}`}>{task.title || "-"}</span>
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
                <div>
                  <dt>{TEXT.list}</dt>
                  <dd>
                    <SelectField
                      label={TEXT.list}
                      value={selectedTask.list}
                      options={LISTS}
                      disabled={taskMutation.isPending}
                      onChange={(value) => updateTaskField("list", value)}
                    />
                  </dd>
                </div>
                <div>
                  <dt>{TEXT.status}</dt>
                  <dd>
                    <SelectField
                      label={TEXT.status}
                      value={selectedTask.status}
                      options={STATUSES}
                      disabled={taskMutation.isPending}
                      onChange={(value) => updateTaskField("status", value)}
                    />
                  </dd>
                </div>
                <div>
                  <dt>{TEXT.priority}</dt>
                  <dd>
                    <SelectField
                      label={TEXT.priority}
                      value={selectedTask.priority}
                      options={PRIORITIES}
                      disabled={taskMutation.isPending}
                      onChange={(value) => updateTaskField("priority", value)}
                    />
                  </dd>
                </div>
                <div className="date-detail">
                  <dt>{TEXT.dueDate}</dt>
                  <dd>
                    <CalendarPicker
                      value={selectedTask.dueDate}
                      disabled={taskMutation.isPending}
                      onChange={(value) => updateTaskField("dueDate", value)}
                    />
                  </dd>
                </div>
              </dl>
              {taskMutation.isPending ? <p className="save-state">{TEXT.saving}</p> : null}
              {taskMutation.error ? (
                <div className="error-block compact">
                  <strong>{TEXT.saveFailed}</strong>
                  <span>{taskMutation.error.message}</span>
                </div>
              ) : null}
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

  function updateTaskField(field, value) {
    if (!selectedTask || selectedTask[field] === value) return;
    taskMutation.mutate({ [field]: value });
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

function SelectField({ label, value, options, disabled, onChange }) {
  return (
    <select
      aria-label={label}
      className="detail-select"
      disabled={disabled}
      value={value || ""}
      onChange={(event) => onChange(event.target.value)}
    >
      {options.map((option) => (
        <option key={option} value={option}>{option}</option>
      ))}
    </select>
  );
}

function CalendarPicker({ value, disabled, onChange }) {
  const initialMonth = useMemo(() => parseIsoDate(value) || new Date(), [value]);
  const [viewDate, setViewDate] = useState(initialMonth);

  useEffect(() => {
    setViewDate(initialMonth);
  }, [initialMonth]);

  const selected = parseIsoDate(value);
  const days = buildCalendarDays(viewDate);

  return (
    <div className="calendar-box">
      <div className="selected-date">{value || "-"}</div>
      <div className="calendar-head">
        <button
          type="button"
          aria-label={TEXT.previousMonth}
          disabled={disabled}
          onClick={() => setViewDate(addMonths(viewDate, -1))}
        >
          {"\u2039"}
        </button>
        <strong>{formatMonth(viewDate)}</strong>
        <button
          type="button"
          aria-label={TEXT.nextMonth}
          disabled={disabled}
          onClick={() => setViewDate(addMonths(viewDate, 1))}
        >
          {"\u203a"}
        </button>
      </div>
      <div className="calendar-weekdays" aria-hidden="true">
        {["\u65e5", "\u4e00", "\u4e8c", "\u4e09", "\u56db", "\u4e94", "\u516d"].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="calendar-days">
        {days.map((day) => (
          <button
            key={day.iso}
            type="button"
            className={[
              "calendar-day",
              day.isCurrentMonth ? "" : "outside",
              isSameDate(day.date, selected) ? "selected" : "",
              isSameDate(day.date, new Date()) ? "today" : ""
            ].filter(Boolean).join(" ")}
            disabled={disabled}
            onClick={() => onChange(day.iso)}
          >
            {day.date.getDate()}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="clear-date"
        disabled={disabled || !value}
        onClick={() => onChange(null)}
      >
        {TEXT.clearDate}
      </button>
    </div>
  );
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

function toTaskListItem(task) {
  const { steps, ...listItem } = task;
  return listItem;
}

function priorityClass(priority) {
  if (priority === "\u9ad8") return "priority-high";
  if (priority === "\u4e2d") return "priority-medium";
  return "priority-low";
}

function parseIsoDate(value) {
  if (!value || typeof value !== "string") return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatMonth(date) {
  return `${date.getFullYear()}\u5e74${date.getMonth() + 1}\u6708`;
}

function addMonths(date, offset) {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1);
}

function buildCalendarDays(viewDate) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const start = new Date(year, month, 1 - firstDay.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
    return {
      date,
      iso: formatDate(date),
      isCurrentMonth: date.getMonth() === month
    };
  });
}

function isSameDate(left, right) {
  return Boolean(left && right) &&
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate();
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok || data.ok === false) {
    const error = new Error(data.error?.message || TEXT.requestFailed);
    error.code = data.error?.code || "request_failed";
    throw error;
  }
  return data;
}
