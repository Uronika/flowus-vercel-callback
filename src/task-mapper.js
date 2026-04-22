export const LIST_INBOX = "\u6536\u96c6\u7bb1";
export const LIST_EXEC = "\u6267\u884c\u6e05\u5355";
export const LIST_PROJECTS = "\u9879\u76ee\u6e05\u5355";
export const LIST_WAITING = "\u7b49\u5f85\u6e05\u5355";
export const LIST_TRASH = "\u56de\u6536\u7ad9";

export const STATUS_TODO = "\u672a\u5f00\u59cb";
export const STATUS_DOING = "\u8fdb\u884c\u4e2d";
export const STATUS_DONE = "\u5df2\u5b8c\u6210";

export const PRIORITY_LOW = "\u4f4e";
export const PRIORITY_MEDIUM = "\u4e2d";
export const PRIORITY_HIGH = "\u9ad8";

export const PROP_TITLE = "\u4efb\u52a1\u540d\u79f0";
export const PROP_LIST = "\u6e05\u5355";
export const PROP_STATUS = "\u72b6\u6001";
export const PROP_PRIORITY = "\u4f18\u5148\u7ea7";
export const PROP_DUE = "\u622a\u6b62\u65e5\u671f";
export const PROP_COMPLETED = "\u5b8c\u6210";

export const GTD_LISTS = [LIST_INBOX, LIST_EXEC, LIST_PROJECTS, LIST_WAITING, LIST_TRASH];
export const GTD_STATUSES = [STATUS_TODO, STATUS_DOING, STATUS_DONE];
export const GTD_PRIORITIES = [PRIORITY_LOW, PRIORITY_MEDIUM, PRIORITY_HIGH];

export function mapPageToTask(page) {
  const properties = page.properties || {};
  const status = readSelect(properties[PROP_STATUS]);
  const checkbox = readCheckbox(properties[PROP_COMPLETED]);

  return {
    id: page.id,
    shortId: shortId(page.id),
    title: readTitle(properties[PROP_TITLE] || properties.title),
    list: readSelect(properties[PROP_LIST]),
    status,
    priority: readSelect(properties[PROP_PRIORITY]),
    dueDate: readDate(properties[PROP_DUE]),
    completed: deriveCompleted(status, checkbox),
    url: page.url || "",
    steps: undefined
  };
}

export function mapBlockToStep(block) {
  if (block.type !== "to_do") return null;
  const toDo = block.to_do || block.data || {};

  return {
    id: block.id,
    shortId: shortId(block.id),
    text: readRichText(toDo.rich_text),
    checked: Boolean(toDo.checked)
  };
}

export function resolveTaskId(tasks, input) {
  const matches = tasks.filter((task) => task.id.startsWith(input));

  if (matches.length === 0) {
    const error = new Error(`找不到任务 ${input}`);
    error.code = "task_not_found";
    throw error;
  }

  if (matches.length > 1) {
    const error = new Error(`任务 ID ${input} 匹配到多个任务，请输入更长的 ID。`);
    error.code = "ambiguous_id";
    throw error;
  }

  return matches[0];
}

export function resolveStepId(steps, input) {
  const matches = steps.filter((step) => step.id.startsWith(input));

  if (matches.length === 0) {
    const error = new Error(`\u627e\u4e0d\u5230\u6b65\u9aa4 ${input}`);
    error.code = "step_not_found";
    throw error;
  }

  if (matches.length > 1) {
    const error = new Error(`\u6b65\u9aa4 ID ${input} \u5339\u914d\u5230\u591a\u4e2a\u6b65\u9aa4\uff0c\u8bf7\u8f93\u5165\u66f4\u957f\u7684 ID\u3002`);
    error.code = "ambiguous_id";
    error.matches = matches.map((step) => step.id);
    throw error;
  }

  return matches[0];
}

export function shortId(id) {
  return String(id || "").slice(0, 8);
}

function readTitle(property) {
  return readRichText(property?.title);
}

function readSelect(property) {
  return property?.select?.name || "";
}

function readDate(property) {
  return normalizeDate(property?.date?.start);
}

function readCheckbox(property) {
  return Boolean(property?.checkbox);
}

function readRichText(richText = []) {
  return richText.map((item) => item.plain_text || item.text?.content || "").join("");
}

function normalizeDate(value) {
  if (!value || typeof value !== "string") return null;
  const match = value.match(/^(\d{4})[-/](\d{2})[-/](\d{2})/);
  if (!match) return value;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function deriveCompleted(status, checkbox) {
  if (status === STATUS_DONE) return true;
  if (status === STATUS_TODO || status === STATUS_DOING) return false;
  return checkbox;
}
