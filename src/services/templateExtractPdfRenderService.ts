import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const PDF_RENDER_SCRIPT = `import Foundation
import PDFKit
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

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
  let renderedWidth = max(Int((pageBounds.width * scale).rounded(.up)), 1)
  let renderedHeight = max(Int((pageBounds.height * scale).rounded(.up)), 1)
  let colorSpace = CGColorSpaceCreateDeviceRGB()

  guard let context = CGContext(
    data: nil,
    width: renderedWidth,
    height: renderedHeight,
    bitsPerComponent: 8,
    bytesPerRow: 0,
    space: colorSpace,
    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
  ) else {
    continue
  }

  context.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1))
  context.fill(CGRect(x: 0, y: 0, width: renderedWidth, height: renderedHeight))
  context.saveGState()
  context.translateBy(x: 0, y: CGFloat(renderedHeight))
  context.scaleBy(x: scale, y: -scale)
  context.scaleBy(x: 1, y: -1)
  context.translateBy(x: 0, y: -pageBounds.height)
  page.draw(with: .mediaBox, to: context)
  context.restoreGState()

  guard let cgImage = context.makeImage() else {
    continue
  }

  let pngData = NSMutableData()
  guard let destination = CGImageDestinationCreateWithData(
    pngData,
    UTType.png.identifier as CFString,
    1,
    nil
  ) else {
    continue
  }

  CGImageDestinationAddImage(destination, cgImage, nil)

  guard CGImageDestinationFinalize(destination) else {
    continue
  }

  pageImages.append("data:image/png;base64," + (pngData as Data).base64EncodedString())
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
