export type EntityKind =
  | "module"
  | "type"
  | "function"
  | "property"
  | "variable";

export interface LanguageOps {
  getCommentableNodesMatcher: (
    entityKinds: EntityKind[],
    withComments: boolean,
    exportsOnly: boolean
  ) => SgRule;

  /** Given a commentable node which already has a doc comment, find the range of comment nodes */
  getCommentNodes: (decl: SgNode) => SgNode[] | null;

  /** Given a commentable node without a doc comment, find the node where we insert the comment */
  getCommentInsertionNode: (node: SgNode) => SgNode;

  /** Given a string of documentation, return the text to insert as a comment */
  getCommentText: (docs: string) => string;

  getLanguageSystemPromptName: () => string;

  addUpdateDocPrompt: (
    _: ChatGenerationContext,
    declKind: any,
    declRef: string
  ) => PromptTemplateString;

  addGenerateDocPrompt: (
    _: ChatGenerationContext,
    declKind: string,
    declRef: string,
    fileRef: string
  ) => PromptTemplateString;
}
