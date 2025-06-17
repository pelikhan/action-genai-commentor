const dbg = host.logger("script:classify");
export function getDeclKindsTypescript(entityKinds: string[], exportsOnly: boolean, withDocs: boolean) {
  const declKindsRaw: SgRule = {
    any: [
      entityKinds.includes("function")
        ? { kind: "function_declaration" }
        : null,
      entityKinds.includes("class") ? { kind: "class_declaration" } : null,
      entityKinds.includes("interface")
        ? { kind: "interface_declaration" }
        : null,
      entityKinds.includes("typeAlias")
        ? { kind: "type_alias_declaration" }
        : null,
      entityKinds.includes("variable")
        ? { kind: "lexical_declaration" }
        : null,
      entityKinds.includes("enum") ? { kind: "enum_declaration" } : null,
      entityKinds.includes("property")
        ? { kind: "public_field_definition" }
        : null,
      entityKinds.includes("method") ? { kind: "method_definition" } : null,
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
  const docsRule: SgRule = withDocs
    ? withDocComment
    : {
      not: withDocComment,
    };

  return { ...declKinds, ...inside, ...docsRule };
}

export function docifyTypescript(docs: string) {
  docs = parsers.unfence(docs, "*");

  if (!/^\s*\/\*\*.*.*\*\/\s*$/s.test(docs))
    docs = `/**\n* ${docs.split(/\r?\n/g).join("\n* ")}\n*/`;
  return docs;
}

export function getDocNodeFromDeclTypescript(decl: SgNode): SgNode {
    return decl.prev();
}


export function getNodeToInsertDocTypescript(node: SgNode) {
  return node;
}


