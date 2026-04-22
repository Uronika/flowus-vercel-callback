import { spawn } from "node:child_process";
import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";
import { emitKeypressEvents } from "node:readline";

const DEFAULT_PROXY_BASE = "https://flowus-vercel-callback-k48w.vercel.app";
const DEFAULT_PROXY_URL = "http://127.0.0.1:7890";

main().catch((error) => {
  console.error(`\n错误: ${error.message}`);
  process.exitCode = 1;
});

async function main() {
  console.log("FlowUs GTD E2E【端到端】测试向导");
  console.log("这些值只会传给本次测试进程，不会写入文件。\n");

  const rl = createInterface({ input, output });
  const proxyBase = await askWithDefault(
    rl,
    "FLOWUS_PROXY_BASE【后端代理地址】",
    process.env.FLOWUS_PROXY_BASE || DEFAULT_PROXY_BASE
  );
  const useProxy = await askYesNo(rl, "是否启用 Clash 代理【Proxy】", true);
  const proxyUrl = useProxy
    ? await askWithDefault(rl, "代理地址【Proxy URL】", process.env.HTTP_PROXY || DEFAULT_PROXY_URL)
    : "";
  const runNow = await askYesNo(rl, "是否立即运行 E2E【端到端】测试", true);
  if (!runNow) {
    rl.close();
    console.log("\n已取消运行。提示：本向导不会持久保存刚才输入的环境变量。");
    return;
  }

  const headed = await askYesNo(rl, "是否显示浏览器窗口【Headed Mode】", false);
  rl.close();

  const proxySecret = await askSecret("GTD_PROXY_SECRET【临时代理密钥】（输入时不会显示明文）: ");
  if (!proxySecret.trim()) {
    throw new Error("GTD_PROXY_SECRET 不能为空。");
  }

  const env = buildEnv({
    proxyBase,
    proxySecret: proxySecret.trim(),
    proxyUrl,
    useProxy
  });

  const script = headed ? "test:e2e:headed" : "test:e2e";
  console.log(`\n开始运行 npm run ${script} ...\n`);
  const child = spawn(getNpmCommand(), ["run", script], {
    cwd: process.cwd(),
    env,
    stdio: "inherit"
  });

  const code = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", resolve);
  });

  if (code !== 0) {
    throw new Error(`E2E 测试失败，退出码：${code}`);
  }
}

async function askWithDefault(rl, label, defaultValue) {
  const answer = await rl.question(`${label}（默认：${defaultValue}）: `);
  return answer.trim() || defaultValue;
}

async function askYesNo(rl, label, defaultValue) {
  const suffix = defaultValue ? "Y/n" : "y/N";
  const answer = (await rl.question(`${label}（${suffix}）: `)).trim().toLowerCase();
  if (!answer) return defaultValue;
  return answer === "y" || answer === "yes";
}

async function askSecret(prompt) {
  if (!input.isTTY || !output.isTTY || typeof input.setRawMode !== "function") {
    const rl = createInterface({ input, output });
    const value = await rl.question(prompt);
    rl.close();
    return value;
  }

  return new Promise((resolve, reject) => {
    let value = "";

    const cleanup = () => {
      input.off("keypress", onKeypress);
      input.setRawMode(false);
      input.pause();
    };

    const onKeypress = (character, key = {}) => {
      if (key.ctrl && key.name === "c") {
        cleanup();
        output.write("\n");
        reject(new Error("用户取消输入。"));
        return;
      }

      if (key.name === "return" || key.name === "enter") {
        cleanup();
        output.write("\n");
        resolve(value);
        return;
      }

      if (key.name === "backspace") {
        if (value.length > 0) {
          value = value.slice(0, -1);
          output.write("\b \b");
        }
        return;
      }

      if (character && !key.ctrl && !key.meta) {
        value += character;
        output.write("*");
      }
    };

    emitKeypressEvents(input);
    input.setRawMode(true);
    input.resume();
    output.write(prompt);
    input.on("keypress", onKeypress);
  });
}

function buildEnv({ proxyBase, proxySecret, proxyUrl, useProxy }) {
  const env = {
    ...process.env,
    FLOWUS_PROXY_BASE: stripTrailingSlash(proxyBase),
    GTD_PROXY_SECRET: proxySecret,
    NODE_OPTIONS: appendNodeOption(process.env.NODE_OPTIONS || "", "--use-env-proxy"),
    NO_PROXY: mergeNoProxy(process.env.NO_PROXY || process.env.no_proxy || ""),
    no_proxy: mergeNoProxy(process.env.NO_PROXY || process.env.no_proxy || "")
  };

  if (useProxy && proxyUrl) {
    env.HTTP_PROXY = proxyUrl;
    env.HTTPS_PROXY = proxyUrl;
    env.ALL_PROXY = proxyUrl;
  }

  return env;
}

function appendNodeOption(current, option) {
  return current.split(/\s+/).includes(option)
    ? current
    : [current, option].filter(Boolean).join(" ");
}

function mergeNoProxy(value) {
  const entries = new Set(
    String(value || "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
  );

  for (const entry of ["127.0.0.1", "localhost", "::1"]) {
    entries.add(entry);
  }

  return [...entries].join(",");
}

function stripTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function getNpmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}
