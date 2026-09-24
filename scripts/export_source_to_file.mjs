import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const ROOT_DIR = process.cwd();

// Files and directories to collect
const targetFiles = [
  'package.json',
  'tsconfig.json',
  'vite.config.ts',
  'server.ts',
  'index.html',
  'metadata.json',
  '.env.example',
  'src/main.tsx',
  'src/App.tsx',
  'src/index.css',
  'src/types/editor.ts',
  'src/types/logs.ts',
  'src/utils/audioEngine.ts',
  'src/utils/videoRenderer.ts',
  'src/utils/subtitleExporter.ts',
  'src/utils/mediaUtils.ts',
  'src/utils/sampleData.ts',
  'src/utils/bookmarklet.ts',
  'src/utils/appDownloader.ts',
  'src/components/Header.tsx',
  'src/components/AssetSidebar.tsx',
  'src/components/CanvasPreview.tsx',
  'src/components/Timeline.tsx',
  'src/components/InspectorPanel.tsx',
  'src/components/MultiChannelAudioMixer.tsx',
  'src/components/VietsubStudioPanel.tsx',
  'src/components/SystemLogsTable.tsx',
  'src/components/ExportModal.tsx',
  'src/components/SettingsModal.tsx',
  'src/components/AiVideoCreationModal.tsx',
  'src/components/AutoTranscriptionModal.tsx',
  'src/components/ExtensionsAndAppsHubModal.tsx',
  'src/components/FullScreenCinemaMode.tsx',
  'src/components/WebVideoSubtitleMode.tsx',
  'src/components/BookmarkletModal.tsx',
  'src/components/BookmarkletView.tsx',
];

// Check if any other files in src exist that we missed
function walkDir(dir) {
  const list = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      list.push(...walkDir(fullPath));
    } else {
      list.push(fullPath);
    }
  }
  return list;
}

const allSrcFiles = walkDir(path.join(ROOT_DIR, 'src'))
  .map(f => path.relative(ROOT_DIR, f))
  .sort();

const allCombinedFiles = Array.from(new Set([...targetFiles, ...allSrcFiles]));

console.log(`Found ${allCombinedFiles.length} files to package into consolidated source export...`);

let exportContent = `================================================================================
CAPCUT PRO STUDIO - COMPLETE SOURCE CODE EXPORT
Generated on: ${new Date().toISOString()}
Total Files: ${allCombinedFiles.length}
Project: Professional Web-Based Video & Vietsub Editor
================================================================================

TABLE OF CONTENTS:
`;

allCombinedFiles.forEach((file, idx) => {
  exportContent += `  [${String(idx + 1).padStart(2, '0')}] ${file}\n`;
});

exportContent += `\n================================================================================\n\n`;

let totalLines = 0;
let totalBytes = 0;

for (const file of allCombinedFiles) {
  const filePath = path.join(ROOT_DIR, file);
  if (!fs.existsSync(filePath)) {
    console.warn(`Warning: File not found: ${file}`);
    continue;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').length;
  const bytes = Buffer.byteLength(content, 'utf-8');
  totalLines += lines;
  totalBytes += bytes;

  exportContent += `\n` +
    `################################################################################\n` +
    `### FILE: ${file}\n` +
    `### LINES: ${lines} | BYTES: ${bytes}\n` +
    `################################################################################\n\n` +
    content +
    `\n\n`;
}

exportContent += `\n================================================================================\n` +
  `END OF SOURCE CODE EXPORT\n` +
  `Summary: ${allCombinedFiles.length} files, ${totalLines} total lines, ${(totalBytes / 1024).toFixed(1)} KB\n` +
  `================================================================================\n`;

// Ensure public directory exists
const publicDir = path.join(ROOT_DIR, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// 1. Write root SOURCE_CODE_EXPORT.txt
fs.writeFileSync(path.join(ROOT_DIR, 'SOURCE_CODE_EXPORT.txt'), exportContent, 'utf-8');
console.log(`✓ Created SOURCE_CODE_EXPORT.txt (${(totalBytes / 1024).toFixed(1)} KB, ${totalLines} lines)`);

// 2. Write public/SOURCE_CODE_EXPORT.txt for instant web download
fs.writeFileSync(path.join(publicDir, 'SOURCE_CODE_EXPORT.txt'), exportContent, 'utf-8');
console.log(`✓ Created public/SOURCE_CODE_EXPORT.txt`);

// 3. Create clean compressed tarball
try {
  // Remove any old tarball in public first to avoid recursion
  const tarPath = path.join(publicDir, 'capcut_pro_studio_source.tar.gz');
  if (fs.existsSync(tarPath)) {
    fs.unlinkSync(tarPath);
  }
  
  execSync(`tar --exclude='node_modules' --exclude='.git' --exclude='dist' --exclude='*.tar.gz' -czvf "${tarPath}" src index.html package.json tsconfig.json vite.config.ts server.ts metadata.json .env.example SOURCE_CODE_EXPORT.txt`, {
    cwd: ROOT_DIR,
    stdio: 'ignore'
  });
  console.log(`✓ Created public/capcut_pro_studio_source.tar.gz`);
} catch (err) {
  console.error('Failed to create tar.gz:', err);
}

console.log('Source code export completed successfully.');
