declare module 'tree-sitter' {
  export default class Parser {
    setLanguage(language: any): void;
    parse(input: string): Tree;
  }

  export interface Tree {
    rootNode: SyntaxNode;
  }

  export interface SyntaxNode {
    type: string;
    text: string;
    startPosition: Point;
    endPosition: Point;
    children: SyntaxNode[];
    child(index: number): SyntaxNode | null;
    namedChildren: SyntaxNode[];
    childCount: number;
    namedChildCount: number;
    parent: SyntaxNode | null;
    walk(): TreeCursor;
  }

  export interface Point {
    row: number;
    column: number;
  }

  export interface TreeCursor {
    nodeType: string;
    nodeText: string;
    nodeIsNamed: boolean;
    startPosition: Point;
    endPosition: Point;
    currentNode(): SyntaxNode;
    gotoParent(): boolean;
    gotoFirstChild(): boolean;
    gotoNextSibling(): boolean;
  }
}

declare module 'tree-sitter-typescript' {
  export const typescript: any;
  export const tsx: any;
}
