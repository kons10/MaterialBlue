import fs from 'node:fs';
import path from 'node:path';

const API_KEY = process.env.OPENROUTER_API_KEY;

const FREE_MODELS = [
  'openrouter/free'
];

const TARGET_EXTS = new Set(['.js', '.ts', '.py', '.html', '.css', '.go', '.rs', '.sh']);
const IGNORE_DIRS = new Set(['.git', 'node_modules', '.github', 'dist', 'build', 'public']);

function getAllFiles(dir, fileList = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      getAllFiles(fullPath, fileList);
    } else if (TARGET_EXTS.has(path.extname(entry.name))) {
      fileList.push(fullPath.replace(/\\/g, '/'));
    }
  }
  return fileList;
}

function createBatches(files, maxChars = 15000) {
  const batches = [];
  let currentBatch = '';

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    if (!content.trim() || content.length > maxChars) continue;

    const numbered = content
      .split('\n')
      .map((line, i) => `${i + 1}: ${line}`)
      .join('\n');

    const block = `\n=== FILE: ${file} ===\n${numbered}\n`;

    if (currentBatch.length + block.length > maxChars && currentBatch.length > 0) {
      batches.push(currentBatch);
      currentBatch = block;
    } else {
      currentBatch += block;
    }
  }
  if (currentBatch) batches.push(currentBatch);
  return batches;
}

async function analyzeBatch(batchText) {
  const prompt = `あなたは静的コード解析ツールです。以下の複数ファイルのコードについて、「セキュリティ脆弱性」および「冗長性（未使用変数、重複コード、無意味な処理、消し忘れ）」を検出してください。
問題がなければ [] のみを返してください。Markdownのコードブロックは不要で、純粋なJSON配列のみを出力してください。

出力フォーマット:
[
  {
    "file": "=== FILE: ... === で示された正確なファイルパス",
    "ruleId": "SEC-001 または RED-001",
    "level": "error" | "warning" | "note",
    "line": 該当の開始行番号(数値),
    "message": "問題の内容と修正案（日本語で簡潔に）"
  }
]

対象コード:
${batchText}`;

  for (const model of FREE_MODELS) {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
      }),
    });

    if (res.status === 429 || res.status >= 500) {
      console.warn(`Model ${model} busy (${res.status}), switching fallback...`);
      await new Promise((r) => setTimeout(r, 2000));
      continue;
    }

    if (!res.ok) {
      console.error(`API Error (${model}): ${res.status}`);
      return [];
    }

    const data = await res.json();
    let text = data.choices?.[0]?.message?.content?.trim() || '[]';
    text = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '');

    try {
      const findings = JSON.parse(text);
      return Array.isArray(findings) ? findings : [];
    } catch {
      console.error(`JSON Parse Error with ${model}`);
      return [];
    }
  }
  return [];
}

async function main() {
  const files = getAllFiles('.');
  const batches = createBatches(files);
  const results = [];

  for (let i = 0; i < batches.length; i++) {
    console.log(`Analyzing batch ${i + 1}/${batches.length}...`);
    const findings = await analyzeBatch(batches[i]);

    for (const item of findings) {
      if (!item.file) continue;
      results.push({
        ruleId: item.ruleId || 'AI-REVIEW',
        level: ['error', 'warning', 'note'].includes(item.level) ? item.level : 'warning',
        message: { text: item.message || '改善点が検出されました。' },
        locations: [
          {
            physicalLocation: {
              artifactLocation: { uri: item.file.replace(/^\.\//, '') },
              region: { startLine: Math.max(1, Number(item.line) || 1) },
            },
          },
        ],
      });
    }
    if (i < batches.length - 1) {
      await new Promise((r) => setTimeout(r, 3500));
    }
  }

  const sarif = {
    $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'OpenRouter-AI-Scanner',
            informationUri: 'https://openrouter.ai/',
          },
        },
        results,
      },
    ],
  };

  fs.writeFileSync('ai-results.sarif', JSON.stringify(sarif, null, 2));
  console.log(`Done. Total issues: ${results.length}`);
}

main();
