import fs from 'node:fs/promises';
import { TemplateExtractVersionService } from './src/services/templateExtractVersionService';

const fileName = '작업지시서_사일동 주상복합.pdf';
const bytes = await fs.readFile(`./docs/${fileName}`);
const source = await TemplateExtractVersionService.resolveUploadSource(fileName, 'application/pdf', bytes, '17');
await fs.writeFile('/tmp/saildong_v17_output.txt', `${source.sourceKind}\n${source.sourceContent}`);
console.log('written');
