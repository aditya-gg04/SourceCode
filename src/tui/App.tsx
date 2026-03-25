import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import fs from 'fs';
import { RepoManager } from '../core/repoManager.js';
import { Indexer } from '../core/indexer.js';
import { Analyzer, AnalysisResult } from '../core/analyzer.js';
import { AIClient } from '../core/aiClient.js';

type AppProps = {
  repositoryPath?: string;
};

export default function App({ repositoryPath = '.' }: AppProps) {
  const [currentRepo, setCurrentRepo] = useState(repositoryPath);
  const [status, setStatus] = useState<string>('Initializing...');
  const [files, setFiles] = useState<string[]>([]);
  
  // Selection state
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  
  // Scroll & Mode state
  const [mode, setMode] = useState<'tree' | 'search' | 'repo'>('tree');
  const [scrollOffset, setScrollOffset] = useState(0);
  const [query, setQuery] = useState('');
  
  // AI Outputs
  const [aiOutput, setAiOutput] = useState('');
  const [aiOutputTitle, setAiOutputTitle] = useState('AI Answers');
  const [repoInput, setRepoInput] = useState('');

  // Services
  const [analyzer, setAnalyzer] = useState<Analyzer | null>(null);
  const [aiClient, setAiClient] = useState<AIClient | null>(null);

  useEffect(() => {
    async function loadWorkspace() {
      try {
        setStatus(`Setting up workspace at ${currentRepo}...`);
        const repoManager = new RepoManager(currentRepo);
        const targetDir = await repoManager.setup(currentRepo);
        
        setStatus(`Scanning files in ${targetDir}...`);
        const sourceFiles = repoManager.getFiles(targetDir);
        setFiles(sourceFiles);
        
        setStatus('Initializing Indexer...');
        const indexer = new Indexer(targetDir);
        await indexer.init();

        const azer = new Analyzer();
        setAnalyzer(azer);
        
        const aClient = new AIClient(indexer);
        setAiClient(aClient);

        setStatus(`Indexing ${sourceFiles.length} files (this might take a moment)...`);
        let count = 0;
        for (const file of sourceFiles) {
          if (indexer.hasChanged(file)) {
            const content = fs.readFileSync(file, 'utf-8');
            await indexer.indexFile(file, content, { type: 'source' });
            count++;
            setStatus(`Indexing: ${count}/${sourceFiles.length} (Changed files)`);
          }
        }
        indexer.finish();
        
        setStatus('Ready. Press Tab to switch panels. Use Up/Down to navigate. E to explain file.');
        if (sourceFiles.length > 0) {
            setSelectedIndex(0);
            setAnalysis(azer.analyzeFile(sourceFiles[0]));
        }
        setAiOutput('');
        setAiOutputTitle('AI Answers');

      } catch (err: any) {
        setStatus(`Error: ${err.message}`);
      }
    }

    loadWorkspace();
  }, [currentRepo]);

  // Reset scroll when switching things
  useEffect(() => {
    setScrollOffset(0);
  }, [selectedIndex, aiOutput, mode]);

  useInput((input, key) => {
    if (mode === 'tree') {
      if (key.upArrow) {
        setSelectedIndex(Math.max(0, selectedIndex - 1));
      }
      if (key.downArrow) {
        setSelectedIndex(Math.min(files.length - 1, selectedIndex + 1));
      }
      // 'e' to explain
      if (input === 'e' && aiClient && files[selectedIndex]) {
        explainCurrentFile();
      }
    } else {
      // In search or repo mode, up/down arrows can scroll the AI Answers panel
      if (key.upArrow) setScrollOffset(Math.max(0, scrollOffset - 1));
      if (key.downArrow) setScrollOffset(scrollOffset + 1);
    }

    if (key.tab) {
        if (mode === 'tree') setMode('search');
        else if (mode === 'search') setMode('repo');
        else setMode('tree');
    }
  });

  // Update analysis when selection changes
  useEffect(() => {
    if (analyzer && files.length > 0 && files[selectedIndex]) {
      setAnalysis(analyzer.analyzeFile(files[selectedIndex]));
      setAiOutput(''); // clear previous explanation
      setAiOutputTitle('AI Answers');
    }
  }, [selectedIndex, files, analyzer]);

  const explainCurrentFile = async () => {
    if (!aiClient || !files[selectedIndex]) return;
    setStatus('Generating AI explanation...');
    setAiOutputTitle('File Explanation');
    setAiOutput('');
    
    let fileContent = '';
    try {
      fileContent = fs.readFileSync(files[selectedIndex], 'utf-8');
    } catch(e) {
      fileContent = '// Error reading file';
    }

    const result = await aiClient.explainFile(files[selectedIndex], fileContent, analysis);
    setAiOutput(result);
    setStatus('Ready. Press Tab to switch panels. Up/Down blocks to scroll AI output.');
  };

  const submitSearch = async (q: string) => {
    if (!aiClient || !q) return;
    setStatus('Querying AI codebase search...');
    setAiOutputTitle('Search Results');
    setAiOutput('');
    
    let currentFileCtx;
    if (files[selectedIndex]) {
      try {
        const content = fs.readFileSync(files[selectedIndex], 'utf-8');
        currentFileCtx = { path: files[selectedIndex], content };
      } catch (e) {
        // ignore read error
      }
    }

    const result = await aiClient.queryCodebase(q, currentFileCtx);
    setAiOutput(result);
    // Stay in search mode to let user scroll results
    setStatus('Ready. Use Up/Down arrows to scroll AI Answers panel.');
  };

  const submitRepo = (r: string) => {
    if (r) {
      setCurrentRepo(r);
      setMode('tree');
      setRepoInput('');
    }
  }

  const renderScrolledText = (text: string) => {
    if (!text) return '';
    const lines = text.split('\n');
    return lines.slice(scrollOffset).join('\n');
  };

  const selectedFile = files[selectedIndex];
  
  const windowSize = 10;
  const startIndex = Math.max(0, Math.min(selectedIndex - Math.floor(windowSize / 2), files.length - windowSize));
  const visibleFiles = files.slice(startIndex, startIndex + windowSize);

  return (
    <Box flexDirection="column" width="100%" height={24}>
      {/* Header */}
      <Box borderStyle="round" borderColor="green" padding={1}>
        <Text color="green" bold>SourceCode AI TUI</Text>
        <Box flexGrow={1} />
        <Text color="gray">{status}</Text>
      </Box>

      <Box flexDirection="row" flexGrow={1} overflowY="hidden">
        {/* Left Panel: File Tree (25%) */}
        <Box borderStyle={mode === 'tree' ? 'double' : 'round'} borderColor={mode === 'tree' ? 'yellow' : 'blue'} width="25%" flexDirection="column" padding={1}>
          <Text bold color="blue">File Tree ({files.length})</Text>
          <Box flexDirection="column" marginTop={1}>
            {visibleFiles.map((f, i) => {
              const actualIndex = startIndex + i;
              const isSelected = actualIndex === selectedIndex;
              return (
                <Text key={actualIndex} color={isSelected ? 'yellow' : 'white'} wrap="truncate">
                  {isSelected ? '> ' : '  '}
                  {f.split('/').pop()}
                </Text>
              )
            })}
          </Box>
        </Box>

        {/* Middle Panel: Context & Analysis (35%) */}
        <Box borderStyle="round" borderColor="cyan" width="35%" flexDirection="column" padding={1} overflowY="hidden">
           <Text bold color="cyan">Code Context</Text>
           {selectedFile ? (
               <Box flexDirection="column" marginTop={1} overflowY="hidden">
                   <Text>Selected: <Text color="cyan" wrap="truncate">{selectedFile}</Text></Text>
                   
                   {analysis && (
                       <Box flexDirection="column" marginTop={1} overflowY="hidden">
                           <Text bold>Entities found ({analysis.entities.length}):</Text>
                           {analysis.entities.slice(0, 7).map((e, idx) => (
                               <Text key={idx} wrap="truncate">{e.type}: {e.name} (Lines {e.startLine}-{e.endLine})</Text>
                           ))}
                           {analysis.entities.length > 7 && <Text color="gray">...and {analysis.entities.length - 7} more.</Text>}
                       </Box>
                   )}
               </Box>
           ) : (
               <Text>No file selected.</Text>
           )}
        </Box>

        {/* Right Panel: AI Answers (40%) */}
        <Box borderStyle="round" borderColor="magenta" width="40%" flexDirection="column" padding={1} overflowY="hidden">
           <Text bold color="magenta">
              {mode !== 'tree' ? `${aiOutputTitle} (Up/Down to scroll)` : aiOutputTitle}
           </Text>
           <Box flexDirection="column" marginTop={1} overflowY="hidden">
               {aiOutput ? (
                 <Text color={mode === 'search' ? 'white' : 'green'}>{renderScrolledText(aiOutput)}</Text>
               ) : (
                 <Text color="gray">Press 'E' to explain selected file, or use the Search Query box below.</Text>
               )}
           </Box>
        </Box>
      </Box>

      {/* Footer / Query Input */}
      <Box borderStyle={mode === 'search' || mode === 'repo' ? 'double' : 'round'} borderColor={mode === 'search' ? 'magenta' : mode === 'repo' ? 'yellow' : 'gray'} padding={1} flexDirection="column">
        {mode === 'repo' ? (
           <Box flexDirection="row">
             <Text color="yellow" bold>Enter Repo Path/URL &gt; </Text>
             <TextInput 
               value={repoInput} 
               onChange={setRepoInput} 
               onSubmit={submitRepo}
               placeholder="e.g. https://github.com/user/project or /path/to/local/dir" 
             />
           </Box>
        ) : (
           <Box flexDirection="row">
             <Text color="magenta" bold>Ask AI &gt; </Text>
             {mode === 'search' ? (
                <TextInput 
                  value={query} 
                  onChange={setQuery} 
                  onSubmit={submitSearch}
                  placeholder="Ask a codebase question..." 
                />
             ) : (
                <Text color="gray">{query || "Press Tab to enter a query or change repo..."}</Text>
             )}
           </Box>
        )}
      </Box>
    </Box>
  );
}
