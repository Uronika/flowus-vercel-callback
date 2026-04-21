import { loadConfig, requireToken } from "./config.js";
import { FlowUsClient } from "./flowus-client.js";
import {
  GTD_LISTS,
  LIST_TRASH,
  mapBlockToStep,
  mapPageToTask,
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
