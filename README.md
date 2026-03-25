# SourceCode AI TUI

An AI-powered, interactive terminal user interface (TUI) tool that allows developers to explore and understand large codebases naturally. By combining Abstract Syntax Tree (AST) parsing, Local LLMs (Ollama), and Vector Databases (ChromaDB), `sourcecode` acts as an embedded intelligence tool right in your terminal.

## Key Features

- **Interactive File Explorer:** Navigate through files using keyboard controls.
- **AST Parsing:** Automatically extracts and lists key entities (Hooks, Functions, Classes) natively from your code using `tree-sitter`.
- **Semantic Project Search:** Query the whole codebase using natural language. The internal `ChromaDB` vector search pulls snippet context from across the project.
- **AI File Explanations:** Get highly detailed, exhaustive step-by-step reasoning about any selected file just by pressing a button.
- **GitHub Repository Support:** Analyze any remote GitHub repo by switching to "Repo Mode" and providing a URL. It dynamically clones and swaps the active environment.
- **Three-Panel Layout:** A beautiful, responsive, and completely scrollable custom CLI dashboard built with React and `ink`.
- **Fully Local & Private:** Powered exclusively by local tooling and models like `Ollama`—no API keys required, and your code never leaves your machine!

---

## 🏗️ Architecture Stack

- **CLI Framework:** Commander.js
- **TUI Framework:** Ink (React in the Terminal)
- **Local LLM:** Ollama (`llama3` model via `@langchain/ollama`)
- **Semantic Backend:** ChromaDB
- **Code Parsing:** Tree-Sitter (`tree-sitter-typescript` bindings)

---

## 🛠️ Prerequisites

To run this project, you will need the following dependencies correctly installed and running locally:

1. **Node.js** (v18+)
2. **Ollama:** Installed and running locally.
   - Pull the default model: `ollama run llama3`
3. **ChromaDB:** A local Chroma server must be running.
   - You can quickly run it via docker: `docker run -p 8000:8000 chromadb/chroma` (or native install).

---

## 📦 Installation & Setup

1. **Clone the repository** (if you haven't already):
   ```bash
   git clone https://github.com/aditya-gg04/SourceCode.git
   cd SourceCode
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Build the TypeScript application:**
   ```bash
   npm run build
   ```

---

## 🚀 Usage

Start the TUI by running the `analyze` command. You can pass the path to a local directory or a GitHub URL.

**To analyze the current directory:**
```bash
node dist/index.js analyze .
```

**To analyze a GitHub repository:**
```bash
node dist/index.js analyze https://github.com/facebook/react
```

### Keyboard Navigation & Shortcuts

The application is entirely keyboard-driven:

- **Switching Panels:** Press `Tab` to cycle between:
  1. File Tree
  2. Search Box
  3. Change Repo Path
- **File System Navigation:** When the left-most panel (File Tree) is highlighted (Blue Border), use the `Up` and `Down` arrow keys to highlight different files.
- **File Explanation:** While a file is selected in the File Tree, press the `E` key. The local Llama 3 model will generate an exhaustive explanation of the file's purpose and code flow in the right panel.
- **Scrolling Large Results:** Whenever a long AI explanation or Search Result is shown in the right "AI Answers" column, use the `Up` and `Down` arrow keys to scroll through the text!
- **Semantic Searching:** Press `Tab` until the bottom input says `Ask AI >`. Type a question like *"Where is the user authentication handled?"* and press `Enter`. The local vector database will dynamically search across the code and present a detailed explanation.

---

## Technical Details (Under the Hood)

1. **RepoManager:** Recursively crawls directories, securely ignoring directories like `node_modules`. Handles GitHub clone events natively.
2. **Indexer:** Connects to `http://localhost:8000` (ChromaDB). Hashes local files using `md5` cache files to prevent re-indexing unchanged code. It establishes unique isolated document collections for each unique repository imported.
3. **Analyzer:** Extracts JavaScript and TypeScript Abstract Syntax Trees to provide the Context Panel with a quick breakdown of imported dependencies and declared entities without needing an LLM.
4. **AIClient:** Embeds Langchain's `ChatOllama` templates explicitly formatted for intelligent context injection so the LLM respects your "Currently Selected File" while conducting global codebase queries.
