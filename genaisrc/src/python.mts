import type { EntityKind, LanguageOps } from "./langops.mts";

const dbg = host.logger("script:python");

class Python implements LanguageOps {
  getCommentableNodesMatcher(entityKinds: EntityKind[], withComments: boolean) {
    const declKinds: SgRule = {
      any: [
        entityKinds.includes("function")
          ? { kind: "function_definition" }
          : null,
        entityKinds.includes("type") ? { kind: "class_definition" } : null,
      ].filter(Boolean) as SgRule[],
    };
    const inside: SgRule = {
      inside: {
        any: [
          {
            kind: "module",
          },
          {
            kind: "block",
          },
        ],
      },
    };
    const withDocstring: SgRule = {
      has: {
        kind: "block",
        has: {
          nthChild: 1,
          kind: "expression_statement",
          has: {
            nthChild: 1,
            kind: "string",
          },
        },
      },
    };
    const docsRule: SgRule = withComments
      ? withDocstring
      : {
          not: withDocstring,
        };

    return { ...declKinds, ...inside, ...docsRule };
  }
  getCommentNodes(decl: SgNode) {
    // Find the comment that follows the declaration
    const docnode = decl
      .find({ rule: { kind: "block" } })
      ?.find({ rule: { kind: "expression_statement" } })
      ?.find({ rule: { kind: "string" } });
    if (!docnode) {
      dbg(`no docstring found for %s`, decl.text());
      return null;
    }
    dbg(`found docnode: %s`, docnode.text());
    return [docnode];
  }
  getCommentInsertionNode(node: SgNode) {
    return node.find({ rule: { kind: "block" } });
  }

  getLanguageSystemPromptName() {
    return "system.python";
  }
  getCommentText(docs: string) {
    docs = parsers.unfence(docs, '"');
    if (!/^\s*""".*.*"""$/s.test(docs)) {
      docs = `"""${docs.split(/\r?\n/g).join("\n")}${
        docs.includes("\n") ? "\n" : ""
      }"""`;
    }
    return docs;
  }

  addUpdateDocPrompt(
    _: ChatGenerationContext,
    declKind: any,
    declRef: string
  ) {
    return _.$`Update the Python docstring <DOCSTRING> to match the code in ${declKind} ${declRef}.
- If the docstring is up to date, return /NO/. It's ok to leave it as is.
- do not rephrase an existing sentence if it is correct.
- Make sure parameters are documented.
- Use docstring syntax (https://peps.python.org/pep-0257/). Do not wrap in markdown code section.
- Minimize updates to the existing docstring.

The full source of the file is in <FILE> for reference.
The source of the function is in ${declRef}.
The current docstring is <DOCSTRING>.

docstring:

"""
description
:param param1: description
:param param2: description
:return: description
"""
`;
  }
  addGenerateDocPrompt(
    _: ChatGenerationContext,
    declKind: string,
    declRef: string,
    fileRef: string
  ) {
    return _.$`Generate a Python documentation comment for the ${declKind} ${declRef}.
- Make sure parameters, type parameters, and return types are documented if relevant.
- Be concise. Use a technical tone.
- Use docstring syntax (https://peps.python.org/pep-0257/). Do not wrap in markdown code section.
The full source of the file is in ${fileRef} for reference.`;
  }
}

export const pythonOps = new Python();
