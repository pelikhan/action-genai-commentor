import { classify } from "genaiscript/runtime";

script({
  title: "Generate TypeScript function documentation using AST insertion",
  description: `
## Docs!

This script generates and updates TypeScript function using an AST/LLM hybrid approach.
It uses ast-grep to look for undocumented and documented functions,
then uses a combination of LLM, and LLM-as-a-judge to generate and validate the documentation.

You should pretify your code before and after running this script to normalize the formatting.
`,
  accept: ".ts,.mts,.tsx,.mtsx",
  branding: {
    color: "yellow",
    icon: "filter",
  },
  parameters: {
    instructions: {
      type: "string",
      description: `Additional prompting instructions for the LLM.`,
    },
    dryRun: {
      type: "boolean",
      default: false,
      description: "If true, the script will not modify files.",
    },
    missing: {
      type: "boolean",
      default: true,
      description: "Generate missing docs.",
    },
    update: {
      type: "boolean",
      default: false,
      description: "Update existing docs.",
    },
    maxFiles: {
      type: "integer",
      description: "Maximum number of files to process.",
      default: 100,
    },
    maxUpdates: {
      type: "integer",
      description: "Maximum number of new or updated comments total.",
      default: 100,
    },
  },
});
const { output, dbg, vars } = env;

let { files } = env;
const { dryRun, missing, update, maxFiles, maxUpdates, instructions } = vars;
const applyEdits = !dryRun;

dbg({ applyEdits, missing, update, maxFiles, maxUpdates, instructions });

if (!missing && !update) cancel(`not generating or updating docs, exiting...`);
if (maxFiles && files.length > maxFiles) {
  dbg(`random slicing files to ${maxFiles}`);
  files = parsers.tidyData(files, {
    sliceSample: maxFiles,
  }) as WorkspaceFile[];
}
if (!files.length) cancel(`no files to process, exiting...`);

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
  refused: number; // refused generation
  edits: number; // edits made
  updated: number; // files updated
  nits?: number; // nits found, only for new docs
};
const stats: FileStats[] = [];

// process each file serially
for (const file of files) {
  console.debug(file.filename);

  // generate updated docs
  if (update) {
    stats.push({
      filename: file.filename,
      kind: "update",
      gen: 0,
      genCost: 0,
      judge: 0,
      judgeCost: 0,
      refused: 0,
      edits: 0,
      updated: 0,
      nits: 0,
    });
    await updateDocs(file, stats.at(-1));
  }

  // generate missing docs
  if (missing) {
    stats.push({
      filename: file.filename,
      kind: "new",
      gen: 0,
      genCost: 0,
      judge: 0,
      judgeCost: 0,
      refused: 0,
      edits: 0,
      updated: 0,
      nits: 0,
    });
    await generateDocs(file, stats.at(-1));
  }
}

if (stats.length)
  output.table(
    // filter out rows with no edits or generation
    stats.filter((row) =>
      Object.values(row).some((d) => typeof d === "number" && d > 0)
    )
  );

async function generateDocs(file: WorkspaceFile, fileStats: FileStats) {
  const { matches: missingDocs } = await sg.search(
    "ts",
    file.filename,
    {
      rule: {
        kind: "export_statement",
        not: {
          follows: {
            kind: "comment",
            stopBy: "neighbor",
          },
        },
        has: {
          kind: "function_declaration",
        },
      },
    },
    { applyGitIgnore: false }
  );
  dbg(`found ${missingDocs.length} missing docs`);

  // build a changeset to accumate edits
  const edits = sg.changeset();
  // for each match, generate a docstring for functions not documented
  for (const missingDoc of missingDocs) {
    const res = await runPrompt(
      (_) => {
        // TODO: review what's the best context to provide enough for the LLM to generate docs
        const fileRef = _.def("FILE", missingDoc.getRoot().root().text()); // TODO: make this optional or insert
        const functionRef = _.def("FUNCTION", missingDoc.text()); // TODO: expand around function

        // this needs more eval-ing
        _.$`Generate a TypeScript function documentation for ${functionRef}.
                - Make sure parameters are documented.
                - Be concise. Use technical tone.
                - do NOT include types, this is for TypeScript.
                - Use docstring syntax (https://tsdoc.org/). do not wrap in markdown code section.
    
                The full source of the file is in ${fileRef} for reference.`.role(
          "system"
        );
        if (instructions) _.$`${instructions}`.role("system");
      },
      {
        model: "large",
        responseType: "text",
        label: missingDoc.text()?.slice(0, 20) + "...",
      }
    );
    // if generation is successful, insert the docs
    fileStats.gen += res.usage?.total || 0;
    fileStats.genCost += res.usage?.cost || 0;
    if (res.error) {
      output.warn(res.error.message);
      continue;
    }

    const docs = docify(res.text.trim(), missingDoc);

    // sanity check
    const judge = await classify(
      (_) => {
        _.def("FUNCTION", missingDoc.text());
        _.def("DOCS", docs);
      },
      {
        ok: "The content in <DOCS> is an accurate documentation for the code in <FUNCTION>.",
        err: "The content in <DOCS> does not match with the code in <FUNCTION>.",
      },
      {
        model: "small",
        responseType: "text",
        temperature: 0.2,
        systemSafety: false,
        system: ["system.technical", "system.typescript"],
      }
    );
    fileStats.judge += judge.usage?.total || 0;
    fileStats.judgeCost += judge.usage?.cost || 0;
    if (judge.label !== "ok") {
      fileStats.refused++;
      output.warn(judge.label);
      output.fence(judge.answer);
      continue;
    }
    const updated = `${docs}${missingDoc.text()}`;
    edits.replace(missingDoc, updated);
    fileStats.edits++;
    fileStats.nits++;
  }

  // apply all edits and write to the file
  const modifiedFiles = edits.commit();
  if (!modifiedFiles?.length) {
    dbg("no edits to apply");
    return;
  }
  fileStats.updated = 1;
  if (applyEdits) {
    await workspace.writeFiles(modifiedFiles);
  } else {
    output.diff(file, modifiedFiles[0]);
  }
}

async function updateDocs(file: WorkspaceFile, fileStats: FileStats) {
  const { matches } = await sg.search(
    "ts",
    file.filename,
    YAML`
rule: 
  kind: "export_statement"
  follows: 
    kind: "comment"
    stopBy: neighbor
  has:
      kind: "function_declaration"
`,
    { applyGitIgnore: false }
  );
  dbg(`found ${matches.length} docs to update`);
  const edits = sg.changeset();
  // for each match, generate a docstring for functions not documented
  for (const match of matches) {
    const comment = match.prev();

    const res = await runPrompt(
      (_) => {
        _.def("FILE", match.getRoot().root().text(), { flex: 1 });
        _.def("DOCSTRING", comment.text(), { flex: 10 });
        _.def("FUNCTION", match.text(), { flex: 10 });
        // this needs more eval-ing
        _.$`Update the TypeScript docstring <DOCSTRING> to match the code in function <FUNCTION>.
                - If the docstring is up to date, return /NO/. It's ok to leave it as is.
                - do not rephrase an existing sentence if it is correct.
                - Make sure parameters are documented.
                - do NOT include types, this is for TypeScript.
                - Use docstring syntax. do not wrap in markdown code section.
                - Minimize updates to the existing docstring.
                
                The full source of the file is in <FILE> for reference.
                The source of the function is in <FUNCTION>.
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
        model: "large",
        responseType: "text",
        flexTokens: 12000,
        label: match.text()?.slice(0, 20) + "...",
        temperature: 0.2,
        systemSafety: false,
        system: ["system.technical", "system.typescript"],
      }
    );
    fileStats.gen += res.usage?.total || 0;
    fileStats.genCost += res.usage?.cost || 0;
    // if generation is successful, insert the docs
    if (res.error) {
      output.warn(res.error.message);
      continue;
    }

    if (res.text.includes("/NO/")) continue;

    const docs = docify(res.text.trim(), comment);

    // ask LLM if change is worth it
    const judge = await classify(
      (_) => {
        _.def("FUNCTION", match.text());
        _.def("ORIGINAL_DOCS", comment.text());
        _.def("NEW_DOCS", docs);
        _.$`An LLM generated an updated docstring <NEW_DOCS> for function <FUNCTION>. The original docstring is <ORIGINAL_DOCS>.`;
      },
      {
        APPLY:
          "The <NEW_DOCS> is a significant improvement to <ORIGINAL_DOCS>.",
        NIT: "The <NEW_DOCS> contains nitpicks (minor adjustments) to <ORIGINAL_DOCS>.",
      },
      {
        model: "large",
        responseType: "text",
        temperature: 0.2,
        systemSafety: false,
        system: ["system.technical", "system.typescript"],
      }
    );

    fileStats.judge += judge.usage?.total || 0;
    fileStats.judgeCost += judge.usage?.cost || 0;
    if (judge.label === "NIT") {
      output.warn("LLM suggests minor adjustments, skipping");
      continue;
    }
    edits.replace(comment, docs);
    fileStats.edits++;
  }

  // apply all edits and write to the file
  const modifiedFiles = edits.commit();
  if (!modifiedFiles?.length) {
    dbg("no edits to apply");
    return;
  }
  fileStats.updated = 1;
  if (applyEdits) {
    await workspace.writeFiles(modifiedFiles);
  } else {
    output.diff(file, modifiedFiles[0]);
  }
}

function docify(docs: string, node: SgNode) {
  const range = node.range();
  dbg(`node range: %o`, range);
  const indentation = " ".repeat(node.range().start.column);
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
