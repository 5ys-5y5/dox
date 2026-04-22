import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type TemplateExtractPdfMaskVectorRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type TemplateExtractPdfMaskVectorPage = {
  pageNumber: number;
  cssWidth: number;
  cssHeight: number;
  viewBoxWidth: number;
  viewBoxHeight: number;
  inkPixelCount: number;
  rects: TemplateExtractPdfMaskVectorRect[];
};

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

const PDF_MASK_VECTOR_SCRIPT = `import Foundation
import PDFKit
import CoreGraphics

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

let whiteThreshold: UInt8 = 250
let alphaThreshold: UInt8 = 8

struct MaskRect: Codable {
  let x: Int
  let y: Int
  let width: Int
  let height: Int
}

struct PageMask: Codable {
  let pageNumber: Int
  let cssWidth: Double
  let cssHeight: Double
  let viewBoxWidth: Int
  let viewBoxHeight: Int
  let inkPixelCount: Int
  let rects: [MaskRect]
}

struct Output: Codable {
  let pageMasks: [PageMask]
}

func renderPageContext(_ page: PDFPage, bounds: CGRect) -> (CGContext, Int, Int)? {
  let scale: CGFloat = 2.0
  let renderedWidth = max(Int((bounds.width * scale).rounded(.up)), 1)
  let renderedHeight = max(Int((bounds.height * scale).rounded(.up)), 1)
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
    return nil
  }

  context.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1))
  context.fill(CGRect(x: 0, y: 0, width: renderedWidth, height: renderedHeight))
  context.saveGState()
  context.translateBy(x: 0, y: CGFloat(renderedHeight))
  context.scaleBy(x: scale, y: -scale)
  context.scaleBy(x: 1, y: -1)
  context.translateBy(x: 0, y: -bounds.height)
  page.draw(with: .mediaBox, to: context)
  context.restoreGState()

  return (context, renderedWidth, renderedHeight)
}

func isInkPixel(_ pointer: UnsafePointer<UInt8>, offset: Int) -> Bool {
  let alpha = pointer[offset + 3]

  if alpha < alphaThreshold {
    return false
  }

  let red = pointer[offset]
  let green = pointer[offset + 1]
  let blue = pointer[offset + 2]

  return red < whiteThreshold || green < whiteThreshold || blue < whiteThreshold
}

var pageMasks: [PageMask] = []

for pageIndex in 0..<document.pageCount {
  guard let page = document.page(at: pageIndex) else {
    continue
  }

  let pageBounds = page.bounds(for: .mediaBox)

  guard let rendered = renderPageContext(page, bounds: pageBounds) else {
    continue
  }

  let context = rendered.0
  let renderedWidth = rendered.1
  let renderedHeight = rendered.2
  let bytesPerRow = context.bytesPerRow

  guard let rawData = context.data else {
    continue
  }

  let pointer = rawData.assumingMemoryBound(to: UInt8.self)
  var activeRuns: [String: MaskRect] = [:]
  var finalizedRuns: [MaskRect] = []
  var inkPixelCount = 0

  for y in 0..<renderedHeight {
    var nextRuns: [String: MaskRect] = [:]
    var x = 0

    while x < renderedWidth {
      let offset = y * bytesPerRow + x * 4

      if !isInkPixel(pointer, offset: offset) {
        x += 1
        continue
      }

      let start = x
      var cursor = x + 1

      while cursor < renderedWidth {
        let cursorOffset = y * bytesPerRow + cursor * 4

        if !isInkPixel(pointer, offset: cursorOffset) {
          break
        }

        cursor += 1
      }

      let runWidth = cursor - start
      inkPixelCount += runWidth
      let key = "\\(start):\\(runWidth)"

      if var existing = activeRuns[key] {
        existing = MaskRect(x: existing.x, y: existing.y, width: existing.width, height: existing.height + 1)
        nextRuns[key] = existing
      } else {
        nextRuns[key] = MaskRect(x: start, y: y, width: runWidth, height: 1)
      }

      x = cursor
    }

    for (key, rect) in activeRuns where nextRuns[key] == nil {
      finalizedRuns.append(rect)
    }

    activeRuns = nextRuns
  }

  finalizedRuns.append(contentsOf: activeRuns.values)
  finalizedRuns.sort {
    if $0.y == $1.y {
      if $0.x == $1.x {
        if $0.width == $1.width {
          return $0.height < $1.height
        }

        return $0.width < $1.width
      }

      return $0.x < $1.x
    }

    return $0.y < $1.y
  }

  pageMasks.append(
    PageMask(
      pageNumber: pageIndex + 1,
      cssWidth: Double(pageBounds.width),
      cssHeight: Double(pageBounds.height),
      viewBoxWidth: renderedWidth,
      viewBoxHeight: renderedHeight,
      inkPixelCount: inkPixelCount,
      rects: finalizedRuns
    )
  )
}

let encoder = JSONEncoder()
encoder.outputFormatting = [.prettyPrinted]
let output = Output(pageMasks: pageMasks)
let data = try encoder.encode(output)
print(String(data: data, encoding: .utf8) ?? "{}")
`;

const buildSwiftExecutionEnv = (tempDir: string) => ({
  ...process.env,
  TMPDIR: tempDir,
  SWIFT_MODULECACHE_PATH: tempDir,
  CLANG_MODULE_CACHE_PATH: tempDir,
});

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
        env: buildSwiftExecutionEnv(tempDir),
      });

      const parsed = JSON.parse(stdout) as { pageImages?: string[] };
      return Array.isArray(parsed.pageImages) ? parsed.pageImages : [];
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  },

  async renderMaskVectorPages(fileName: string, bytes: Uint8Array): Promise<TemplateExtractPdfMaskVectorPage[]> {
    const tempDir = await mkdtemp(join(tmpdir(), 'template-extract-pdf-mask-'));
    const tempFilePath = join(tempDir, fileName || 'upload.pdf');
    const tempScriptPath = join(tempDir, 'render-pdf-mask.swift');

    try {
      await writeFile(tempFilePath, bytes);
      await writeFile(tempScriptPath, PDF_MASK_VECTOR_SCRIPT);

      const { stdout } = await execFileAsync('swift', [tempScriptPath, tempFilePath], {
        maxBuffer: 256 * 1024 * 1024,
        encoding: 'utf8',
        env: buildSwiftExecutionEnv(tempDir),
      });

      const parsed = JSON.parse(stdout) as { pageMasks?: TemplateExtractPdfMaskVectorPage[] };
      return Array.isArray(parsed.pageMasks) ? parsed.pageMasks : [];
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  },
};
