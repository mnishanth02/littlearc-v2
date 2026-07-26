package app.littlearc.capture

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.ParcelFileDescriptor
import androidx.core.net.toUri
import androidx.exifinterface.media.ExifInterface
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import java.util.Locale
import kotlin.math.min
import kotlin.math.roundToInt

private const val maximumNormalizedDimension = 4096
private const val maximumCaptureBytes = 25L * 1024L * 1024L
private const val maximumCapturePages = 50

class CaptureInputException(code: String) : CodedException(code, "Capture processing failed safely.", null)

class LittleArcCaptureProcessorModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("LittleArcCaptureProcessor")

    AsyncFunction("processAsync") Coroutine {
      sourceUri: String,
      outputDirectoryUri: String,
      opaqueBaseName: String,
      thumbnailDimension: Int ->
      withContext(Dispatchers.IO) {
        process(sourceUri, outputDirectoryUri, opaqueBaseName, thumbnailDimension)
      }
    }
  }

  private fun process(
    sourceUri: String,
    outputDirectoryUri: String,
    opaqueBaseName: String,
    thumbnailDimension: Int
  ): Map<String, Any?> {
    if (!opaqueBaseName.matches(Regex("^[0-9a-fA-F-]{36}$")) || thumbnailDimension !in 64..1024) {
      throw CaptureInputException("capture_invalid_metadata")
    }
    val outputDirectory = File(requireFileUri(outputDirectoryUri))
    outputDirectory.mkdirs()
    if (!outputDirectory.isDirectory) {
      throw CaptureInputException("capture_storage_unavailable")
    }
    val staged = File(outputDirectory, "$opaqueBaseName.input")
    try {
      appContext.reactContext?.contentResolver?.openInputStream(Uri.parse(sourceUri)).use { input ->
        if (input == null) {
          throw CaptureInputException("capture_processing_failed")
        }
        FileOutputStream(staged).use { output ->
          val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
          var copied = 0L
          while (true) {
            val count = input.read(buffer)
            if (count < 0) {
              break
            }
            copied += count
            if (copied > maximumCaptureBytes) {
              throw CaptureInputException("capture_size_limit")
            }
            output.write(buffer, 0, count)
          }
        }
      }
      if (staged.length() <= 0) {
        throw CaptureInputException("capture_empty")
      }
      val mime = detectMime(staged)
      val extension = when (mime) {
        "image/jpeg" -> "jpg"
        "image/png" -> "png"
        "image/heic" -> "heic"
        "application/pdf" -> "pdf"
        else -> throw CaptureInputException("capture_unsupported_type")
      }
      val original = File(outputDirectory, "$opaqueBaseName-original.$extension")
      staged.copyTo(original, overwrite = true)
      return if (mime == "application/pdf") {
        processPdf(original, outputDirectory, opaqueBaseName, thumbnailDimension)
      } else {
        processImage(original, outputDirectory, opaqueBaseName, mime, thumbnailDimension)
      }
    } catch (error: CaptureInputException) {
      cleanupOutputs(outputDirectory, opaqueBaseName)
      throw error
    } catch (_: Throwable) {
      cleanupOutputs(outputDirectory, opaqueBaseName)
      throw CaptureInputException("capture_processing_failed")
    } finally {
      staged.delete()
    }
  }

  private fun cleanupOutputs(outputDirectory: File, opaqueBaseName: String) {
    outputDirectory.listFiles()
      ?.filter { it.name.startsWith("$opaqueBaseName-") }
      ?.forEach { it.delete() }
  }

  private fun processImage(
    original: File,
    outputDirectory: File,
    opaqueBaseName: String,
    mime: String,
    thumbnailDimension: Int
  ): Map<String, Any?> {
    val decoded = decodeBoundedImage(original)
    val oriented = applyOrientation(decoded, original)
    if (oriented !== decoded) {
      decoded.recycle()
    }
    val normalized = scaleDown(oriented, maximumNormalizedDimension)
    if (normalized !== oriented) {
      oriented.recycle()
    }
    val normalizedFile = File(outputDirectory, "$opaqueBaseName-normalized.jpg")
    writeJpeg(normalized, normalizedFile, 92)
    val thumbnail = scaleDown(normalized, thumbnailDimension)
    val thumbnailFile = File(outputDirectory, "$opaqueBaseName-thumbnail.jpg")
    writeJpeg(thumbnail, thumbnailFile, 82)
    if (thumbnail !== normalized) {
      thumbnail.recycle()
    }
    val width = normalized.width
    val height = normalized.height
    normalized.recycle()
    return mapOf(
      "byteCount" to original.length().toDouble(),
      "height" to height,
      "mimeType" to mime,
      "normalizedUri" to normalizedFile.toUri().toString(),
      "originalUri" to original.toUri().toString(),
      "pageCount" to 1,
      "thumbnailUri" to thumbnailFile.toUri().toString(),
      "width" to width
    )
  }

  private fun decodeBoundedImage(source: File): Bitmap {
    val bounds = BitmapFactory.Options().apply {
      inJustDecodeBounds = true
    }
    BitmapFactory.decodeFile(source.absolutePath, bounds)
    if (bounds.outWidth <= 0 || bounds.outHeight <= 0) {
      throw CaptureInputException("capture_unsupported_type")
    }
    var sampleSize = 1
    while (maxOf(bounds.outWidth, bounds.outHeight) / sampleSize > maximumNormalizedDimension) {
      sampleSize *= 2
    }
    return BitmapFactory.decodeFile(
      source.absolutePath,
      BitmapFactory.Options().apply {
        inPreferredConfig = Bitmap.Config.ARGB_8888
        inSampleSize = sampleSize
      }
    ) ?: throw CaptureInputException("capture_unsupported_type")
  }

  private fun processPdf(
    original: File,
    outputDirectory: File,
    opaqueBaseName: String,
    thumbnailDimension: Int
  ): Map<String, Any?> {
    val descriptor = ParcelFileDescriptor.open(original, ParcelFileDescriptor.MODE_READ_ONLY)
    PdfRenderer(descriptor).use { renderer ->
      if (renderer.pageCount <= 0) {
        throw CaptureInputException("capture_empty")
      }
      if (renderer.pageCount > maximumCapturePages) {
        throw CaptureInputException("capture_page_limit")
      }
      renderer.openPage(0).use { page ->
        val scale = min(
          thumbnailDimension.toDouble() / page.width.toDouble(),
          thumbnailDimension.toDouble() / page.height.toDouble()
        )
        val width = maxOf(1, (page.width * scale).roundToInt())
        val height = maxOf(1, (page.height * scale).roundToInt())
        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        Canvas(bitmap).drawColor(Color.WHITE)
        page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
        val thumbnailFile = File(outputDirectory, "$opaqueBaseName-thumbnail.jpg")
        FileOutputStream(thumbnailFile).use {
          if (!bitmap.compress(Bitmap.CompressFormat.JPEG, 82, it)) {
            throw CaptureInputException("capture_processing_failed")
          }
        }
        bitmap.recycle()
        return mapOf(
          "byteCount" to original.length().toDouble(),
          "height" to null,
          "mimeType" to "application/pdf",
          "normalizedUri" to null,
          "originalUri" to original.toUri().toString(),
          "pageCount" to renderer.pageCount,
          "thumbnailUri" to thumbnailFile.toUri().toString(),
          "width" to null
        )
      }
    }
  }

  private fun applyOrientation(bitmap: Bitmap, source: File): Bitmap {
    val orientation = runCatching {
      ExifInterface(source.absolutePath).getAttributeInt(
        ExifInterface.TAG_ORIENTATION,
        ExifInterface.ORIENTATION_NORMAL
      )
    }.getOrDefault(ExifInterface.ORIENTATION_NORMAL)
    val matrix = Matrix()
    when (orientation) {
      ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> matrix.setScale(-1f, 1f)
      ExifInterface.ORIENTATION_ROTATE_180 -> matrix.setRotate(180f)
      ExifInterface.ORIENTATION_FLIP_VERTICAL -> matrix.setScale(1f, -1f)
      ExifInterface.ORIENTATION_TRANSPOSE -> {
        matrix.setRotate(90f)
        matrix.postScale(-1f, 1f)
      }
      ExifInterface.ORIENTATION_ROTATE_90 -> matrix.setRotate(90f)
      ExifInterface.ORIENTATION_TRANSVERSE -> {
        matrix.setRotate(-90f)
        matrix.postScale(-1f, 1f)
      }
      ExifInterface.ORIENTATION_ROTATE_270 -> matrix.setRotate(-90f)
      else -> return bitmap
    }
    return Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
  }

  private fun scaleDown(bitmap: Bitmap, maximumDimension: Int): Bitmap {
    val largest = maxOf(bitmap.width, bitmap.height)
    if (largest <= maximumDimension) {
      return bitmap
    }
    val scale = maximumDimension.toDouble() / largest.toDouble()
    return Bitmap.createScaledBitmap(
      bitmap,
      maxOf(1, (bitmap.width * scale).roundToInt()),
      maxOf(1, (bitmap.height * scale).roundToInt()),
      true
    )
  }

  private fun jpegOnWhite(bitmap: Bitmap): Bitmap {
    if (!bitmap.hasAlpha()) {
      return bitmap
    }
    return Bitmap.createBitmap(bitmap.width, bitmap.height, Bitmap.Config.ARGB_8888).also {
      val canvas = Canvas(it)
      canvas.drawColor(Color.WHITE)
      canvas.drawBitmap(bitmap, 0f, 0f, null)
    }
  }

  private fun writeJpeg(bitmap: Bitmap, destination: File, quality: Int) {
    val flattened = jpegOnWhite(bitmap)
    try {
      FileOutputStream(destination).use {
        if (!flattened.compress(Bitmap.CompressFormat.JPEG, quality, it)) {
          throw CaptureInputException("capture_processing_failed")
        }
      }
    } finally {
      if (flattened !== bitmap) {
        flattened.recycle()
      }
    }
  }

  private fun detectMime(file: File): String? {
    val header = ByteArray(16)
    val count = file.inputStream().use { it.read(header) }
    if (count >= 5 && header.copyOfRange(0, 5).contentEquals("%PDF-".toByteArray())) {
      return "application/pdf"
    }
    if (count >= 3 && header[0] == 0xff.toByte() && header[1] == 0xd8.toByte() && header[2] == 0xff.toByte()) {
      return "image/jpeg"
    }
    val png = byteArrayOf(0x89.toByte(), 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)
    if (count >= png.size && header.copyOfRange(0, png.size).contentEquals(png)) {
      return "image/png"
    }
    if (count >= 12 && String(header, 4, 4) == "ftyp") {
      val brand = String(header, 8, 4).lowercase(Locale.US)
      if (brand in setOf("heic", "heix", "hevc", "hevx", "heif", "mif1", "msf1")) {
        return "image/heic"
      }
    }
    return null
  }

  private fun requireFileUri(uri: String): String {
    val parsed = Uri.parse(uri)
    if (parsed.scheme != "file" || parsed.path == null) {
      throw CaptureInputException("capture_storage_unavailable")
    }
    return requireNotNull(parsed.path)
  }
}
