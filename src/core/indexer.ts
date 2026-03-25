import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { ChromaClient, Collection } from 'chromadb';
// Import a lightweight embedding function from chromadb-default-embed if possible,
// or we can use OpenAI via Langchain later. 
// For now, let's setup the structure.

interface FileCache {
  [filePath: string]: string; // path -> hash
}

export class Indexer {
  private client: ChromaClient;
  private collectionName = 'sourcecode_embeddings';
  private cachePath: string;
  private cache: FileCache = {};
  private collection: Collection | null = null;
  private targetDir: string;

  constructor(targetDir: string) {
    this.targetDir = targetDir;
    const hash = crypto.createHash('md5').update(targetDir).digest('hex');
    this.collectionName = `repo_${hash}`;
    this.client = new ChromaClient({ path: "http://localhost:8000" }); // Assuming a local chromadb server or in-memory
    this.cachePath = path.join(targetDir, '.sourcecode_cache.json');
    this.loadCache();
  }

  public async init() {
    try {
      // Create or get collection. We'll use a basic built-in embedding for now if supported.
      this.collection = await this.client.getOrCreateCollection({
        name: this.collectionName,
      });
      console.log(`Connected to ChromaDB collection: ${this.collectionName}`);
    } catch (error) {
      console.warn("Could not connect to ChromaDB. Ensure it is running or you are using correct settings.", error);
    }
  }

  private loadCache() {
    if (fs.existsSync(this.cachePath)) {
      try {
        const data = fs.readFileSync(this.cachePath, 'utf-8');
        this.cache = JSON.parse(data);
      } catch (e) {
         this.cache = {};
      }
    }
  }

  private saveCache() {
    fs.writeFileSync(this.cachePath, JSON.stringify(this.cache, null, 2), 'utf-8');
  }

  private computeHash(filePath: string): string {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
  }

  /**
   * Checks if a file has changed based on its hash.
   */
  public hasChanged(filePath: string): boolean {
    const currentHash = this.computeHash(filePath);
    const relativePath = path.relative(this.targetDir, filePath);
    
    if (this.cache[relativePath] !== currentHash) {
      this.cache[relativePath] = currentHash;
      return true; // File changed or is new
    }
    return false; // File is unchanged
  }

  /**
   * Searches the vector database for relevant code snippets.
   */
  public async search(query: string, limit = 5): Promise<{content: string, metadata: any}[]> {
    if (!this.collection) return [];
    
    try {
      const results = await this.collection.query({
        queryTexts: [query],
        nResults: limit
      });

      const formattedResults = [];
      if (results.documents && results.documents[0]) {
        for (let i = 0; i < results.documents[0].length; i++) {
            formattedResults.push({
                content: results.documents[0][i] as string,
                metadata: results.metadatas ? results.metadatas[0][i] : {}
            })
        }
      }
      return formattedResults;
    } catch (e) {
      console.error("Error searching ChromaDB", e);
      return [];
    }
  }

  /**
   * Adds or updates a document in the vector database.
   * Note: In a real app, you'd chunk the file content first.
   */
  public async indexFile(filePath: string, content: string, metadata: any) {
    if (!this.collection) return;

    const relativePath = path.relative(this.targetDir, filePath);
    
    // Simple chunking (for demonstration, just using the whole file if small, or splitting by lines)
    // Here we'll just index the whole file for simplicity in this skeleton.
    
    try {
      await this.collection.upsert({
        ids: [relativePath],
        documents: [content],
        metadatas: [{ source: relativePath, ...metadata }]
      });
    } catch (err) {
       console.error(`Failed to index ${relativePath}`, err);
    }
  }

  /**
   * Finalizes the indexing process by saving the cache.
   */
  public finish() {
    this.saveCache();
  }
}
