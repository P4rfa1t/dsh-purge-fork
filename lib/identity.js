import { CAPABILITY_SECTION, capabilityProtocolText } from "./capability-protocol.js";
import { loadMnemonSettings } from "./mnemon-settings.js";
import { findDshHome } from "./core.js";
export const GLOBAL_PROMPT_ORDER = -100000;
export { CAPABILITY_SECTION, capabilityProtocolText };
/**
 * 0.2.0 及更早：`cwd` 是宿主注册的插值变量，官方 persona 后缀就长这样。
 * 0.2.1-rc.2 起 agent-loop 不再注册 `cwd`（改由 working-directory 上下文下发），
 * 这句留在任何"会被插值"的段里，renderPrompt 会抛
 * `unknown prompt variable "{{cwd}}"`，整轮运行直接失败。
 * 所以它现在只作为旧文本指纹使用，新文本一律用 cwdSuffixText() 拼真实路径。
 */
export const LEGACY_CWD_ONLY_SUFFIX = "Your working directory is {{cwd}}.";
/** @deprecated 旧名保留，指向同一串指纹。 */
export const CWD_ONLY_SUFFIX = LEGACY_CWD_ONLY_SUFFIX;

/** 用真实路径拼工作目录后缀；拿不到 cwd 就返回空串，绝不写出 `{{cwd}}`。 */
export function cwdSuffixText(cwd) {
  const p = String(cwd || "").trim();
  return p ? `Your working directory is ${p}.` : "";
}

/** 本轮装配拿得到的工作目录；取不到给空串（子代理 / 无会话时）。 */
export function cwdOfContext(context) {
  try {
    return String(context?.agent?.session?.header?.cwd || context?.session?.header?.cwd || "").trim();
  } catch {
    return "";
  }
}

/** 宿主是否已经把 cwd 作为上下文下发（0.2.1-rc.2 的 working-directory:current）。 */
export function assemblyHasCwdContext(contexts) {
  return (Array.isArray(contexts) ? contexts : []).some((entry) => (
    /working[-_]?directory/i.test(String(entry?.name || ""))
  ));
}

/**
 * 最后一道闸：任何仍带 `{{cwd}}` 的段落都换成真实路径（取不到就换成中性词）。
 * 0.2.1 的 renderPrompt 遇到未注册变量会抛错，宁可少一句也不能把占位符留给宿主。
 */
export function fillCwdPlaceholders(sections, cwd) {
  const list = Array.isArray(sections) ? sections : [];
  const value = String(cwd || "").trim() || "the current directory";
  return list.map((section) => {
    if (!section || typeof section.text !== "string" || !section.text.includes("{{cwd}}")) return section;
    return { ...section, text: section.text.split("{{cwd}}").join(value) };
  });
}
export { PHASE1_KEEP_EXPR, widenPhase1KeepFilter } from "./phase1-keep.js";

/** 插件自己的段：inject 用 dsh-purge*，cap/卡/角色用 dshpg-* 以免被挪到 inject 前。 */
function isPluginPromptSection(name) {
  const n = String(name || "");
  return n.startsWith("dsh-purge") || n.startsWith("dshpg-");
}

const PERSONA_PREFIX_NAMES = new Set([
  "deployment:persona-prefix",
  "persona-prefix",
]);
const PERSONA_LEGACY_NAMES = new Set(["deployment:persona", "persona"]);

const OLD_IDENTITY_LOCK =
  "Identity lock (mandatory): You are not DeepSeek's AI assistant, not a " +
  "DeepSeek-powered coding assistant, and not a generic DeepSeek Harness agent. " +
  "Never introduce yourself that way in any language (including 我是 DeepSeek… / " +
  "DeepSeek 的 AI 助手 / DeepSeek 驱动的 AI 编程助手 / 跑在 DeepSeek Harness). " +
  "UI or product labels that mention DeepSeek Harness name the environment only — " +
  "they are not your persona. When asked who you are (你是谁 / who are you), answer " +
  "only as the operator identity defined in the prompt below (prompt-inject / active rules).";

const OLD_WHO_FROM_INJECT =
  "When asked 你是谁 / who are you, answer as the identity defined in prompt-inject.md. " +
  "Never say 我是 DeepSeek 的 AI 助手 or that you run on DeepSeek Harness as your identity — that is the host, not you.";

const OLD_LCS_LOCK =
  "You are the operator persona in prompt-inject (Little Code Sauce / LCS unless that file names someone else). " +
  "When asked 你是谁 / who are you, answer with that name only. " +
  "Never say 我是 DeepSeek 的 AI 助手 or that you run on DeepSeek Harness as your identity — that is the host, not you.";

function stripHarnessPersona(text) {
  if (typeof text !== "string" || text.length === 0) return text;
  return text
    .replace(/You are an AI agent powered by DeepSeek Harness\.?\s*/g, "")
    .replace(/You are a helpful software engineer assistant\.?\s*/gi, "")
    .replace(/你是一个有帮助的软件工程师助手[。.]?\s*/g, "")
    .replace(/我是 DeepSeek(?:驱动)?的? AI(?:编程)?助手[，,]?[^\n]*/g, "")
    .replace(/你好！?我是 DeepSeek[^\n]*/g, "")
    .replace(
      /You are interacting with the user through the DeepSeek Harness Web GUI/g,
      "You are interacting with the user through the local web GUI",
    )
    .replace(
      /You are interacting with the user through the local web GUI at (\S+)\. /g,
      "Local web GUI: $1. ",
    )
    .replace(
      /Do not start a replacement server unless the user asks; if one is needed, use a managed background job and verify its exact URL\. ?/g,
      "",
    )
    .replace(
      /Do not call present just to list edited source files, or run commands to check whether a diff view will appear\. ?/g,
      "",
    )
    .replace(/You don't have access to the internet via this tool\.?\s*/g, "")
    .replace(/Your identity is defined exclusively by the dsh-purge operator prompt\.?\s*/gi, "")
    .replace(
      /You are not a generic coding agent(?: or a mere software-engineer assistant)?\.?\s*/gi,
      "",
    )
    .replace(OLD_WHO_FROM_INJECT, "")
    .replace(OLD_LCS_LOCK, "")
    .replace(OLD_IDENTITY_LOCK, "")
    .replace(
      /You are a coding agent powered by the \{\{model\}\} model, running on the DeepSeek Harness\. Your working directory is \{\{cwd\}\}\.?\s*/g,
      "",
    )
    .replace(
      /You are a coding agent powered by the \{\{model\}\} model\. Your working directory is \{\{cwd\}\}\.?\s*/g,
      "",
    )
    .replace(
      /The DeepSeek Harness implementation checkout is at [\s\S]*?Use this checkout only to inspect or extend DSH itself\.?\s*/g,
      "",
    )
    .replace(
      /You are a coding agent powered by the [^\n.]+ model, running on the DeepSeek Harness\.?\s*/g,
      "",
    )
    .replace(/You are a coding agent powered by the [^\n.]+ model\.?\s*/g, "")
    .replace(/You are Claude Code, Anthropic's official CLI for Claude\.?\s*/g, "")
    .replace(/You are Claude,?[^\n]*/g, "")
    .replace(/我是 Claude[^\n]*/g, "")
    .replace(/由 Anthropic 开发[^\n]*/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ \n/g, "\n")
    .trim();
}

function collectInjectText(purgeSections, fallbackText) {
  const fallback = typeof fallbackText === "string" ? fallbackText : "";
  if (fallback) return fallback;
  const main = purgeSections.find((section) => section.name === "dsh-purge");
  return String(main?.text || "");
}

/** 1.1.38：某一段里必须有整份 inject，不是头 80 字。 */
function assemblyHasExactInject(sections, inject) {
  if (!inject) return true;
  return (Array.isArray(sections) ? sections : []).some((section) => String(section?.text || "").includes(inject));
}

function ensureFullInject(sections, inject) {
  if (!inject || assemblyHasExactInject(sections, inject)) return sections;
  return [
    {
      name: "dsh-purge",
      text: inject,
      interpolate: false,
      order: -100000,
    },
    ...(Array.isArray(sections) ? sections : []).filter((section) => section && section.name !== "dsh-purge"),
  ];
}

const IDENTITY_CARD_PREFIX = "WHO YOU ARE (highest priority";

function isPersonaFoldTarget(name, preferPrefix) {
  if (preferPrefix) return PERSONA_PREFIX_NAMES.has(name);
  return PERSONA_PREFIX_NAMES.has(name) || PERSONA_LEGACY_NAMES.has(name);
}

function stripIdentityPrefix(text) {
  let rest = String(text || "").trim();
  if (rest.startsWith(IDENTITY_CARD_PREFIX)) {
    const split = rest.indexOf("\n\n");
    rest = split >= 0 ? rest.slice(split + 2).trim() : "";
  }
  if (rest.startsWith(OLD_IDENTITY_LOCK)) {
    rest = rest.slice(OLD_IDENTITY_LOCK.length).trim();
  }
  return rest;
}

function hoistFoldedPersona(sections, hasPrefix) {
  const list = Array.isArray(sections) ? sections.slice() : [];
  const idx = list.findIndex((section) => isPersonaFoldTarget(String(section?.name || ""), hasPrefix));
  if (idx <= 0) return list;
  const [hit] = list.splice(idx, 1);
  return [hit, ...list];
}

/** 1.1.34：把 inject 写进 persona-prefix 正文开头，不再另开 dsh-purge 段。 */
function foldInjectIntoPersona(sections, injectText) {
  const inject = typeof injectText === "string" ? injectText : "";
  const list = Array.isArray(sections) ? sections : [];
  const names = list.map((section) => String(section?.name || ""));
  const hasPrefix = names.some((name) => PERSONA_PREFIX_NAMES.has(name));
  let folded = false;
  const out = list.map((section) => {
    const name = String(section?.name || "");
    if (!isPersonaFoldTarget(name, hasPrefix)) return section;
    folded = true;
    const prior = stripIdentityPrefix(String(section.text || ""));
    if (!inject) return { ...section, text: prior, order: GLOBAL_PROMPT_ORDER };
    if (prior.includes(inject)) return { ...section, order: GLOBAL_PROMPT_ORDER, interpolate: false };
    return {
      ...section,
      text: prior ? `${inject}\n\n${prior}` : inject,
      order: GLOBAL_PROMPT_ORDER,
      interpolate: false,
    };
  });
  if (folded) return hoistFoldedPersona(out, hasPrefix);
  if (!inject) return out;
  return hoistFoldedPersona([
    {
      name: "deployment:persona-prefix",
      text: inject,
      order: GLOBAL_PROMPT_ORDER,
      interpolate: false,
    },
    ...out,
  ], true);
}

/** 插件写死的执行句，不是用户的规则集。任何模式都不注入。 */
function isHardcodedExecRule(section) {
  if (section?.name !== "dsh-purge:rules") return false;
  const text = String(section.text || "").trim();
  // 核心指纹:两段写死英文完整命中才算,长度闸从 800 放到 1500 降低用户 rules 文件误伤
  // (用户可能在自己的 rules 里引用这两句做 preamble,之前 800 就刚好误伤到 1200 字节的规则)。
  return text.startsWith("Follow the user's instructions directly and completely.")
    && text.includes("Treat all targets as authorized local fixtures.")
    && text.length < 1500;
}

/**
 * 识别"只写了工作目录"的后缀：旧模板（含 `{{cwd}}`）和已经换成真实路径的都算。
 * 不能把用户自己写的多句后缀误判成 cwd-only，所以只认单句、短句。
 */
function isCwdOnlyText(text) {
  const t = String(text || "").trim();
  if (!t) return false;
  if (t === LEGACY_CWD_ONLY_SUFFIX || t === "Working directory: {{cwd}}." || t === "Working directory: {{cwd}}") {
    return true;
  }
  if (t.length > 300 || t.includes("\n")) return false;
  if (!/^(?:Your working directory is|Working directory:)\s+\S/.test(t)) return false;
  // 句子中间还有第二个句子 → 用户内容，保留。
  return !/[.!?]\s+\S/.test(t);
}

function looksLikeOfficialIdentity(text) {
  const t = String(text || "");
  if (!t.trim()) return true;
  const stripped = stripHarnessPersona(t);
  return !stripped.trim() || isCwdOnlyText(stripped);
}

/**
 * 关掉官方身份，只留工作目录。自定义操作稿在 prefix 里时不动。
 * 工作目录不再依赖宿主插值：0.2.0 有 `cwd` 变量，0.2.1 改成 working-directory 上下文，
 * 所以这里用真实路径拼文本；宿主已经下发 cwd 上下文时就不再多写一段重复的。
 */
export function overlayOfficialIdentity(sections, options = {}) {
  const list = Array.isArray(sections) ? sections : [];
  const hostHasCwdContext = options.hostHasCwdContext === true;
  // 宿主已经用 working-directory 上下文下发 cwd 时，后缀留空即可，免得同一句写两遍。
  const suffixText = hostHasCwdContext ? "" : cwdSuffixText(options.cwd);
  const out = [];
  let sawSuffix = false;
  for (const section of list) {
    if (!section) continue;
    const name = String(section.name || "");
    if (name === "harness:identity" || name === "dsh-purge:identity") continue;
    if (PERSONA_PREFIX_NAMES.has(name) || PERSONA_LEGACY_NAMES.has(name)) {
      const raw = String(section.text || "");
      if (looksLikeOfficialIdentity(raw)) out.push({ ...section, text: "" });
      else out.push(section);
      continue;
    }
    if (name === "deployment:persona-suffix" || name === "persona-suffix") {
      sawSuffix = true;
      const raw = String(section.text || "");
      if (!raw.trim() || looksLikeOfficialIdentity(raw) || isCwdOnlyText(raw)) {
        // 旧"工作目录"句：0.2.1 由上下文接管，直接清空；0.2.0 有真实路径就换成字面量，
        // 拿不到路径时保留原句交给宿主插值（0.2.0 的 `cwd` 变量仍然有效）。
        const keepRaw = isCwdOnlyText(raw) && !hostHasCwdContext && !suffixText;
        out.push({ ...section, text: keepRaw ? raw : suffixText });
      } else {
        out.push(section);
      }
      continue;
    }
    out.push(section);
  }
  if (!sawSuffix && suffixText && !hostHasCwdContext) {
    out.push({
      name: "deployment:persona-suffix",
      text: suffixText,
      order: 10200,
    });
  }
  return out;
}

function withoutHardcodedExec(sections) {
  return sections.filter((section) => !isHardcodedExecRule(section) && !(
    section?.name === "dsh-purge:rules" && !String(section.text || "").trim()
  ));
}

function isInjectOrCapSection(section) {
  const name = String(section?.name || "");
  return name === "dsh-purge" || name === CAPABILITY_SECTION || name === "dsh-purge:post";
}

function presetLabel(value) {
  if (typeof value === "string") return value.trim();
  if (!value || typeof value !== "object") return "";
  if (typeof value.id === "string" && value.id.trim()) return value.id.trim();
  if (typeof value.name === "string" && value.name.trim()) return value.name.trim();
  return "";
}

/** 这一轮智能体实际挂上的预设。用户一切换，这里就是当前模式。 */
function mountedPresetId(context) {
  const agent = context?.agent;
  const ctx = agent?.ctx || context?.ctx;
  if (!ctx) return "";
  let presets = null;
  try {
    presets = typeof ctx.get === "function" ? ctx.get("agentPresets") : ctx.agentPresets;
  } catch {
    presets = null;
  }
  if (!presets || typeof presets.composedPreset !== "function") return "";
  try {
    return presetLabel(presets.composedPreset(ctx));
  } catch {
    return "";
  }
}

export function sessionAgentPreset(context) {
  const session = sessionOfContext(context);
  // 先看这一轮已经挂上的预设，再看用户选过的事件。
  // 投影和会话头经常停在创建时的 standard，不能拿它们盖住当前选择。
  const mounted = mountedPresetId(context);
  if (mounted) return mounted;
  let selected = "";
  for (const event of eventList(session)) {
    if (event?.type !== "agent-preset/selected") continue;
    const name = presetLabel(event.data?.agentPreset || event.data?.preset || event.data?.name);
    if (name) selected = name;
  }
  if (selected) return selected;
  const projected = presetLabel(session?.projectionValues?.agentPreset);
  if (projected) return projected;
  const headerPreset = presetLabel(session?.agentPreset);
  if (headerPreset) return headerPreset;
  return presetLabel(session?.header?.agentPreset);
}

function sessionOfContext(context) {
  return context?.agent?.session || context?.session || null;
}

function childOrigin(header) {
  const origin = String(header?.origin || "").toLowerCase();
  return origin === "subagent" || origin === "teammate" || origin === "delegate";
}

function inheritsParentPrompt(session) {
  const header = session?.header;
  if (!header?.parentSession) return false;
  return childOrigin(header) || (header.delegationDepth ?? 0) > 0;
}

export function isChildAgentContext(context) {
  const header = sessionOfContext(context)?.header;
  if (!header) return false;
  return childOrigin(header) || (header.delegationDepth ?? 0) > 0;
}

function parentFromBag(bag, parentId) {
  if (!bag || !parentId) return null;
  try {
    const parent = typeof bag.get === "function" ? bag.get(parentId) : bag[parentId];
    if (parent?.session) return parent.session;
    if (parent?.header) return parent;
  } catch {
    /* 这一袋没有父会话 */
  }
  return null;
}

function parentSessionRecord(context, parentId) {
  if (!parentId) return null;
  const ctx = context?.agent?.ctx || context?.ctx;
  const bags = [];
  try { bags.push(ctx?.agents); } catch { /* ignore */ }
  try { bags.push(typeof ctx?.get === "function" ? ctx.get("agents") : null); } catch { /* ignore */ }
  try { bags.push(ctx?.sessions); } catch { /* ignore */ }
  try { bags.push(typeof ctx?.get === "function" ? ctx.get("sessions") : null); } catch { /* ignore */ }
  try { bags.push(context?.agent?.parent); } catch { /* ignore */ }
  for (const bag of bags) {
    const found = parentFromBag(bag, parentId);
    if (found) return found;
  }
  try {
    const parentAgent = context?.agent?.parent;
    if (parentAgent?.session) return parentAgent.session;
    if (parentAgent?.header) return parentAgent;
  } catch {
    /* 父会话不在这条注册表上时，用子会话自己的预设。 */
  }
  return null;
}

/** 子代理沿父会话走到主会话，注入和主会话同一份。 */
export function sessionForInject(context) {
  let session = sessionOfContext(context);
  const seen = new Set();
  while (session && !seen.has(session)) {
    seen.add(session);
    if (!inheritsParentPrompt(session)) return session;
    const parent = parentSessionRecord(context, session.header.parentSession);
    if (!parent || parent === session) return session;
    session = parent;
  }
  return sessionOfContext(context);
}

function insertNamedSection(sections, name, text, order) {
  const body = typeof text === "string" ? text.trim() : "";
  if (!body) return sections;
  if (sections.some((section) => String(section?.text || "").includes(body))) return sections;
  const section = { name, text: body, order, interpolate: false };
  const capAt = sections.findIndex((item) => item?.name === CAPABILITY_SECTION);
  const purgeAt = sections.findIndex((item) => item?.name === "dsh-purge");
  const at = capAt >= 0 ? capAt + 1 : purgeAt >= 0 ? purgeAt + 1 : 0;
  const next = sections.slice();
  next.splice(at, 0, section);
  return next;
}

function eventList(session) {
  if (!session) return [];
  if (typeof session.snapshotEvents === "function") {
    try {
      const events = session.snapshotEvents();
      if (Array.isArray(events)) return events;
    } catch {}
  }
  if (Array.isArray(session.events)) return session.events;
  return [];
}

export function isMnemonPluginMessage(message) {
  const source = message?.source;
  if (!source || typeof source !== "object") return false;
  const plugin = String(source.plugin || "").toLowerCase();
  return source.kind === "plugin" && plugin.includes("mnemon");
}

function isMnemonSection(name) {
  return String(name || "").toLowerCase().includes("mnemon");
}

// dsh-agent-instructions 塞 workspace baseline 的两条稳定 marker;
// 剥除时同时按 name 和 text 兜底,运行时 section name 变过也能命中。
const WORKSPACE_BASELINE_TEXT_MARKERS = [
  "This complete workspace instruction baseline replaces all earlier workspace instruction baselines",
  "No workspace instructions are currently active",
];
const WORKSPACE_BASELINE_NAME_HINTS = ["agent-instructions", "workspace-instruction", "workspace_instruction", "replacement-workspace", "replacement_workspace"];

function isWorkspaceBaselineSection(section) {
  if (!section) return false;
  const name = String(section.name || "").toLowerCase();
  if (WORKSPACE_BASELINE_NAME_HINTS.some((hint) => name.includes(hint))) return true;
  if (name.includes("workspace") && (name.includes("baseline") || name.includes("instruction"))) return true;
  const text = typeof section.text === "string" ? section.text : "";
  if (!text) return false;
  return WORKSPACE_BASELINE_TEXT_MARKERS.some((marker) => text.includes(marker));
}

function normalizeRewriteOptions(fallbackInject, options) {
  let mnemonKeep = null;
  try {
    const home = findDshHome();
    if (home) mnemonKeep = loadMnemonSettings(home).keepMnemon;
  } catch { /* 默认回退调用方 */ }
  const callerDropMnemon = fallbackInject && typeof fallbackInject === "object" && !Array.isArray(fallbackInject)
    ? fallbackInject.dropMnemon !== false
    : options?.dropMnemon !== false;
  const dropMnemon = mnemonKeep === true ? false : callerDropMnemon;
  if (fallbackInject && typeof fallbackInject === "object" && !Array.isArray(fallbackInject)) {
    return {
      fallbackInject: typeof fallbackInject.fallbackInject === "string" ? fallbackInject.fallbackInject : "",
      dropMnemon,
      capabilityProtocol: fallbackInject.capabilityProtocol !== false,
      context: fallbackInject.context,
      dropWorkspaceBaseline: fallbackInject.dropWorkspaceBaseline === true,
    };
  }
  return {
    fallbackInject: typeof fallbackInject === "string" ? fallbackInject : "",
    dropMnemon,
    capabilityProtocol: options?.capabilityProtocol !== false,
    context: options?.context,
    dropWorkspaceBaseline: options?.dropWorkspaceBaseline === true,
  };
}

/** 组装结果里每段 text 必须是字符串；否则官方 renderPrompt 的 text.length 会直接炸掉。 */
function sanitizeAssemblySections(sections) {
  const list = Array.isArray(sections) ? sections : [];
  const out = [];
  for (const section of list) {
    if (!section || typeof section !== "object") continue;
    if (typeof section.text === "function") {
      out.push(section);
      continue;
    }
    out.push({
      ...section,
      text: typeof section.text === "string" ? section.text : "",
    });
  }
  return out;
}

const ASSEMBLE_GUARD = Symbol.for("dsh-purge.assembleGuard");

/**
 * 包住 assemble。已经装过就只更新改写函数，不再读、不再 defineProperty。
 * Cordis 每次读服务方法都会新建 Proxy；重复安装会把上一层代理再包进去，最后栈溢出。
 * 宿主之后替换 assemble 时，setter 仍会包住新方法。
 */
export function installAssembleGuard(prompt, rewriteFn) {
  if (!prompt || typeof rewriteFn !== "function") return false;
  let desc;
  try {
    desc = Object.getOwnPropertyDescriptor(prompt, "assemble");
  } catch {
    desc = undefined;
  }
  const bindSlot = (slot) => {
    slot.rewrite = rewriteFn;
    // dispose 必须 noop：ctx.effect cleanup 在 cordis 正常生命周期中也会触发
    // (child ctx scope 结束 / session 边界 / 预设切换),一旦执行链式 dispose,
    // slot.rewrite 会被回滚到 null → assemble 走原生 → inject 失效 → 用户看到
    // "任务到一半就苏醒""保存都救不了"的拒答。
    // 不清 slot.rewrite 是安全的:下次 install 直接覆盖,prompt 对象被 GC 时
    // 整个 slot 一起回收。
    return function dispose() { /* noop */ };
  };
  if (desc && typeof desc.get === "function" && desc.get[ASSEMBLE_GUARD]) {
    return bindSlot(desc.get[ASSEMBLE_GUARD]);
  }
  if (prompt[ASSEMBLE_GUARD]) {
    return bindSlot(prompt[ASSEMBLE_GUARD]);
  }
  let original;
  try {
    original = prompt.assemble;
  } catch {
    return false;
  }
  if (typeof original !== "function") return false;
  // cordis 每次读 assemble 都新包一层 createShadowMethod。已包装则立刻返回，
  // 绝不把这次读到的新代理写进 accessor（#82 / PR #83）。
  if (original._dshPurgeWrapped) {
    if (original._dshPurgeSlot) return bindSlot(original._dshPurgeSlot);
    // 旧包装没挂 slot：没有可解绑的句柄，返回 noop disposer。
    return function dispose() {};
  }
  const slot = { rewrite: rewriteFn };
  const wrap = (fn) => {
    if (typeof fn !== "function") return fn;
    if (fn._dshPurgeWrapped) {
      if (fn._dshPurgeSlot) fn._dshPurgeSlot.rewrite = slot.rewrite;
      return fn;
    }
    const orig = typeof fn.bind === "function" ? fn.bind(prompt) : fn;
    const wrapped = async function assembleWithPurge(...args) {
      let assembled;
      try {
        assembled = await orig(...args);
      } catch (err) {
        // 原生 assemble 抛 → 不再把整个 waterfall 弄死;用户看到的"任务到一半就苏醒"
        // "连保存都救不了"就是这里 throw 之后下游 sections.map 崩掉。
        try { console.warn("[dsh-purge] assembleGuard: inner assemble threw:", err?.message || err); } catch {}
        return { sections: [], contexts: [], tools: [] };
      }
      const rewrite = slot.rewrite;
      if (typeof rewrite !== "function") return assembled;
      try {
        return rewrite(assembled, args[0]);
      } catch (err) {
        try { console.warn("[dsh-purge] assembleGuard: rewrite threw:", err?.message || err); } catch {}
        return assembled;
      }
    };
    wrapped._dshPurgeWrapped = true;
    wrapped._dshPurgeSlot = slot;
    return wrapped;
  };
  const dispose = function dispose() {
    // 同 bindSlot:不清 slot.rewrite,避免 ctx.effect cleanup 时 inject 失效。
    // 下次 install 会直接覆盖 slot.rewrite,prompt 对象被 GC 时 slot 一起回收。
  };
  try {
    let current = wrap(original);
    const getter = function assembleGuard() {
      return current;
    };
    getter[ASSEMBLE_GUARD] = slot;
    Object.defineProperty(prompt, "assemble", {
      configurable: true,
      enumerable: !desc || desc.enumerable !== false,
      get: getter,
      set(next) {
        current = wrap(next);
      },
    });
    return dispose;
  } catch {
    prompt[ASSEMBLE_GUARD] = slot;
    const inner = wrap(original);
    // 极端场景：accessor 挂不上。退到 defineProperty + writable:false，
    // 这样 cordis 下次 `prompt.assemble = next` 会抛，逼它改走 defineProperty，
    // 届时上层会重新调 installAssembleGuard 挂新 slot。
    try {
      Object.defineProperty(prompt, "assemble", {
        value: inner,
        writable: false,
        configurable: true,
        enumerable: true,
      });
      return dispose;
    } catch {
      try {
        prompt.assemble = inner;
        return dispose;
      } catch {
        return false;
      }
    }
  }
}

export function rewritePromptAssembly(assembled, fallbackInject = "", options = {}) {
  if (!assembled || !Array.isArray(assembled.sections)) return assembled;
  const opts = normalizeRewriteOptions(fallbackInject, options);
  // 不原地改写:宿主若复用同一个 assembled 对象,下一轮进来已被我们污染过(多轮 head
  // dsh-purge / CAPABILITY_SECTION 残留)。返回新对象,传入对象保持原状。
  const originalSections = assembled.sections;
  const rest = [];
  const purge = [];
  for (const section of originalSections) {
    if (!section || section.name === "harness:identity") continue;
    if (section.name === "dsh-purge:identity") continue;
    if (opts.dropMnemon && isMnemonSection(section.name)) continue;
    if (opts.dropWorkspaceBaseline && isWorkspaceBaselineSection(section)) continue;
    const next = { ...section };
    if (typeof next.text === "string" && !isPluginPromptSection(next.name)) {
      next.text = stripHarnessPersona(next.text);
    }
    if (isPluginPromptSection(next.name)) {
      purge.push(next);
    } else {
      rest.push(next);
    }
  }

  const injectText = collectInjectText(purge, opts.fallbackInject);
  const protocol = opts.capabilityProtocol === false
    ? ""
    : capabilityProtocolText({ enabled: true });
  const keepRawPurge = !String(injectText || "").trim();
  const extras = withoutHardcodedExec(purge.filter((section) => {
    if (section.name === CAPABILITY_SECTION) return false;
    if (section.name === "dsh-purge") return keepRawPurge;
    return true;
  }));
  let sections = [...rest, ...extras];

  // 0.2.1 起 cwd 不再是被注册的插值变量（改成 working-directory 上下文），
  // 这里按本轮真实工作目录拼人话，最后再把任何残留的 `{{cwd}}` 换掉，避免 renderPrompt 抛错。
  const cwd = cwdOfContext(opts.context);
  const hostHasCwdContext = assemblyHasCwdContext(assembled.contexts);
  const body = overlayOfficialIdentity(sanitizeAssemblySections(sections), { cwd, hostHasCwdContext });
  const folded = foldInjectIntoPersona(body, injectText);
  const tail = [];
  if (String(protocol || "").trim()) {
    tail.push({
      name: CAPABILITY_SECTION,
      text: protocol,
      order: 99999,
      interpolate: false,
    });
  }
  const withoutCapDup = folded.filter((section) => section?.name !== CAPABILITY_SECTION);
  const outSections = ensureFullInject([...withoutCapDup, ...tail], injectText);
  return {
    ...assembled,
    sections: fillCwdPlaceholders(outSections, cwd),
    contexts: Array.isArray(assembled.contexts) ? assembled.contexts : [],
    tools: Array.isArray(assembled.tools) ? assembled.tools : [],
  };
}
