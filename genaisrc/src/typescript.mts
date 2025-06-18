const dbg = host.logger("script:typescript");

import type { EntityKind, LanguageOps } from "./langops.mts";

class Typescript implements LanguageOps {
  getCommentableNodesMatcher(
    entityKinds: EntityKind[],
    withComments: boolean,
    exportsOnly: boolean
  ) {
    const declKindsRaw: SgRule = {
      any: [
        entityKinds.includes("function")
          ? { kind: "function_declaration" }
          : null,
        entityKinds.includes("type") ? { kind: "class_declaration" } : null,
        entityKinds.includes("type") ? { kind: "interface_declaration" } : null,
        entityKinds.includes("type")
          ? { kind: "type_alias_declaration" }
          : null,
        entityKinds.includes("variable")
          ? { kind: "lexical_declaration" }
          : null,
        entityKinds.includes("type") ? { kind: "enum_declaration" } : null,
        entityKinds.includes("property")
          ? { kind: "public_field_definition" }
          : null,
        entityKinds.includes("function") ? { kind: "method_definition" } : null,
      ].filter(Boolean) as SgRule[],
    };
    // If export only then require an 'export'
    const declKinds: SgRule = {
      any: [
        exportsOnly ? { any: [] } : declKindsRaw,
        {
          kind: "export_statement",
          has: declKindsRaw,
        },
      ],
    };
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
    const withDocComment: SgRule = {
      follows: {
        kind: "comment",
        stopBy: "neighbor",
      },
    };
    const docsRule: SgRule = withComments
      ? withDocComment
      : {
          not: withDocComment,
        };

    return { ...declKinds, ...inside, ...docsRule };
  }
  getCommentNodes(decl: SgNode) {
    return [decl.prev()];
  }
  getCommentInsertionNode(node: SgNode) {
    return node;
  }

  getLanguageSystemPromptName() {
    return "system.typescript";
  }
  getCommentText(docs: string) {
    docs = parsers.unfence(docs, "*");

    if (!/^\s*\/\*\*.*.*\*\/\s*$/s.test(docs))
      docs = `/**\n * ${docs.split(/\r?\n/g).join("\n * ")}\n */`;
    return docs;
  }
  addGenerateDocPrompt(
    _: ChatGenerationContext,
    declKind: any,
    declRef: string,
    fileRef: string
  ): PromptTemplateString {
    return _.$`Generate a TypeScript documentation comment for the ${declKind} ${declRef}.
- Make sure parameters, type parameters, and return types are documented if relevant.
- Be concise. Use a technical tone.
- Do NOT include types, this is for TypeScript.
- Use docstring syntax (https://tsdoc.org/). Do not wrap in markdown code section.
The full source of the file is in ${fileRef} for reference.`;
  }

  addUpdateDocPrompt(
    _: ChatGenerationContext,
    declKind: any,
    declRef: string
  ): PromptTemplateString {
    return _.$`Update the TypeScript docstring <DOCSTRING> to match the code in ${declKind} ${declRef}.
- If the docstring is up to date, return /NO/. It's ok to leave it as is.
- do not rephrase an existing sentence if it is correct.
- Make sure parameters are documented.
- Do NOT include types, this is for TypeScript.
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
  }
}

export const typescriptOps = new Typescript();
