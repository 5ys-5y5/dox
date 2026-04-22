import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type {
  TemplateExtractReplicaRenderModel,
  TemplateExtractVisualSimilarityReport,
} from '../lib/templateExtractDtos';

const execFileAsync = promisify(execFile);

const RENDER_MODEL_SCRIPT_PATTERN =
  /<script\b[^>]*data-template-render-model="positioned-v1"[^>]*>([\s\S]*?)<\/script>/i;

const SWIFT_RENDER_AND_MEASURE_SCRIPT = `import Foundation
import AppKit
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

struct CheckboxOption: Codable {
  let label: String
  let checked: Bool
}

struct TextItem: Codable {
  let kind: String
  let left: Double
  let top: Double
  let width: Double
  let height: Double
  let fontSize: Double
  let lineHeight: Double
  let fontWeight: Double
  let text: String?
  let code: String?
  let actor: String?
  let timestamp: String?
  let options: [CheckboxOption]?
}

struct FrameSegment: Codable {
  let orientation: String
  let left: Double
  let top: Double
  let width: Double?
  let height: Double?
}

struct PageModel: Codable {
  let pageNumber: Int
  let width: Double
  let height: Double
  let frameSegments: [FrameSegment]
  let textItems: [TextItem]
}

struct RenderModel: Codable {
  let version: String
  let cloneId: String
  let pageCount: Int
  let pages: [PageModel]
}

struct Input: Codable {
  let renderModel: RenderModel
  let sourcePageImages: [String]
  let tolerancePx: Int
  let minimumPassScore: Double
}

struct PageReport: Codable {
  let pageNumber: Int
  let width: Int
  let height: Int
  let sourceInkPixelCount: Int
  let replicaInkPixelCount: Int
  let unionInkPixelCount: Int
  let overlapInkPixelCount: Int
  let exactOverlapInkPixelCount: Int
  let overlapRatio: Double
  let exactOverlapRatio: Double
  let mismatchRatio: Double
  let notes: [String]
}

struct Report: Codable {
  let measured: Bool
  let measurementMode: String
  let tolerancePx: Int
  let minimumPassScore: Double
  let passed: Bool
  let overallScore: Double
  let measuredAt: String
  let pageCount: Int
  let notes: [String]
  let pageReports: [PageReport]
}

struct Output: Codable {
  let replicaPageImages: [String]
  let report: Report
}

let args = CommandLine.arguments

guard args.count >= 2 else {
  fputs("missing input json path\\n", stderr)
  exit(2)
}

let inputUrl = URL(fileURLWithPath: args[1])
let inputData = try Data(contentsOf: inputUrl)
let input = try JSONDecoder().decode(Input.self, from: inputData)

let scale: CGFloat = 2.0
let ruleColor = NSColor(calibratedRed: 15.0 / 255.0, green: 23.0 / 255.0, blue: 42.0 / 255.0, alpha: 1)
let textColor = NSColor(calibratedRed: 17.0 / 255.0, green: 24.0 / 255.0, blue: 39.0 / 255.0, alpha: 1)
let whiteThreshold: UInt8 = 250
let alphaThreshold: UInt8 = 8

func decodeDataUrl(_ value: String) -> Data? {
  guard let commaIndex = value.firstIndex(of: ",") else {
    return nil
  }

  let base64 = String(value[value.index(after: commaIndex)...])
  return Data(base64Encoded: base64)
}

func makeBitmapContext(width: Int, height: Int) -> CGContext? {
  let colorSpace = CGColorSpaceCreateDeviceRGB()
  return CGContext(
    data: nil,
    width: width,
    height: height,
    bitsPerComponent: 8,
    bytesPerRow: 0,
    space: colorSpace,
    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
  )
}

func encodePngDataUrl(_ image: CGImage) -> String? {
  let pngData = NSMutableData()

  guard let destination = CGImageDestinationCreateWithData(
    pngData,
    UTType.png.identifier as CFString,
    1,
    nil
  ) else {
    return nil
  }

  CGImageDestinationAddImage(destination, image, nil)

  guard CGImageDestinationFinalize(destination) else {
    return nil
  }

  return "data:image/png;base64," + (pngData as Data).base64EncodedString()
}

func loadImage(from dataUrl: String) -> CGImage? {
  guard let data = decodeDataUrl(dataUrl) else {
    return nil
  }

  guard let source = CGImageSourceCreateWithData(data as CFData, nil) else {
    return nil
  }

  return CGImageSourceCreateImageAtIndex(source, 0, nil)
}

func makeFont(size: CGFloat, weight: Double) -> NSFont {
  let systemWeight: NSFont.Weight = weight >= 600 ? .bold : .medium

  if let font = NSFont(name: "Malgun Gothic", size: size) {
    return font
  }

  if let font = NSFont(name: "Apple SD Gothic Neo", size: size) {
    return font
  }

  if let font = NSFont(name: "Helvetica Neue", size: size) {
    return font
  }

  return NSFont.systemFont(ofSize: size, weight: systemWeight)
}

func makeParagraphStyle(alignment: NSTextAlignment) -> NSMutableParagraphStyle {
  let style = NSMutableParagraphStyle()
  style.alignment = alignment
  style.lineBreakMode = .byClipping
  return style
}

func drawString(
  _ value: String,
  in rect: CGRect,
  fontSize: CGFloat,
  fontWeight: Double,
  alignment: NSTextAlignment = .left
) {
  guard !value.isEmpty else {
    return
  }

  let attributes: [NSAttributedString.Key: Any] = [
    .font: makeFont(size: fontSize, weight: fontWeight),
    .foregroundColor: textColor,
    .strokeColor: textColor,
    .strokeWidth: -0.35,
    .paragraphStyle: makeParagraphStyle(alignment: alignment),
  ]
  NSAttributedString(string: value, attributes: attributes).draw(in: rect)
}

func measureStringWidth(_ value: String, fontSize: CGFloat, fontWeight: Double) -> CGFloat {
  let attributes: [NSAttributedString.Key: Any] = [
    .font: makeFont(size: fontSize, weight: fontWeight),
  ]
  return ceil((value as NSString).size(withAttributes: attributes).width)
}

func makeRect(
  pageHeightPx: CGFloat,
  left: Double,
  top: Double,
  width: Double,
  height: Double
) -> CGRect {
  let renderedX = CGFloat(left) * scale
  let renderedYTop = CGFloat(top) * scale
  let renderedWidth = max(1, CGFloat(width) * scale)
  let renderedHeight = max(1, CGFloat(height) * scale)
  return CGRect(
    x: renderedX,
    y: pageHeightPx - renderedYTop - renderedHeight,
    width: renderedWidth,
    height: renderedHeight
  )
}

func drawFrameSegments(_ page: PageModel, in context: CGContext, pageHeightPx: CGFloat) {
  context.saveGState()
  context.setFillColor(ruleColor.cgColor)

  for segment in page.frameSegments {
    if segment.orientation == "h" {
      let rect = makeRect(
        pageHeightPx: pageHeightPx,
        left: segment.left,
        top: segment.top - 0.5,
        width: segment.width ?? 0,
        height: 1.15
      )
      context.fill(rect)
      continue
    }

    let rect = makeRect(
      pageHeightPx: pageHeightPx,
      left: segment.left - 0.5,
      top: segment.top,
      width: 1.15,
      height: segment.height ?? 0
    )
    context.fill(rect)
  }

  context.restoreGState()
}

func drawStatusLine(_ item: TextItem, pageHeightPx: CGFloat) {
  let outerRect = makeRect(
    pageHeightPx: pageHeightPx,
    left: item.left,
    top: item.top,
    width: item.width,
    height: item.height
  )
  let fontSize = CGFloat(item.fontSize) * scale
  let gap = CGFloat(6) * scale
  let code = item.code ?? ""
  let actor = item.actor ?? ""
  let timestamp = item.timestamp ?? ""
  let codeWidth = max(CGFloat(24) * scale, measureStringWidth(code, fontSize: fontSize, fontWeight: item.fontWeight) + 2)
  let timeWidth = measureStringWidth(timestamp, fontSize: fontSize, fontWeight: item.fontWeight) + 4
  let codeRect = CGRect(x: outerRect.minX, y: outerRect.minY, width: codeWidth, height: outerRect.height)
  let timeRect = CGRect(
    x: max(outerRect.minX, outerRect.maxX - timeWidth),
    y: outerRect.minY,
    width: timeWidth,
    height: outerRect.height
  )
  let actorRect = CGRect(
    x: codeRect.maxX + gap,
    y: outerRect.minY,
    width: max(1, timeRect.minX - codeRect.maxX - gap * 2),
    height: outerRect.height
  )

  drawString(code, in: codeRect, fontSize: fontSize, fontWeight: item.fontWeight, alignment: .left)
  drawString(actor, in: actorRect, fontSize: fontSize, fontWeight: item.fontWeight, alignment: .center)
  drawString(timestamp, in: timeRect, fontSize: fontSize, fontWeight: item.fontWeight, alignment: .right)
}

func drawStatusOptions(_ item: TextItem, pageHeightPx: CGFloat, in context: CGContext) {
  let outerRect = makeRect(
    pageHeightPx: pageHeightPx,
    left: item.left,
    top: item.top,
    width: item.width,
    height: item.height
  )
  let fontSize = CGFloat(item.fontSize) * scale
  let optionGap = CGFloat(8) * scale
  let checkboxGap = CGFloat(3) * scale
  let checkboxSize = CGFloat(9) * scale
  var cursorX = outerRect.minX
  let options = item.options ?? []

  for option in options {
    let labelWidth = measureStringWidth(option.label, fontSize: fontSize, fontWeight: item.fontWeight)
    let checkboxRect = CGRect(
      x: cursorX,
      y: outerRect.midY - checkboxSize / 2,
      width: checkboxSize,
      height: checkboxSize
    )
    context.saveGState()
    context.setStrokeColor(textColor.cgColor)
    context.setLineWidth(max(1, scale))
    context.stroke(checkboxRect)

    if option.checked {
      let innerRect = checkboxRect.insetBy(dx: scale * 2, dy: scale * 2)
      context.setFillColor(textColor.cgColor)
      context.fill(innerRect)
    }

    context.restoreGState()

    let labelRect = CGRect(
      x: checkboxRect.maxX + checkboxGap,
      y: outerRect.minY,
      width: labelWidth + 2,
      height: outerRect.height
    )
    drawString(option.label, in: labelRect, fontSize: fontSize, fontWeight: item.fontWeight, alignment: .left)
    cursorX = labelRect.maxX + optionGap
  }
}

func renderReplicaPage(_ page: PageModel) -> CGImage? {
  let renderedWidth = max(Int((CGFloat(page.width) * scale).rounded(.up)), 1)
  let renderedHeight = max(Int((CGFloat(page.height) * scale).rounded(.up)), 1)

  guard let context = makeBitmapContext(width: renderedWidth, height: renderedHeight) else {
    return nil
  }

  context.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1))
  context.fill(CGRect(x: 0, y: 0, width: renderedWidth, height: renderedHeight))

  drawFrameSegments(page, in: context, pageHeightPx: CGFloat(renderedHeight))

  NSGraphicsContext.saveGraphicsState()
  NSGraphicsContext.current = NSGraphicsContext(cgContext: context, flipped: false)

  for item in page.textItems {
    switch item.kind {
    case "status_line":
      drawStatusLine(item, pageHeightPx: CGFloat(renderedHeight))
    case "status_options":
      drawStatusOptions(item, pageHeightPx: CGFloat(renderedHeight), in: context)
    default:
      let rect = makeRect(
        pageHeightPx: CGFloat(renderedHeight),
        left: item.left,
        top: item.top,
        width: item.width,
        height: item.height
      )
      drawString(item.text ?? "", in: rect, fontSize: CGFloat(item.fontSize) * scale, fontWeight: item.fontWeight, alignment: .left)
    }
  }

  NSGraphicsContext.restoreGraphicsState()
  return context.makeImage()
}

func buildInkMask(_ image: CGImage) -> [UInt8] {
  let width = image.width
  let height = image.height

  guard let context = makeBitmapContext(width: width, height: height) else {
    return []
  }

  context.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1))
  context.fill(CGRect(x: 0, y: 0, width: width, height: height))
  context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))

  guard let rawData = context.data else {
    return []
  }

  let pointer = rawData.assumingMemoryBound(to: UInt8.self)
  let bytesPerRow = context.bytesPerRow
  var mask = Array(repeating: UInt8(0), count: width * height)

  for y in 0..<height {
    for x in 0..<width {
      let offset = y * bytesPerRow + x * 4
      let alpha = pointer[offset + 3]

      if alpha < alphaThreshold {
        continue
      }

      let red = pointer[offset]
      let green = pointer[offset + 1]
      let blue = pointer[offset + 2]

      if red < whiteThreshold || green < whiteThreshold || blue < whiteThreshold {
        mask[y * width + x] = 1
      }
    }
  }

  return mask
}

func dilateMask(_ mask: [UInt8], width: Int, height: Int, radius: Int) -> [UInt8] {
  var dilated = Array(repeating: UInt8(0), count: mask.count)

  for y in 0..<height {
    for x in 0..<width {
      let index = y * width + x

      if mask[index] != 1 {
        continue
      }

      for deltaY in -radius...radius {
        let nextY = y + deltaY

        if nextY < 0 || nextY >= height {
          continue
        }

        for deltaX in -radius...radius {
          let nextX = x + deltaX

          if nextX < 0 || nextX >= width {
            continue
          }

          dilated[nextY * width + nextX] = 1
        }
      }
    }
  }

  return dilated
}

func compareMasks(sourceMask: [UInt8], replicaMask: [UInt8], width: Int, height: Int, tolerancePx: Int) -> (
  sourceInkPixelCount: Int,
  replicaInkPixelCount: Int,
  unionInkPixelCount: Int,
  overlapInkPixelCount: Int,
  exactOverlapInkPixelCount: Int,
  overlapRatio: Double,
  exactOverlapRatio: Double
) {
  let sourceDilated = dilateMask(sourceMask, width: width, height: height, radius: tolerancePx)
  let replicaDilated = dilateMask(replicaMask, width: width, height: height, radius: tolerancePx)
  var sourceInkPixelCount = 0
  var replicaInkPixelCount = 0
  var unionInkPixelCount = 0
  var overlapInkPixelCountFromSource = 0
  var overlapInkPixelCountFromReplica = 0
  var exactOverlapInkPixelCount = 0

  for index in 0..<sourceMask.count {
    let sourceInk = sourceMask[index] == 1
    let replicaInk = replicaMask[index] == 1

    if sourceInk {
      sourceInkPixelCount += 1
    }

    if replicaInk {
      replicaInkPixelCount += 1
    }

    if sourceInk || replicaInk {
      unionInkPixelCount += 1
    }

    if sourceInk && replicaInk {
      exactOverlapInkPixelCount += 1
    }

    if sourceInk && replicaDilated[index] == 1 {
      overlapInkPixelCountFromSource += 1
    }

    if replicaInk && sourceDilated[index] == 1 {
      overlapInkPixelCountFromReplica += 1
    }
  }

  let overlapInkPixelCount = min(
    unionInkPixelCount,
    Int(round(Double(overlapInkPixelCountFromSource + overlapInkPixelCountFromReplica) / 2.0))
  )
  let overlapRatio = unionInkPixelCount > 0 ? Double(overlapInkPixelCount) / Double(unionInkPixelCount) : 1
  let exactOverlapRatio = unionInkPixelCount > 0 ? Double(exactOverlapInkPixelCount) / Double(unionInkPixelCount) : 1

  return (
    sourceInkPixelCount,
    replicaInkPixelCount,
    unionInkPixelCount,
    overlapInkPixelCount,
    exactOverlapInkPixelCount,
    overlapRatio,
    exactOverlapRatio
  )
}

var replicaPageImages: [String] = []
var pageReports: [PageReport] = []
var totalUnionInkPixelCount = 0
var totalOverlapInkPixelCount = 0

for index in 0..<max(input.renderModel.pages.count, input.sourcePageImages.count) {
  let pageNumber = index + 1
  let pageModel = index < input.renderModel.pages.count ? input.renderModel.pages[index] : nil
  let sourceImage = index < input.sourcePageImages.count ? loadImage(from: input.sourcePageImages[index]) : nil
  let replicaImage = pageModel.flatMap(renderReplicaPage)

  if let replicaImage, let dataUrl = encodePngDataUrl(replicaImage) {
    replicaPageImages.append(dataUrl)
  }

  guard let sourceImage, let replicaImage else {
    let width = replicaImage?.width ?? sourceImage?.width ?? 0
    let height = replicaImage?.height ?? sourceImage?.height ?? 0
    let sourceInkPixelCount = sourceImage.map { buildInkMask($0).reduce(0) { $0 + Int($1) } } ?? 0
    let replicaInkPixelCount = replicaImage.map { buildInkMask($0).reduce(0) { $0 + Int($1) } } ?? 0
    let unionInkPixelCount = max(sourceInkPixelCount, replicaInkPixelCount)
    pageReports.append(
      PageReport(
        pageNumber: pageNumber,
        width: width,
        height: height,
        sourceInkPixelCount: sourceInkPixelCount,
        replicaInkPixelCount: replicaInkPixelCount,
        unionInkPixelCount: unionInkPixelCount,
        overlapInkPixelCount: 0,
        exactOverlapInkPixelCount: 0,
        overlapRatio: unionInkPixelCount > 0 ? 0 : 1,
        exactOverlapRatio: unionInkPixelCount > 0 ? 0 : 1,
        mismatchRatio: unionInkPixelCount > 0 ? 1 : 0,
        notes: [sourceImage == nil ? "source_page_missing" : "replica_page_missing"]
      )
    )
    totalUnionInkPixelCount += unionInkPixelCount
    continue
  }

  let width = replicaImage.width
  let height = replicaImage.height
  let sourceMask = buildInkMask(sourceImage)
  let replicaMask = buildInkMask(replicaImage)
  let compared = compareMasks(sourceMask: sourceMask, replicaMask: replicaMask, width: width, height: height, tolerancePx: input.tolerancePx)
  pageReports.append(
    PageReport(
      pageNumber: pageNumber,
      width: width,
      height: height,
      sourceInkPixelCount: compared.sourceInkPixelCount,
      replicaInkPixelCount: compared.replicaInkPixelCount,
      unionInkPixelCount: compared.unionInkPixelCount,
      overlapInkPixelCount: compared.overlapInkPixelCount,
      exactOverlapInkPixelCount: compared.exactOverlapInkPixelCount,
      overlapRatio: compared.overlapRatio,
      exactOverlapRatio: compared.exactOverlapRatio,
      mismatchRatio: compared.unionInkPixelCount > 0 ? 1 - compared.overlapRatio : 0,
      notes: ["replica_render_mode:server_swift_template_render"]
    )
  )
  totalUnionInkPixelCount += compared.unionInkPixelCount
  totalOverlapInkPixelCount += compared.overlapInkPixelCount
}

let overallScore = totalUnionInkPixelCount > 0 ? Double(totalOverlapInkPixelCount) / Double(totalUnionInkPixelCount) : 1
let report = Report(
  measured: true,
  measurementMode: "server_swift_template_render",
  tolerancePx: input.tolerancePx,
  minimumPassScore: input.minimumPassScore,
  passed: overallScore >= input.minimumPassScore,
  overallScore: overallScore,
  measuredAt: ISO8601DateFormatter().string(from: Date()),
  pageCount: pageReports.count,
  notes: ["render_model_version:\\(input.renderModel.version)", "clone_id:\\(input.renderModel.cloneId)"],
  pageReports: pageReports
)

let output = Output(replicaPageImages: replicaPageImages, report: report)
let data = try JSONEncoder().encode(output)
print(String(data: data, encoding: .utf8) ?? "{}")
`;

const buildSwiftExecutionEnv = (tempDir: string) => ({
  ...process.env,
  TMPDIR: tempDir,
  SWIFT_MODULECACHE_PATH: tempDir,
  CLANG_MODULE_CACHE_PATH: tempDir,
});

const parseReplicaRenderModel = (html: string): TemplateExtractReplicaRenderModel | null => {
  const matched = String(html || '').match(RENDER_MODEL_SCRIPT_PATTERN);

  if (!matched?.[1]) {
    return null;
  }

  try {
    return JSON.parse(matched[1]) as TemplateExtractReplicaRenderModel;
  } catch {
    return null;
  }
};

export type TemplateExtractReplicaRenderMeasurementResult = {
  replicaPageImages: string[];
  visualSimilarityReport: TemplateExtractVisualSimilarityReport;
};

export const TemplateExtractReplicaRenderService = {
  extractRenderModelFromHtml(html: string) {
    return parseReplicaRenderModel(html);
  },

  async measureVisualSimilarity(
    html: string,
    sourcePageImages: string[],
    options: {
      tolerancePx?: number;
      minimumPassScore?: number;
    } = {}
  ): Promise<TemplateExtractReplicaRenderMeasurementResult> {
    const renderModel = parseReplicaRenderModel(html);

    if (!renderModel) {
      throw new Error('시각 유사도 측정 실패: output HTML 안에 data-template-render-model 이 없습니다.');
    }

    const tolerancePx = Number.isFinite(options.tolerancePx) ? Math.max(0, Math.trunc(options.tolerancePx as number)) : 1;
    const minimumPassScore = Number.isFinite(options.minimumPassScore)
      ? Math.max(0, Math.min(1, Number(options.minimumPassScore)))
      : 0.95;
    const tempDir = await mkdtemp(join(tmpdir(), 'template-extract-replica-measure-'));
    const inputFilePath = join(tempDir, 'replica-measure-input.json');
    const scriptFilePath = join(tempDir, 'replica-measure.swift');

    try {
      await writeFile(
        inputFilePath,
        JSON.stringify(
          {
            renderModel,
            sourcePageImages,
            tolerancePx,
            minimumPassScore,
          },
          null,
          2
        ),
        'utf8'
      );
      await writeFile(scriptFilePath, SWIFT_RENDER_AND_MEASURE_SCRIPT, 'utf8');

      const { stdout } = await execFileAsync('swift', [scriptFilePath, inputFilePath], {
        maxBuffer: 256 * 1024 * 1024,
        encoding: 'utf8',
        env: buildSwiftExecutionEnv(tempDir),
      });

      const parsed = JSON.parse(stdout) as {
        replicaPageImages?: string[];
        report?: TemplateExtractVisualSimilarityReport;
      };

      if (!parsed?.report) {
        throw new Error('시각 유사도 측정 실패: Swift 측정 결과에 report 가 없습니다.');
      }

      return {
        replicaPageImages: Array.isArray(parsed.replicaPageImages) ? parsed.replicaPageImages : [],
        visualSimilarityReport: parsed.report,
      };
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  },
};
