import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const PDF_RENDER_SCRIPT = `import Foundation
import PDFKit
import AppKit

let args = CommandLine.arguments

guard args.count >= 2 else {
  fputs("missing pdf path\\n", stderr)
  exit(2)
}

let pdfUrl = URL(fileURLWithPath: args[1])

guard let document = PDFDocument(url: pdfUrl) else {
  fputs("pdf open failed\\n", stderr)
  exit(3)
}

struct Output: Codable {
  let pageImages: [String]
}

var pageImages: [String] = []

for pageIndex in 0..<document.pageCount {
  guard let page = document.page(at: pageIndex) else {
    continue
  }

  let pageBounds = page.bounds(for: .mediaBox)
  let scale: CGFloat = 2.0
  let imageSize = NSSize(width: max(pageBounds.width * scale, 1), height: max(pageBounds.height * scale, 1))
  let image = NSImage(size: imageSize)

  image.lockFocusFlipped(false)
  guard let context = NSGraphicsContext.current?.cgContext else {
    image.unlockFocus()
    continue
  }

  NSColor.white.setFill()
  context.fill(CGRect(origin: .zero, size: CGSize(width: imageSize.width, height: imageSize.height)))
  context.saveGState()
  context.scaleBy(x: scale, y: scale)
  context.translateBy(x: 0, y: pageBounds.height)
  context.scaleBy(x: 1, y: -1)
  page.draw(with: .mediaBox, to: context)
  context.restoreGState()
  image.unlockFocus()

  guard let tiffData = image.tiffRepresentation,
        let bitmap = NSBitmapImageRep(data: tiffData),
        let pngData = bitmap.representation(using: .png, properties: [:]) else {
    continue
  }

  pageImages.append("data:image/png;base64," + pngData.base64EncodedString())
}

let encoder = JSONEncoder()
encoder.outputFormatting = [.prettyPrinted]
let output = Output(pageImages: pageImages)
let data = try encoder.encode(output)
print(String(data: data, encoding: .utf8) ?? "{}")
`;

export const TemplateExtractPdfRenderService = {
  async renderPageImages(fileName: string, bytes: Uint8Array): Promise<string[]> {
    const tempDir = await mkdtemp(join(tmpdir(), 'template-extract-pdf-render-'));
    const tempFilePath = join(tempDir, fileName || 'upload.pdf');
    const tempScriptPath = join(tempDir, 'render-pdf-pages.swift');

    try {
      await writeFile(tempFilePath, bytes);
      await writeFile(tempScriptPath, PDF_RENDER_SCRIPT);

      const { stdout } = await execFileAsync('swift', [tempScriptPath, tempFilePath], {
        maxBuffer: 64 * 1024 * 1024,
        encoding: 'utf8',
        env: {
          ...process.env,
          TMPDIR: tempDir,
          SWIFT_MODULECACHE_PATH: tempDir,
          CLANG_MODULE_CACHE_PATH: tempDir,
        },
      });

      const parsed = JSON.parse(stdout) as { pageImages?: string[] };
      return Array.isArray(parsed.pageImages) ? parsed.pageImages : [];
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  },
};
