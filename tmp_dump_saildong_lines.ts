import fs from 'node:fs/promises';
import { extractPdfLayoutModel } from './src/services/templateExtractPdfService';

const fileName = '작업지시서_사일동 주상복합.pdf';
const bytes = await fs.readFile(`./docs/${fileName}`);
const layout = await extractPdfLayoutModel(fileName, bytes);
for (const line of layout.pages[0].lines) {
  console.log(JSON.stringify({text: line.text, x: Number(line.x.toFixed(2)), y: Number(line.y.toFixed(2)), w: Number(line.width.toFixed(2)), h: Number(line.height.toFixed(2))}));
}
