import { classify } from "./src/classify.mts";
import { csharpOps } from "./src/csharp.mts";
import type { EntityKind, LanguageOps } from "./src/langops.mts";
import { pythonOps } from "./src/python.mts";
import { typescriptOps } from "./src/typescript.mts";

script({
  title: "Generate code comments using AST insertion",
  description: `Generates and updates code comments using an AST/LLM hybrid approach.
It uses ast-grep to look for undocumented and documented functions, classes, interfaces, and other
entities in the codebase, then uses a combination of LLM, and LLM-as-a-judge to generate and validate
the documentation.
You should pretify your code before and after running this script to normalize the formatting.
`,
  accept: ".ts,.mts,.tsx,.mtsx,.cts,.py,*.cs",
  files: "**/*.{ts,mts,tsx,mtsx,cts,py,cs}",
  branding: {
    color: "yellow",
    icon: "filter",
  },
  parameters: {
    model: {
      type: "string",
      description: "The LLM model to use for generation.",
    },
    instructions: {
      type: "string",
      description: `Additional prompting instructions for the LLM.`,
    },
    dryRun: {
      type: "boolean",
      default: false,
      description: "If true, the script will not modify files.",
    },
    mock: {
      type: "boolean",
      default: false,
      description: "If true, the script will mock LLM results.",
    },
    judge: {
      type: "boolean",
      default: false,
      description: "If true, the script will judge the generated docs.",
    },
    updateExisting: {
      type: "boolean",
      default: false,
      description: "Update existing docs.",
    },
    maxEdits: {
      type: "integer",
      description: "Maximum number of new or updated comments total.",
      default: 50,
    },
    kinds: {
      type: "string",
      description: `The kinds of entities to target for documentation generation.
      This is a comma-separated list of entity types, e.g. "module,type,function,property,variable".
      If not specified, all entities will be targeted.
      Valid values: module,type,function,property,variable`,
      default: "module,type,function,property",
    },
    exportsOnly: {
      type: "boolean",
      description: `If true, only generate docs for exported entities.`,
      default: false,
    },
    maxContext: {
      type: "integer",
      description: "Maximum number of tokens to build content of requests.",
      default: 6000,
    },
  },
});
const { output, dbg, vars } = env;
const cache = true;

let { files } = env;
const {
  model = "large",
  dryRun,
  mock,
  addMissing = true,
  updateExisting,
  maxEdits,
  instructions,
  maxContext,
  kinds,
  exportsOnly,
  judge,
} = vars;
const applyEdits = !dryRun;

dbg({
  files: files.map((f) => f.filename),
  model,
  dryRun,
  mock,
  applyEdits,
  addMissing,
  updateExisting,
  maxEdits,
  instructions,
  maxContext,
  kinds,
  exportsOnly,
  judge,
});

if (!addMissing && !updateExisting)
  cancel(`not generating or updating docs, exiting...`);
if (!files.length) cancel(`no files to process, exiting...`);

const entityKinds: EntityKind[] = kinds
  .split(",")
  .map((e: string) => e.trim())
  .filter((e: string) => e);

dbg(`entityKinds: %o`, entityKinds);

// launch ast-grep instance
const sg = await host.astGrep();

// collect tokens, generation stats for final report
type FileStats = {
  filename: string;
  kind: "new" | "update";
  gen: number; // generation cost
  genCost: number; // generation cost
  judge: number; // judge cost
  judgeCost: number; // judge cost
  generated: number; // # generated docs
  updated: number; // # updated docs
  nits: number; // nits found, only for new docs
  refused: number; // refused generation
};
const stats: FileStats[] = [];

// process each file serially
let totalUpdates = 0; // Track total new or updated comments
function shouldStop() {
  return totalUpdates >= maxEdits;
}

function onUpdate() {
  totalUpdates++;
  dbg(`total updates: %d`, totalUpdates);
}

function getLanguageOps(language: SgLang): LanguageOps {
  if (language === "python") {
    return pythonOps;
  } else if (language === "typescript") {
    return typescriptOps;
  } else if (language === "csharp") {
    return csharpOps;
  } else {
    cancel(`unsupported language: ${language}`);
  }
}

for (const file of files) {
  if (shouldStop()) {
    dbg(`reached max updates, stopping.`);
    break;
  }
  console.debug(file.filename);

  // generate updated docs
  if (updateExisting) {
    stats.push({
      filename: file.filename,
      kind: "update",
      gen: 0,
      genCost: 0,
      judge: 0,
      judgeCost: 0,
      generated: 0,
      updated: 0,
      nits: 0,
      refused: 0,
    });
    await updateDocs(file, stats.at(-1));
  }

  // generate missing docs
  if (addMissing) {
    stats.push({
      filename: file.filename,
      kind: "new",
      gen: 0,
      genCost: 0,
      judge: 0,
      judgeCost: 0,
      generated: 0,
      updated: 0,
      nits: 0,
      refused: 0,
    });
    await addMissingDocs(file, stats.at(-1));
  }
}

if (stats.length) {
  // filter out rows with no edits or generation
  const table = stats
    .filter((row) =>
      Object.values(row).some((d) => typeof d === "number" && d > 0)
    )
    // Format the numbers
    .map((row) => ({
      ...row,
      gen: row.gen.toFixed(2),
      genCost: row.genCost.toFixed(2),
      judge: row.judge.toFixed(2),
      judgeCost: row.judgeCost.toFixed(2),
      generated: row.generated.toFixed(0),
      updated: row.updated.toFixed(0),
      nits: row.nits?.toFixed(0) || "N/A",
      refused: row.refused.toFixed(0),
    }));

  output.table(table);
}

async function addMissingDocs(file: WorkspaceFile, fileStats: FileStats) {
  const language = getLanguage(file);
  const langOps = getLanguageOps(language);
  const rule = langOps.getCommentableNodesMatcher(
    entityKinds,
    false,
    exportsOnly
  );
  dbg(`searching for missing docs in %s`, file.filename);
  const { matches } = await sg.search(language, file.filename, { rule }, {});
  dbg(`found ${matches.length} missing docs`);

  // build a changeset to accumate edits
  const edits = sg.changeset();

  // for each match, generate a docstring for declarations not documented
  for (const match of matches) {
    if (shouldStop()) break;
    // Find the child node that is the declaration
    let { declNode, declKind } = getDeclNodeAndKind(match);
    const declText = declNode ? declNode.text() : match.text();
    const res = mock
      ? { error: null, text: "GENDOC", usage: undefined }
      : await runPrompt(
          (_) => {
            const fileRef = _.def("FILE", match.getRoot().root().text(), {
              flex: 1,
            });
            const declRef = _.def("DECLARATION", declText, { flex: 10 });
            langOps
              .addGenerateDocPrompt(_, declKind, declRef, fileRef)
              .role("system");
            if (instructions) _.$`${instructions}`.role("system");
          },
          {
            model,
            responseType: "text",
            flexTokens: maxContext,
            label: declText.slice(0, 20) + "...",
            cache,
          }
        );
    fileStats.gen += res.usage?.total || 0;
    fileStats.genCost += res.usage?.cost || 0;
    if (res.error) {
      output.warn(res.error.message);
      continue;
    }

    const nodeToAdjust0 = langOps.getCommentInsertionNode(match);
    dbg(`node to adjust0: %o`, nodeToAdjust0.range());
    const nodeToAdjust = getFirstNode(nodeToAdjust0);
    dbg(`node to adjust: %o`, nodeToAdjust.range());

    const docs = getIndentedCommentText(res.text.trim(), nodeToAdjust, langOps);

    // sanity check
    const judgeRes =
      mock || !judge
        ? { label: "ok", usage: undefined, answer: undefined }
        : await classify(
            (_) => {
              _.def("FUNCTION", match.text());
              _.def("DOCS", docs);
            },
            {
              ok: "The content in <DOCS> is an accurate documentation for the code in <FUNCTION>.",
              err: "The content in <DOCS> does not match with the code in <FUNCTION>.",
            },
            {
              model,
              responseType: "text",
              temperature: 0.2,
              flexTokens: maxContext,
              cache,
              systemSafety: false,
              system: [
                "system.technical",
                langOps.getLanguageSystemPromptName(),
              ],
            }
          );
    fileStats.judge += judgeRes.usage?.total || 0;
    fileStats.judgeCost += judgeRes.usage?.cost || 0;
    if (judgeRes.label !== "ok") {
      fileStats.refused++;
      output.warn(judgeRes.label);
      output.fence(judgeRes.answer);
      continue;
    }
    edits.replace(nodeToAdjust, `${docs}${nodeToAdjust.text()}`);
    fileStats.generated++;
    onUpdate();
  }

  // apply all edits and write to the file
  const modifiedFiles = edits.commit();
  if (!modifiedFiles?.length) {
    dbg("no edits to apply");
    return;
  }
  if (applyEdits) {
    await workspace.writeFiles(modifiedFiles);
  }
  output.diff(file, modifiedFiles[0]);
  dbg(`updated ${file.filename} by adding ${fileStats.generated} new comments`);
}

function getFirstNode(node: SgNode) {
  // Find the first node
  dbg(`getting first node from %o`, node.range(), node.children().length);
  while (node && node.children().length > 0) {
    node = node.children()[0];
    dbg(`next node: %o`, node.range());
  }
  return node;
}

async function updateDocs(file: WorkspaceFile, fileStats: FileStats) {
  const language = getLanguage(file);
  const langOps = getLanguageOps(language);
  const rule = langOps.getCommentableNodesMatcher(
    entityKinds,
    true,
    exportsOnly
  );
  const { matches } = await sg.search(language, file.filename, { rule }, {});
  dbg(`found ${matches.length} docs to updateExisting`);
  const edits = sg.changeset();
  // for each match, generate a docstring for functions not documented
  for (const match of matches) {
    if (shouldStop()) break;
    const docNodes = langOps.getCommentNodes(match);
    let { declNode, declKind } = getDeclNodeAndKind(match);
    const declText = declNode ? declNode.text() : match.text();

    const docsText = docNodes
      .map((n) => n.text().trim())
      .join("\n")
      .trim();

    const res = mock
      ? { error: null, text: "UPDATEDOC", usage: undefined }
      : await runPrompt(
          (_) => {
            const declRef = _.def("DECLARATION", declText, { flex: 10 });
            _.def("FILE", match.getRoot().root().text(), { flex: 1 });
            _.def("DOCSTRING", docsText, { flex: 10 });
            langOps.addUpdateDocPrompt(_, declKind, declRef).role("system");
          },
          {
            model,
            responseType: "text",
            flexTokens: maxContext,
            label: declText.slice(0, 20) + "...",
            cache,
            temperature: 0.2,
            systemSafety: false,
            system: ["system.technical", langOps.getLanguageSystemPromptName()],
          }
        );
    fileStats.gen += res.usage?.total || 0;
    fileStats.genCost += res.usage?.cost || 0;
    // if generation is successful, insert the docs
    if (res.error) {
      output.warn(res.error.message);
      continue;
    }

    if (res.text.includes("/NO/")) {
      dbg(`llm says docs are up to date, skipping`);
      continue;
    }

    const newDocs = getIndentedCommentText(
      res.text.trim(),
      docNodes[0],
      langOps
    );

    // Ask LLM if change is worth it
    const judgeRes =
      mock || !judge
        ? { label: "ok", usage: undefined, answer: undefined }
        : await classify(
            (_) => {
              const declRef = _.def("DECLARATION", declText, { flex: 10 });
              _.def("ORIGINAL_DOCS", docsText);
              _.def("NEW_DOCS", newDocs);
              _.$`An LLM generated an updated docstring <NEW_DOCS> for ${declKind} ${declRef}. The original docstring is <ORIGINAL_DOCS>.`;
            },
            {
              APPLY:
                "The <NEW_DOCS> is a significant improvement to <ORIGINAL_DOCS>.",
              NIT: "The <NEW_DOCS> contains nitpicks (minor adjustments) to <ORIGINAL_DOCS>.",
            },
            {
              model,
              responseType: "text",
              temperature: 0.2,
              systemSafety: false,
              cache,
              system: [
                "system.technical",
                langOps.getLanguageSystemPromptName(),
              ],
            }
          );

    fileStats.judge += judgeRes.usage?.total || 0;
    fileStats.judgeCost += judgeRes.usage?.cost || 0;
    if (judgeRes.label === "NIT") {
      output.warn("LLM suggests minor adjustments, skipping");
      fileStats.nits++;
      continue;
    }
    edits.replace(docNodes[0], newDocs.trimEnd());

    // TODO: this is not accurate for C# and other languages where docNodes.length > 1, as it leaves whitespace hanging around
    for (let i = 1; i < docNodes.length; i++) {
      edits.replace(docNodes[i], "");
    }
    fileStats.updated++;
    onUpdate();
  }

  // apply all edits and write to the file
  const modifiedFiles = edits.commit();
  if (!modifiedFiles?.length) {
    dbg("no edits to apply");
    return;
  }
  if (applyEdits) {
    await workspace.writeFiles(modifiedFiles);
  } else {
    output.diff(file, modifiedFiles[0]);
  }
  dbg(
    `updated ${file.filename} by updating ${fileStats.generated} existing comments`
  );
}

function getIndentedCommentText(
  docs: string,
  node: SgNode,
  langOps: LanguageOps
): string {
  const range = node.range();
  dbg(`node range: %o`, range);
  const indentation = " ".repeat(range.start.column);
  dbg(`indentation: %s`, indentation);

  // TODO: Consider using a schema to restrict docs generation
  docs = langOps.getCommentText(docs);

  // normalize indentation
  docs = docs.replace(/\r?\n/g, (m) => m + indentation);

  // remove trailing newlines
  docs = docs.replace(/(\r?\n)+$/, "") + "\n" + indentation;
  dbg(`docified docs: <<<%s>>>`, docs);

  return docs;
}

function getLanguage(file: WorkspaceFile): SgLang {
  return file.filename.endsWith(".py")
    ? "python"
    : file.filename.endsWith(".cs") || file.filename.endsWith(".csx")
    ? "csharp"
    : "typescript";
}

function getDeclNodeAndKind(decl: SgNode) {
  const declKind = decl.kind();
  return { declNode: decl, declKind };
}
