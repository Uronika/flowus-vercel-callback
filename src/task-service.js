import { loadConfig, requireToken } from "./config.js";
import { FlowUsClient } from "./flowus-client.js";
import {
  GTD_LISTS,
  GTD_PRIORITIES,
  GTD_STATUSES,
  LIST_TRASH,
  mapBlockToStep,
  mapPageToTask,
  PROP_TITLE,
  PROP_COMPLETED,
  PROP_DUE,
  PROP_LIST,
  PROP_PRIORITY,
  PROP_STATUS,
  PRIORITY_LOW,
  STATUS_DONE,
  STATUS_TODO,
  resolveTaskId
} from "./task-mapper.js";

export function createTaskClient(env = process.env) {
  const config = loadConfig(env);
  requireToken(config);
  return {
    client: new FlowUsClient(config),
    config
  };
}

export async function fetchTasks(env = process.env) {
  const { client, config } = createTaskClient(env);
  const pages = await client.fetchAllDatabasePages(config.taskDatabaseId);
  return pages.map(mapPageToTask).sort(compareTasks);
}

export async function fetchTaskDetail(taskId, env = process.env) {
  const { client, config } = createTaskClient(env);
  const pages = await client.fetchAllDatabasePages(config.taskDatabaseId);
  const task = resolveTaskId(pages.map(mapPageToTask), taskId);
  const page = await client.getPage(task.id);
  const blocks = await client.fetchAllBlockChildren(task.id);
  const steps = blocks.map(mapBlockToStep).filter(Boolean);
  return {
    ...mapPageToTask(page),
    steps
  };
}

export async function createDefaultTask({ list, title = "\u9ed8\u8ba4\u4efb\u52a1" } = {}, env = process.env) {
  const { client, config } = createTaskClient(env);
  assertOneOf(list, GTD_LISTS, "list", "\u6e05\u5355");

  const page = await client.createPage({
    parent: {
      database_id: config.taskDatabaseId
    },
    properties: {
      [PROP_TITLE]: titleProperty(title),
      [PROP_LIST]: selectProperty(list),
      [PROP_STATUS]: selectProperty(STATUS_TODO),
      [PROP_PRIORITY]: selectProperty(PRIORITY_LOW),
      [PROP_COMPLETED]: {
        type: "checkbox",
        checkbox: false
      }
    }
  });

  return fetchTaskDetail(page.id, env);
}

export async function updateTaskFields(taskId, fields = {}, env = process.env) {
  const { client, config } = createTaskClient(env);
  const pages = await client.fetchAllDatabasePages(config.taskDatabaseId);
  const task = resolveTaskId(pages.map(mapPageToTask), taskId);
  const properties = buildTaskProperties(fields);

  if (Object.keys(properties).length === 0) {
    const error = new Error("\u6ca1\u6709\u53ef\u66f4\u65b0\u7684\u4efb\u52a1\u5b57\u6bb5\u3002");
    error.code = "empty_update";
    error.status = 400;
    throw error;
  }

  await client.updatePage(task.id, { properties });
  return fetchTaskDetail(task.id, env);
}

function compareTasks(a, b) {
  const listDiff = listRank(a.list) - listRank(b.list);
  if (listDiff !== 0) return listDiff;

  const completedDiff = Number(a.completed) - Number(b.completed);
  if (completedDiff !== 0) return completedDiff;

  const dueA = a.dueDate || "9999/99/99";
  const dueB = b.dueDate || "9999/99/99";
  if (dueA !== dueB) return dueA.localeCompare(dueB);

  return (a.title || "").localeCompare(b.title || "");
}

function listRank(list) {
  const rank = GTD_LISTS.indexOf(list);
  if (rank === -1) return 99;
  if (list === LIST_TRASH) return 98;
  return rank;
}

function buildTaskProperties(fields) {
  const properties = {};

  if (Object.prototype.hasOwnProperty.call(fields, "list")) {
    assertOneOf(fields.list, GTD_LISTS, "list", "\u6e05\u5355");
    properties[PROP_LIST] = selectProperty(fields.list);
  }

  if (Object.prototype.hasOwnProperty.call(fields, "status")) {
    assertOneOf(fields.status, GTD_STATUSES, "status", "\u72b6\u6001");
    properties[PROP_STATUS] = selectProperty(fields.status);
    properties[PROP_COMPLETED] = {
      type: "checkbox",
      checkbox: fields.status === STATUS_DONE
    };
  }

  if (Object.prototype.hasOwnProperty.call(fields, "priority")) {
    assertOneOf(fields.priority, GTD_PRIORITIES, "priority", "\u4f18\u5148\u7ea7");
    properties[PROP_PRIORITY] = selectProperty(fields.priority);
  }

  if (Object.prototype.hasOwnProperty.call(fields, "dueDate")) {
    properties[PROP_DUE] = dateProperty(fields.dueDate);
  }

  return properties;
}

function selectProperty(name) {
  return {
    type: "select",
    select: { name }
  };
}

function titleProperty(content) {
  return {
    type: "title",
    title: [{
      type: "text",
      text: {
        content,
        link: null
      },
      plain_text: content,
      href: null
    }]
  };
}

function dateProperty(value) {
  if (value === null || value === "") {
    return {
      type: "date",
      date: null
    };
  }

  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const error = new Error("\u622a\u6b62\u65e5\u671f\u5fc5\u987b\u662f YYYY-MM-DD \u683c\u5f0f\u3002");
    error.code = "invalid_due_date";
    error.status = 400;
    throw error;
  }

  return {
    type: "date",
    date: {
      start: value,
      end: null
    }
  };
}

function assertOneOf(value, allowed, code, label) {
  if (!allowed.includes(value)) {
    const error = new Error(`${label}\u4e0d\u5728\u5141\u8bb8\u8303\u56f4\u5185\u3002`);
    error.code = `invalid_${code}`;
    error.status = 400;
    throw error;
  }
}
