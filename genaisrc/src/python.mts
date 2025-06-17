const dbg = host.logger("script:classify");

export function getDeclKindsPython(entityKinds: string[], withDocs: boolean) {
  const declKinds: SgRule = {
    any: [
      entityKinds.includes("function")
        ? { kind: "function_definition" }
        : null,
      //entityKinds.includes("class") ? { kind: "class_definition" } : null,
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
  const docsRule: SgRule = withDocs
    ? withDocstring
    : {
      not: withDocstring,
    };

  return { ...declKinds, ...inside, ...docsRule };
}

export function getDocNodeFromDeclPython(decl: SgNode): SgNode {
    // Find the comment that follows the declaration
    const docstring = decl.find("expression_statement > string");
    if (!docstring) {
      dbg(`no docstring found for %s`, decl.text());
      return decl;
    }
    dbg(`found comment: %s`, docstring.text());
    return docstring;
}

export function docifyPython(docs: string) {
  docs = parsers.unfence(docs, '"');
  if (!/^\s*""".*.*"""$/s.test(docs)) {
    docs = `"""${docs.split(/\r?\n/g).join("\n")}${docs.includes("\n") ? "\n" : ""}"""`;
  }
  return docs;
}

export function getNodeToInsertDocPython(node: SgNode) {
  return node.find({ rule: { kind: "block" } });
}

