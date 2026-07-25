import ExpoModulesCore
import ImageIO
import PDFKit
import UIKit

private let maximumNormalizedDimension = 4096
private let maximumCaptureBytes = 25 * 1024 * 1024
private let maximumCapturePages = 50

private final class CaptureInputException: GenericException<String> {
  override var reason: String {
    "Capture processing failed safely: \(param)"
  }
}

public final class LittleArcCaptureProcessorModule: Module {
  public func definition() -> ModuleDefinition {
    Name("LittleArcCaptureProcessor")

    AsyncFunction("processAsync") {
      (
        sourceUri: String,
        outputDirectoryUri: String,
        opaqueBaseName: String,
        thumbnailDimension: Int
      ) -> [String: Any?] in
      try process(
        sourceUri: sourceUri,
        outputDirectoryUri: outputDirectoryUri,
        opaqueBaseName: opaqueBaseName,
        thumbnailDimension: thumbnailDimension
      )
    }
    .runOnQueue(DispatchQueue.global(qos: .userInitiated))
  }

  private func process(
    sourceUri: String,
    outputDirectoryUri: String,
    opaqueBaseName: String,
    thumbnailDimension: Int
  ) throws -> [String: Any?] {
    guard
      opaqueBaseName.range(of: "^[0-9a-fA-F-]{36}$", options: .regularExpression) != nil,
      (64...1024).contains(thumbnailDimension),
      let source = URL(string: sourceUri),
      let outputDirectory = URL(string: outputDirectoryUri),
      source.isFileURL,
      outputDirectory.isFileURL
    else {
      throw CaptureInputException("capture_invalid_metadata")
    }
    do {
      try FileManager.default.createDirectory(
        at: outputDirectory,
        withIntermediateDirectories: true
      )
      let attributes = try FileManager.default.attributesOfItem(atPath: source.path)
      if let size = attributes[.size] as? NSNumber, size.intValue > maximumCaptureBytes {
        throw CaptureInputException("capture_size_limit")
      }
      let data = try Data(contentsOf: source, options: .mappedIfSafe)
      guard !data.isEmpty else {
        throw CaptureInputException("capture_empty")
      }
      guard let mime = detectMime(data) else {
        throw CaptureInputException("capture_unsupported_type")
      }
      let fileExtension: String
      switch mime {
      case "image/jpeg": fileExtension = "jpg"
      case "image/png": fileExtension = "png"
      case "image/heic": fileExtension = "heic"
      case "application/pdf": fileExtension = "pdf"
      default: throw CaptureInputException("capture_unsupported_type")
      }
      let original = outputDirectory.appendingPathComponent(
        "\(opaqueBaseName)-original.\(fileExtension)"
      )
      try data.write(to: original, options: .atomic)
      if mime == "application/pdf" {
        return try processPdf(
          original: original,
          byteCount: data.count,
          outputDirectory: outputDirectory,
          opaqueBaseName: opaqueBaseName,
          thumbnailDimension: thumbnailDimension
        )
      }
      return try processImage(
        original: original,
        byteCount: data.count,
        mime: mime,
        outputDirectory: outputDirectory,
        opaqueBaseName: opaqueBaseName,
        thumbnailDimension: thumbnailDimension
      )
    } catch let error as CaptureInputException {
      cleanupOutputs(outputDirectory: outputDirectory, opaqueBaseName: opaqueBaseName)
      throw error
    } catch {
      cleanupOutputs(outputDirectory: outputDirectory, opaqueBaseName: opaqueBaseName)
      throw CaptureInputException("capture_processing_failed")
    }
  }

  private func cleanupOutputs(outputDirectory: URL, opaqueBaseName: String) {
    guard
      let files = try? FileManager.default.contentsOfDirectory(
        at: outputDirectory,
        includingPropertiesForKeys: nil
      )
    else {
      return
    }
    for file in files where file.lastPathComponent.hasPrefix("\(opaqueBaseName)-") {
      try? FileManager.default.removeItem(at: file)
    }
  }

  private func processImage(
    original: URL,
    byteCount: Int,
    mime: String,
    outputDirectory: URL,
    opaqueBaseName: String,
    thumbnailDimension: Int
  ) throws -> [String: Any?] {
    guard
      let source = CGImageSourceCreateWithURL(original as CFURL, nil),
      let normalized = CGImageSourceCreateThumbnailAtIndex(
        source,
        0,
        [
          kCGImageSourceCreateThumbnailFromImageAlways: true,
          kCGImageSourceCreateThumbnailWithTransform: true,
          kCGImageSourceThumbnailMaxPixelSize: maximumNormalizedDimension
        ] as CFDictionary
      )
    else {
      throw CaptureInputException("capture_unsupported_type")
    }
    let normalizedImage = UIImage(cgImage: normalized)
    guard let normalizedData = normalizedImage.jpegData(compressionQuality: 0.92) else {
      throw CaptureInputException("capture_processing_failed")
    }
    let normalizedUrl = outputDirectory.appendingPathComponent(
      "\(opaqueBaseName)-normalized.jpg"
    )
    try normalizedData.write(to: normalizedUrl, options: .atomic)

    let thumbnailImage = resize(normalizedImage, maximumDimension: thumbnailDimension)
    guard let thumbnailData = thumbnailImage.jpegData(compressionQuality: 0.82) else {
      throw CaptureInputException("capture_processing_failed")
    }
    let thumbnailUrl = outputDirectory.appendingPathComponent(
      "\(opaqueBaseName)-thumbnail.jpg"
    )
    try thumbnailData.write(to: thumbnailUrl, options: .atomic)
    return [
      "byteCount": byteCount,
      "height": normalized.height,
      "mimeType": mime,
      "normalizedUri": normalizedUrl.absoluteString,
      "originalUri": original.absoluteString,
      "pageCount": 1,
      "thumbnailUri": thumbnailUrl.absoluteString,
      "width": normalized.width
    ]
  }

  private func processPdf(
    original: URL,
    byteCount: Int,
    outputDirectory: URL,
    opaqueBaseName: String,
    thumbnailDimension: Int
  ) throws -> [String: Any?] {
    guard let document = PDFDocument(url: original), document.pageCount > 0,
          let page = document.page(at: 0) else {
      throw CaptureInputException("capture_unsupported_type")
    }
    guard document.pageCount <= maximumCapturePages else {
      throw CaptureInputException("capture_page_limit")
    }
    let bounds = page.bounds(for: .mediaBox)
    let scale = min(
      CGFloat(thumbnailDimension) / max(bounds.width, 1),
      CGFloat(thumbnailDimension) / max(bounds.height, 1)
    )
    let size = CGSize(
      width: max(1, (bounds.width * scale).rounded()),
      height: max(1, (bounds.height * scale).rounded())
    )
    let renderer = UIGraphicsImageRenderer(size: size)
    let image = renderer.image { context in
      UIColor.white.setFill()
      context.fill(CGRect(origin: .zero, size: size))
      context.cgContext.translateBy(x: 0, y: size.height)
      context.cgContext.scaleBy(x: scale, y: -scale)
      page.draw(with: .mediaBox, to: context.cgContext)
    }
    guard let thumbnailData = image.jpegData(compressionQuality: 0.82) else {
      throw CaptureInputException("capture_processing_failed")
    }
    let thumbnailUrl = outputDirectory.appendingPathComponent(
      "\(opaqueBaseName)-thumbnail.jpg"
    )
    try thumbnailData.write(to: thumbnailUrl, options: .atomic)
    return [
      "byteCount": byteCount,
      "height": nil,
      "mimeType": "application/pdf",
      "normalizedUri": nil,
      "originalUri": original.absoluteString,
      "pageCount": document.pageCount,
      "thumbnailUri": thumbnailUrl.absoluteString,
      "width": nil
    ]
  }

  private func resize(_ image: UIImage, maximumDimension: Int) -> UIImage {
    let largest = max(image.size.width, image.size.height)
    guard largest > CGFloat(maximumDimension) else {
      return image
    }
    let scale = CGFloat(maximumDimension) / largest
    let size = CGSize(
      width: max(1, (image.size.width * scale).rounded()),
      height: max(1, (image.size.height * scale).rounded())
    )
    return UIGraphicsImageRenderer(size: size).image { _ in
      image.draw(in: CGRect(origin: .zero, size: size))
    }
  }

  private func detectMime(_ data: Data) -> String? {
    let bytes = [UInt8](data.prefix(16))
    if bytes.count >= 5, String(bytes: bytes[0..<5], encoding: .ascii) == "%PDF-" {
      return "application/pdf"
    }
    if bytes.count >= 3, bytes[0] == 0xff, bytes[1] == 0xd8, bytes[2] == 0xff {
      return "image/jpeg"
    }
    let png: [UInt8] = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
    if bytes.count >= png.count, Array(bytes[0..<png.count]) == png {
      return "image/png"
    }
    if bytes.count >= 12, String(bytes: bytes[4..<8], encoding: .ascii) == "ftyp" {
      let brand = String(bytes: bytes[8..<12], encoding: .ascii)?.lowercased()
      if let brand, ["heic", "heix", "hevc", "hevx", "heif", "mif1", "msf1"].contains(brand) {
        return "image/heic"
      }
    }
    return nil
  }
}
