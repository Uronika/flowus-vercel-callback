export const LIST_INBOX = "\u6536\u96c6\u7bb1";
export const LIST_EXEC = "\u6267\u884c\u6e05\u5355";
export const LIST_PROJECTS = "\u9879\u76ee\u6e05\u5355";
export const LIST_WAITING = "\u7b49\u5f85\u6e05\u5355";
export const LIST_TRASH = "\u56de\u6536\u7ad9";

export const STATUS_TODO = "\u672a\u5f00\u59cb";
export const STATUS_DOING = "\u8fdb\u884c\u4e2d";
export const STATUS_DONE = "\u5df2\u5b8c\u6210";

export const PROP_TITLE = "\u4efb\u52a1\u540d\u79f0";
export const PROP_LIST = "\u6e05\u5355";
export const PROP_STATUS = "\u72b6\u6001";
export const PROP_PRIORITY = "\u4f18\u5148\u7ea7";
export const PROP_DUE = "\u622a\u6b62\u65e5\u671f";
export const PROP_COMPLETED = "\u5b8c\u6210";

export const GTD_LISTS = [LIST_INBOX, LIST_EXEC, LIST_PROJECTS, LIST_WAITING, LIST_TRASH];

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
  return property?.date?.start || null;
}

function readCheckbox(property) {
  return Boolean(property?.checkbox);
}

function readRichText(richText = []) {
  return richText.map((item) => item.plain_text || item.text?.content || "").join("");
}

function deriveCompleted(status, checkbox) {
  if (status === STATUS_DONE) return true;
  if (status === STATUS_TODO || status === STATUS_DOING) return false;
  return checkbox;
}
