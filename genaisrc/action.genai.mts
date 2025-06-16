import { classify } from "./src/classify.mts";

script({
  title: "Generate TypeScript function documentation using AST insertion",
  description: `This script generates and updates TypeScript function using an AST/LLM hybrid approach.
It uses ast-grep to look for undocumented and documented functions,
then uses a combination of LLM, and LLM-as-a-judge to generate and validate the documentation.

You should pretify your code before and after running this script to normalize the formatting.
`,
  accept: ".ts,.mts,.tsx,.mtsx,.cts",
  files: ["**/src/**/*.{ts,mts,tsx,mtsx,cts}"],
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
      This is a comma-separated list of entity types, e.g. "function,class,interface,typeAlias".
      If not specified, all entities will be targeted.
      Valid values:
          interface
          class
          function
          variable
          enum
          typeAlias
          property
          method`,
      default: "interface,class,function,enum,typeAlias,property,method",
    },
    exportsOnly: {
      type: "boolean",
      description: `If true, only generate docs for exported entities.`,
      default: false,
    },
    maxContext: {
      type: "integer",
      description: "Maximum number of tokens to build content of requests.",
      default: 12000,
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
  judge
} = vars;
const applyEdits = !dryRun;

dbg({
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
  judge
});

if (!addMissing && !updateExisting) cancel(`not generating or updating docs, exiting...`);
if (!files.length) cancel(`no files to process, exiting...`);

const entityKinds = kinds
  .split(",")
  .map((e: string) => e.trim())
  .filter((e: string) => e);
dbg(`entityKinds: %o`, entityKinds);

const declKinds: SgRule = {
  any: [
    entityKinds.includes("function")
      ? { kind: "function_declaration" }
      : null,
    entityKinds.includes("class")
      ? { kind: "class_declaration" }
      : null,
    entityKinds.includes("interface")
      ? { kind: "interface_declaration" }
      : null,
    entityKinds.includes("typeAlias")
      ? { kind: "type_alias_declaration" }
      : null,
    entityKinds.includes("variable")
      ? { kind: "lexical_declaration" }
      : null,
    entityKinds.includes("enum")
      ? { kind: "enum_declaration" }
      : null,
    entityKinds.includes("property")
      ? { kind: "public_field_definition" }
      : null,
    entityKinds.includes("method")
      ? { kind: "method_definition" }
      : null,
  ].filter(Boolean) as SgRule[],
};

dbg(`decls: %o`, declKinds);

const inside: SgRule = {
  inside: {
    any: [
      {
        kind: "program",
      },
      {
        kind: "module",
      },
      {
        kind: "class_body",
      },
    ],
  },
};

// If export only then require an 'export'
const declKindsWithOptionalExport: SgRule = {
  any: [
    exportsOnly ? { any: [] } : declKinds,
    {
      kind: "export_statement",
      has: declKinds,
    },
  ],
};

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
for (const file of files) {
  if (totalUpdates >= maxEdits) {
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
    await updateDocs(
      file,
      stats.at(-1),
      () => totalUpdates >= maxEdits,
      () => totalUpdates++,
    );
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
    await generateDocs(
      file,
      stats.at(-1),
      () => totalUpdates >= maxEdits,
      () => totalUpdates++,
    );
  }
}

if (stats.length)
  output.table(
    // filter out rows with no edits or generation
    stats
      .filter((row) =>
        Object.values(row).some((d) => typeof d === "number" && d > 0),
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
      }))
  );

async function generateDocs(
  file: WorkspaceFile,
  fileStats: FileStats,
  shouldStop: () => boolean,
  onUpdate: () => void,
) {
  const { matches: missingDocs } = await sg.search(
    "ts",
    file.filename,
    {
      rule: {
        ...declKindsWithOptionalExport,
        ...inside,
        not: {
          follows: {
            kind: "comment",
            stopBy: "neighbor",
          },
        },
      },
    },
    { applyGitIgnore: false },
  );
  dbg(`found ${missingDocs.length} missing docs`);

  // build a changeset to accumate edits
  const edits = sg.changeset();
  // for each match, generate a docstring for declarations not documented
  for (const missingDoc of missingDocs) {
    if (shouldStop()) break;
    // Find the child node that is the declaration
    let { declNode, declKind } = getDeclKind(missingDoc);
    const declText = declNode ? declNode.text() : missingDoc.text();
    const res = mock
      ? { error: null, text: "/** GENDOC */", usage: undefined }
      : await runPrompt(
          (_) => {
            const fileRef = _.def("FILE", missingDoc.getRoot().root().text(), {
              flex: 1,
            });
            const declRef = _.def(
              "DECLARATION",
              declText,
              { flex: 10 }
            );
            _.$`Generate a TypeScript documentation comment for the ${declKind} ${declRef}.
                - Make sure parameters, type parameters, and return types are documented if relevant.
                - Be concise. Use a technical tone.
                - Do NOT include types, this is for TypeScript.
                - Use docstring syntax (https://tsdoc.org/). Do not wrap in markdown code section.
                The full source of the file is in ${fileRef} for reference.`.role(
              "system"
            );
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

    const docs = docify(res.text.trim(), missingDoc);

    // sanity check
    const judgeRes =
      mock || !judge
        ? { label: "ok", usage: undefined, answer: undefined }
        : await classify(
            (_) => {
              _.def("FUNCTION", missingDoc.text());
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
              system: ["system.technical", "system.typescript"],
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
    const updated = `${docs}${missingDoc.text()}`;
    edits.replace(missingDoc, updated);
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

function getDeclKind(missingDoc: SgNode) {
  let declKind = "declaration";
  let declNode : SgNode | null = null;
  for (const kind of [
    "function_declaration",
    "class_declaration",
    "interface_declaration",
    "type_alias_declaration",
    "lexical_declaration",
    "enum_declaration",
    "public_field_definition",
    "method_definition",
  ]) {
    const node = missingDoc.find(kind);
    if (node) {
      declNode = node;
      if (kind === "function_declaration") declKind = "function";
      else if (kind === "class_declaration") declKind = "class";
      else if (kind === "interface_declaration") declKind = "interface";
      else if (kind === "type_alias_declaration") declKind = "type alias";
      else if (kind === "lexical_declaration") declKind = "variable";
      else if (kind === "enum_declaration") declKind = "enum";
      else if (kind === "public_field_definition") declKind = "property";
      else if (kind === "method_definition") declKind = "method";
      else break;
      dbg(`found ${declKind} declaration: %s`, node.text());
    }
  }
  return { declNode, declKind };
}

async function updateDocs(
  file: WorkspaceFile,
  fileStats: FileStats,
  shouldStop: () => boolean,
  onUpdate: () => void,
) {
  const { matches } = await sg.search(
    "ts",
    file.filename,
    {
      rule: {
        ...declKindsWithOptionalExport,
        ...inside,
        follows: {
          kind: "comment",
          stopBy: "neighbor",
        },
      },
    },
    { applyGitIgnore: false },
  );
  dbg(`found ${matches.length} docs to updateExisting`);
  const edits = sg.changeset();
  const pendingCacheUpdates: { body: string; comment: string }[] = [];
  // for each match, generate a docstring for functions not documented
  for (const existingDoc of matches) {
    if (shouldStop()) break;
    const comment = existingDoc.prev();
    let { declNode, declKind } = getDeclKind(existingDoc);
    const declText = declNode ? declNode.text() : existingDoc.text();

    const res = await runPrompt(
      (_) => {
        const declRef = _.def(
          "DECLARATION",
          declText,
          { flex: 10 }
        );
        _.def("FILE", existingDoc.getRoot().root().text(), { flex: 1 });
        _.def("DOCSTRING", comment.text(), { flex: 10 });
        // this needs more eval-ing
        _.$`Update the TypeScript docstring <DOCSTRING> to match the code in ${declKind} ${declRef}.
- If the docstring is up to date, return /NO/. It's ok to leave it as is.
- do not rephrase an existing sentence if it is correct.
- Make sure parameters are documented.
- do NOT include types, this is for TypeScript.
- Use docstring syntax. do not wrap in markdown code section.
- Minimize updates to the existing docstring.

The full source of the file is in <FILE> for reference.
The source of the function is in ${declRef}.
The current docstring is <DOCSTRING>.

docstring:

/**
 * description
 * @param param1 - description
 * @param param2 - description
 * @returns description
 */
`;
      },
      {
        model,
        responseType: "text",
        flexTokens: maxContext,
        label: declText.slice(0, 20) + "...",
        cache,
        temperature: 0.2,
        systemSafety: false,
        system: ["system.technical", "system.typescript"],
      },
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

    const docs = docify(res.text.trim(), comment);
    // ask LLM if change is worth it
    const judgeRes =
      mock || !judge
        ? { label: "ok", usage: undefined, answer: undefined }
        : await classify(
            (_) => {
              const declRef = _.def("DECLARATION", declText, { flex: 10 });
              _.def("ORIGINAL_DOCS", comment.text());
              _.def("NEW_DOCS", docs);
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
              system: ["system.technical", "system.typescript"],
            }
          );

    fileStats.judge += judgeRes.usage?.total || 0;
    fileStats.judgeCost += judgeRes.usage?.cost || 0;
    if (judgeRes.label === "NIT") {
      output.warn("LLM suggests minor adjustments, skipping");
      fileStats.nits++;
      continue;
    }
    edits.replace(comment, docs);
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
  dbg(`updated ${file.filename} by updating ${fileStats.generated} existing comments`);
}

function docify(docs: string, node: SgNode) {
  const range = node.range();
  dbg(`node range: %o`, range);
  const indentation = " ".repeat(range.start.column);
  dbg(`indentation: %s`, indentation);

  // TODO: use tsdoc package to validate/normalize docs
  docs = parsers.unfence(docs, "*");
  // TODO: sometimes the AI add /** */, removing
  // TODO: consider using a schema to restrict docs generation
  if (!/^\s*\/\*\*.*.*\*\/\s*$/s.test(docs))
    docs = `/**\n* ${docs.split(/\r?\n/g).join("\n* ")}\n*/`;

  // normalize indentation
  docs = docs.replace(/\r?\n/g, (m) => m + indentation);

  // remove trailing newlines
  return docs.replace(/(\r?\n)+$/, "") + "\n" + indentation;
}
