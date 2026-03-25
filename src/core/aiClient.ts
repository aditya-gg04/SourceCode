import { ChatOllama } from "@langchain/ollama";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { Indexer } from "./indexer.js";

export class AIClient {
  private llm: ChatOllama;
  private indexer: Indexer;

  constructor(indexer: Indexer) {
    // Requires a local Ollama server running. E.g., `ollama run llama3`
    this.llm = new ChatOllama({
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
      return "Error generating explanation. Ensure Ollama is running and 'llama3' is pulled.";
    }
  }

  /**
   * Performs semantic search and optionally asks the LLM a question based on results and current file.
   */
  public async queryCodebase(query: string, currentFile?: { path: string, content: string }): Promise<string> {
    // 1. Search vector DB
    const searchResults = await this.indexer.search(query, 3);
    
    if ((!searchResults || searchResults.length === 0) && !currentFile) {
      return "No relevant code found for your query.";
    }

    // 2. Format context
    let context = "";
    if (currentFile) {
      context += `\n====== CURRENTLY SELECTED FILE (${currentFile.path}) ======\n${currentFile.content.slice(0, 3000)}\n=========================================\n`;
    }

    if (searchResults && searchResults.length > 0) {
      context += `\n====== ADDITIONAL SEARCH RESULTS ======\n`;
      searchResults.forEach((res, i) => {
        if (currentFile && res.metadata?.source === currentFile.path) return; // avoid duplicate
        context += `\n--- Result ${i + 1} (${res.metadata?.source || 'unknown'}) ---\n${res.content}\n`;
      });
      context += `=======================================\n`;
    }

    // 3. Ask LLM
    const template = `
You are an expert programming assistant embedded in a code editor. 
The user is asking a question about their codebase.
If they say "this file" or "the file", they are referring to the CURRENTLY SELECTED FILE provided below.
You must prioritize answering their question using the CURRENTLY SELECTED FILE.
If their question requires other files, use the ADDITIONAL SEARCH RESULTS if available.

CODE CONTEXT:
{context}

USER QUESTION: {query}

Provide an EXHAUSTIVE, HIGHLY DETAILED, and step-by-step explanatory answer based ONLY on the provided code context. Break down your reasoning. If you don't know the answer, say so.
Answer:
`;
    const prompt = PromptTemplate.fromTemplate(template);
    const chain = prompt.pipe(this.llm).pipe(new StringOutputParser());

    try {
      return await chain.invoke({ context: context.slice(0, 5000), query });
    } catch (e) {
      console.error("Error querying codebase:", e);
      return "Error generating response. Ensure Ollama is running and 'llama3' is pulled.";
    }
  }
}
