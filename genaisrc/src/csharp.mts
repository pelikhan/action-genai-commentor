const dbg = host.logger("script:csharp");

import type { EntityKind, LanguageOps } from "./langops.mts";

class CSharp implements LanguageOps {
  getCommentableNodesMatcher(
    entityKinds: EntityKind[],
    withComments: boolean,
    exportsOnly: boolean
  ) {
    const declKindsRaw: SgRule = {
      any: [
        entityKinds.includes("module")
          ? { kind: "namespace_declaration" }
          : null,
        entityKinds.includes("type") ? { kind: "delegate_declaration" } : null,
        entityKinds.includes("type") ? { kind: "struct_declaration" } : null,
        entityKinds.includes("type") ? { kind: "class_declaration" } : null,
        entityKinds.includes("type") ? { kind: "interface_declaration" } : null,
        entityKinds.includes("type") ? { kind: "enum_declaration" } : null,
        entityKinds.includes("property") ? { kind: "field_declaration" } : null,
        entityKinds.includes("property")
          ? { kind: "event_field_declaration" }
          : null,
        entityKinds.includes("property")
          ? { kind: "property_declaration" }
          : null,
        entityKinds.includes("property")
          ? { kind: "indexer_declaration" }
          : null,
        entityKinds.includes("property")
          ? { kind: "enum_member_declaration" }
          : null,
        entityKinds.includes("function")
          ? { kind: "method_declaration" }
          : null,
        entityKinds.includes("function")
          ? { kind: "constructor_declaration" }
          : null,
        entityKinds.includes("function")
          ? { kind: "operator_declaration" }
          : null,
      ].filter(Boolean) as SgRule[],
    };
    // If export only then require an 'export'
    const declKinds: SgRule = {
      any: [
        declKindsRaw,
        // exportsOnly ? { any: [] } : declKindsRaw,
        // {
        //   kind: "export_statement",
        //   has: declKindsRaw,
        // },
      ],
    };
    const inside: SgRule = {
      inside: {
        all: [],
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

  getCommentNodes(node: SgNode) {
    const commentNodes = [];
    while (node && node.prev() && node.prev().kind() === "comment") {
      node = node.prev();
      commentNodes.push(node);
    }
    return commentNodes;
  }

  getCommentInsertionNode(node: SgNode) {
    return node;
  }

  getLanguageSystemPromptName() {
    return "system.csharp";
  }
  getCommentText(docs: string) {
    docs = parsers.unfence(docs, "*");

    docs = `/// ${docs
      .split(/\r?\n/g)
      .map((s) => s.trim())
      .join("/// ")}`;
    return docs;
  }
  addGenerateDocPrompt(
    _: ChatGenerationContext,
    declKind: any,
    declRef: string,
    fileRef: string
  ) {
    return _.$`Generate a C# documentation comment for the ${declKind} ${declRef}.
- Make sure parameters, type parameters, and return types are documented if relevant.
- Be concise. Use a technical tone.
- Do NOT include types, this is for C#.
- Use XML doc syntax.
The full source of the file is in ${fileRef} for reference.`;
  }

  addUpdateDocPrompt(_: ChatGenerationContext, declKind: any, declRef: string) {
    return _.$`Update the C# docstring <DOCSTRING> to match the code in ${declKind} ${declRef}.
- If the docstring is up to date, return /NO/. It's ok to leave it as is.
- do not rephrase an existing sentence if it is correct.
- Make sure parameters are documented.
- Do NOT include types, this is for C#.
- Use docstring syntax. do not wrap in markdown code section.
- Minimize updates to the existing docstring.

The full source of the file is in <FILE> for reference.
The source of the function is in ${declRef}.
The current docstring is <DOCSTRING>.`;
  }
}
export const csharpOps = new CSharp();
