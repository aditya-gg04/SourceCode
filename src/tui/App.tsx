import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { RepoManager } from '../core/repoManager.js';
import { Indexer } from '../core/indexer.js';
import { Analyzer, AnalysisResult } from '../core/analyzer.js';
import { AIClient } from '../core/aiClient.js';

type AppProps = {
  repositoryPath?: string;
};

export default function App({ repositoryPath = '.' }: AppProps) {
  const [status, setStatus] = useState<string>('Initializing...');
  const [files, setFiles] = useState<string[]>([]);
  
  // Selection state
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [aiExplanation, setAiExplanation] = useState<string>('');
  
  // Mode state
  const [mode, setMode] = useState<'tree' | 'search'>('tree');
  const [query, setQuery] = useState('');
  const [searchResult, setSearchResult] = useState('');

  // Services
  const [analyzer, setAnalyzer] = useState<Analyzer | null>(null);
  const [aiClient, setAiClient] = useState<AIClient | null>(null);

  useEffect(() => {
    async function loadWorkspace() {
      try {
        setStatus(`Setting up workspace at ${repositoryPath}...`);
        const repoManager = new RepoManager(repositoryPath);
        const targetDir = await repoManager.setup(repositoryPath);
        
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
            // For a real app, read content:
            // const content = fs.readFileSync(file, 'utf-8');
            // await indexer.indexFile(file, content, { type: 'source' });
            count++;
            setStatus(`Indexing: ${count}/${sourceFiles.length} (Changed files)`);
          }
        }
        indexer.finish();
        
        setStatus('Ready. Press Tab to switch between File Tree and Search. Use Up/Down to navigate files. Press E to explain file.');
        if (sourceFiles.length > 0) {
            setAnalysis(azer.analyzeFile(sourceFiles[0]));
        }

      } catch (err: any) {
        setStatus(`Error: ${err.message}`);
      }
    }

    loadWorkspace();
  }, [repositoryPath]);

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
    }

    if (key.tab) {
        setMode(mode === 'tree' ? 'search' : 'tree');
    }
  });

  // Update analysis when selection changes
  useEffect(() => {
    if (analyzer && files.length > 0 && files[selectedIndex]) {
      setAnalysis(analyzer.analyzeFile(files[selectedIndex]));
      setAiExplanation(''); // clear previous explanation
    }
  }, [selectedIndex, files, analyzer]);

  const explainCurrentFile = async () => {
    if (!aiClient || !files[selectedIndex]) return;
    setStatus('Generating AI explanation...');
    const result = await aiClient.explainFile(files[selectedIndex], "// code placeholder", analysis);
    setAiExplanation(result);
    setStatus('Ready. Press Tab to switch to search. Press E to explain file.');
  };

  const submitSearch = async (q: string) => {
    if (!aiClient || !q) return;
    setStatus('Querying AI codebase search...');
    setSearchResult('');
    const result = await aiClient.queryCodebase(q);
    setSearchResult(result);
    setStatus('Ready. Press Tab to switch between File Tree and Search. Press E to explain file.');
  };

  const selectedFile = files[selectedIndex];
  
  // Calculate which part of the file list to show (scroll window)
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

      <Box flexDirection="row" flexGrow={1}>
        {/* Left Panel: File Tree */}
        <Box borderStyle={mode === 'tree' ? 'double' : 'round'} borderColor={mode === 'tree' ? 'yellow' : 'blue'} width="30%" flexDirection="column" padding={1}>
          <Text bold color="blue">File Tree ({files.length} files)</Text>
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

        {/* Right Panel: Context & Analysis */}
        <Box borderStyle="round" borderColor="magenta" width="70%" flexDirection="column" padding={1}>
           <Text bold color="magenta">Context Panel</Text>
           {selectedFile ? (
               <Box flexDirection="column" marginTop={1}>
                   <Text>Selected: <Text color="cyan">{selectedFile}</Text></Text>
                   
                   {aiExplanation ? (
                     <Box marginTop={1} flexDirection="column">
                        <Text bold color="green">AI Explanation:</Text>
                        <Text>{aiExplanation}</Text>
                     </Box>
                   ) : analysis && (
                       <Box flexDirection="column" marginTop={1}>
                           <Text bold>Entities found ({analysis.entities.length}):</Text>
                           {analysis.entities.slice(0, 7).map((e, idx) => (
                               <Text key={idx}>{e.type}: {e.name} (Lines {e.startLine}-{e.endLine})</Text>
                           ))}
                           {analysis.entities.length > 7 && <Text color="gray">...and {analysis.entities.length - 7} more. Press 'e' for AI analysis.</Text>}
                       </Box>
                   )}
               </Box>
           ) : (
               <Text>No file selected.</Text>
           )}
        </Box>
      </Box>

      {/* Footer / Query Input */}
      <Box borderStyle={mode === 'search' ? 'double' : 'round'} borderColor={mode === 'search' ? 'cyan' : 'gray'} padding={1} flexDirection="column">
        <Box flexDirection="row">
          <Text color="cyan" bold>Query &gt; </Text>
          {mode === 'search' ? (
             <TextInput 
               value={query} 
               onChange={setQuery} 
               onSubmit={submitSearch}
               placeholder="Ask a question about the code..." 
             />
          ) : (
             <Text color="gray">{query || "Press Tab to search..."}</Text>
          )}
        </Box>
        {searchResult && (
           <Box marginTop={1}>
             <Text color="magenta">{searchResult}</Text>
           </Box>
        )}
      </Box>
    </Box>
  );
}
