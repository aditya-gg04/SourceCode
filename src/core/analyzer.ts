import fs from 'fs';
import Parser from 'tree-sitter';
import ts from 'tree-sitter-typescript';

export interface CodeEntity {
  name: string;
  type: 'function' | 'class' | 'method';
  startLine: number;
  endLine: number;
}

export interface AnalysisResult {
  imports: string[];
  exports: string[];
  entities: CodeEntity[];
}

export class Analyzer {
  private parser: Parser;

  constructor() {
    this.parser = new Parser();
  }

  /**
   * Parses a TypeScript or TSX file and extracts its symbols and imports.
   */
  public analyzeFile(filePath: string): AnalysisResult | null {
    if (!fs.existsSync(filePath)) return null;

    const code = fs.readFileSync(filePath, 'utf-8');
    
    // Choose appropriate language parser based on extension
    if (filePath.endsWith('.tsx')) {
      this.parser.setLanguage(ts.tsx);
    } else if (filePath.endsWith('.ts') || filePath.endsWith('.js') || filePath.endsWith('.jsx')) {
      this.parser.setLanguage(ts.typescript);
    } else {
      // Return empty if we don't have a parser for this file type yet
      return { imports: [], exports: [], entities: [] };
    }

    const tree = this.parser.parse(code);
    return this.extractInformation(tree.rootNode, code);
  }

  private extractInformation(rootNode: Parser.SyntaxNode, code: string): AnalysisResult {
    const result: AnalysisResult = {
      imports: [],
      exports: [],
      entities: []
    };

    const walk = (node: Parser.SyntaxNode) => {
      // Extract imports
      if (node.type === 'import_statement') {
        const sourceNode = node.namedChildren.find(c => c.type === 'string');
        if (sourceNode) {
          result.imports.push(sourceNode.text.replace(/['"]/g, ''));
        }
      }

      // Extract classes
      if (node.type === 'class_declaration') {
        const nameNode = node.namedChildren.find(c => c.type === 'type_identifier');
        if (nameNode) {
          result.entities.push({
            name: nameNode.text,
            type: 'class',
            startLine: node.startPosition.row + 1,
            endLine: node.endPosition.row + 1
          });
        }
      }

      // Extract functions
      if (node.type === 'function_declaration' || node.type === 'arrow_function' || node.type === 'method_definition') {
        let name = 'anonymous';
        let type: CodeEntity['type'] = node.type === 'method_definition' ? 'method' : 'function';

        const nameNode = node.namedChildren.find(c => c.type === 'identifier' || c.type === 'property_identifier');
        
        if (nameNode) {
          name = nameNode.text;
        } else if (node.parent?.type === 'variable_declarator') {
           const varNameNode = node.parent.namedChildren.find(c => c.type === 'identifier');
           if (varNameNode) name = varNameNode.text;
        }

        result.entities.push({
          name,
          type,
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1
        });
      }

      // Extract exports (very basic)
      if (node.type === 'export_statement') {
         const declaration = node.namedChildren.find(c => c.type.includes('declaration'));
         if (declaration) {
             const nameNode = declaration.namedChildren.find(c => c.type.includes('identifier'));
             if (nameNode) result.exports.push(nameNode.text);
         }
      }

      for (let i = 0; i < node.namedChildCount; i++) {
        const child = node.namedChildren[i];
        if (child) walk(child);
      }
    };

    walk(rootNode);

    return result;
  }
}
