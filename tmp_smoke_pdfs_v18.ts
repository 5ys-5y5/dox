import fs from 'node:fs/promises';
import { TemplateExtractVersionService } from './src/services/templateExtractVersionService';

const files = [
  '작업지시서_대구침산더샵.pdf',
  '작업지시서_부전마산2공구.pdf',
  '작업지시서_사일동 주상복합.pdf',
];

for (const fileName of files) {
  const bytes = await fs.readFile(`./docs/${fileName}`);
  const source = await TemplateExtractVersionService.resolveUploadSource(fileName, 'application/pdf', bytes, '18');
  const matched = source.sourceContent.match(/data-template-clone="([^"]+)"/);
  console.log(`${fileName} -> ${matched?.[1] || 'unknown'}`);
}
