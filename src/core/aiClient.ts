import { Ollama } from "@langchain/ollama";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { Indexer } from "./indexer.js";

export class AIClient {
  private llm: Ollama;
  private indexer: Indexer;

  constructor(indexer: Indexer) {
    // Requires a local Ollama server running. E.g., `ollama run llama3`
    this.llm = new Ollama({
      model: "llama3", // default model, can be configured
      temperature: 0.1,
    });
    this.indexer = indexer;
  }

  /**
   * Generates an explanation for a specific file using the LLM.
   */
  public async explainFile(filePath: string, fileContent: string, astContext: any): Promise<string> {
    const template = `
Explain the purpose of the following file in the architecture.
Focus on:
- main responsibilities
- important functions
- dependencies

File Path: {filePath}

AST Context (Exports/Entities):
{astContext}

Code:
{fileContent}

Explanation:
`;
    const prompt = PromptTemplate.fromTemplate(template);
    const chain = prompt.pipe(this.llm).pipe(new StringOutputParser());

    try {
      return await chain.invoke({
        filePath,
        astContext: JSON.stringify(astContext, null, 2),
        fileContent: fileContent.slice(0, 3000) // basic truncation for context window
      });
    } catch (e) {
      console.error("Error generating explanation:", e);
      return "Error generating explanation. Check your OpenAI API Key.";
    }
  }

  /**
   * Performs semantic search and optionally asks the LLM a question based on results.
   */
  public async queryCodebase(query: string): Promise<string> {
    // 1. Search vector DB
    const searchResults = await this.indexer.search(query, 3);
    
    if (!searchResults || searchResults.length === 0) {
      return "No relevant code found for your query.";
    }

    // 2. Format context
    let context = "";
    searchResults.forEach((res, i) => {
      context += `\n--- Result ${i + 1} (${res.metadata?.source || 'unknown'}) ---\n${res.content}\n`;
    });

    // 3. Ask LLM
    const template = `
Use the following codebase snippets to answer the user's question. If the snippets don't contain the answer, say so.

Code Snippets:
{context}

Question: {query}

Answer:
`;
    const prompt = PromptTemplate.fromTemplate(template);
    const chain = prompt.pipe(this.llm).pipe(new StringOutputParser());

    try {
      return await chain.invoke({ context: context.slice(0, 5000), query });
    } catch (e) {
      console.error("Error querying codebase:", e);
      return "Error generating response. Check your OpenAI API Key.";
    }
  }
}
