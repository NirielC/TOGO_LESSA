package expo.modules.togovision

import android.content.Context
import android.graphics.Bitmap
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.core.Delegate
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.handlandmarker.HandLandmarker
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarker
import org.json.JSONArray
import org.tensorflow.lite.Interpreter
import java.nio.ByteBuffer
import java.nio.ByteOrder

/** Lo que el motor entrega por frame procesado. */
data class FrameResult(
  val raw: FloatArray,
  val width: Int,
  val height: Int,
  val hands: Int,
  val quality: String,
  val signs: Prediction?,   // cada STEP frames, con el buffer lleno
  val letter: Prediction?,  // si hay modelo de letras y una mano
  val motion: Float,
)

data class Prediction(val label: String, val confidence: Float, val margin: Float)

/**
 * MOTOR DE SEÑAS (sin cámara ni UI: recibe Bitmaps ya rotados).
 *
 *  frame ─► MediaPipe pose + manos ─► vector 258 ─► normalizar ─► buffer 30
 *                                                       │
 *                     cada STEP frames con buffer lleno ┴─► LSTM señas (TFLite)
 *
 * Modelos opcionales del abecedario (se activan solos si existen en assets):
 *   lessa_letters.tflite         letras estáticas, 63 valores de una mano
 *   lessa_letters_motion.tflite  letras con movimiento, mismo buffer de 30×258
 */
class SignEngine(context: Context) {
  companion object {
    const val STEP = 3            // ventana deslizante: una predicción cada 3 frames (~150 ms)
    const val MIN_FRAME_MS = 45L  // ~20 FPS, como los videos de entrenamiento
  }

  private val pose: PoseLandmarker
  private val hands: HandLandmarker
  private val signs: Classifier
  private val letters: Classifier?
  private val lettersMotion: Classifier?

  /** Largo de la ventana: se lee del modelo (30 hoy; si se re-entrena con 40, se adapta solo). */
  private val seqLen: Int
  private val buffer = ArrayDeque<FloatArray>()
  private val handHistory = ArrayDeque<Int>()
  private var sinceLast = 0
  private var lastTs = -1L
  private var prevNorm: FloatArray? = null
  private var motionEma = 0f

  val hasLetters: Boolean get() = letters != null || lettersMotion != null

  init {
    pose = PoseLandmarker.createFromOptions(
      context,
      PoseLandmarker.PoseLandmarkerOptions.builder()
        .setBaseOptions(base(context, "pose_landmarker_lite.task"))
        .setRunningMode(RunningMode.VIDEO)
        .setNumPoses(1)
        .setMinPoseDetectionConfidence(0.5f)
        .setMinTrackingConfidence(0.5f)
        .build()
    )
    hands = HandLandmarker.createFromOptions(
      context,
      HandLandmarker.HandLandmarkerOptions.builder()
        .setBaseOptions(base(context, "hand_landmarker.task"))
        .setRunningMode(RunningMode.VIDEO)
        .setNumHands(2)
        .setMinHandDetectionConfidence(0.5f)
        .setMinTrackingConfidence(0.5f)
        .build()
    )
    signs = Classifier.load(context, "lessa_signs.tflite", "signs_labels.json")
      ?: throw IllegalStateException("Falta lessa_signs.tflite o signs_labels.json en assets")
    letters = Classifier.load(context, "lessa_letters.tflite", "letters_labels.json")
    lettersMotion = Classifier.load(context, "lessa_letters_motion.tflite", "letters_motion_labels.json")
    seqLen = signs.inputSize / Features.FRAME_DIM
  }

  /** Solo procesa si pasó el tiempo mínimo: el ritmo debe parecerse a los 20 FPS del dataset. */
  fun wantsFrame(nowMs: Long): Boolean = lastTs < 0 || nowMs - lastTs >= MIN_FRAME_MS

  fun process(bitmap: Bitmap, tsMs: Long, wantLetters: Boolean): FrameResult {
    val ts = if (tsMs <= lastTs) lastTs + 1 else tsMs
    lastTs = ts
    val image = BitmapImageBuilder(bitmap).build()
    val p = pose.detectForVideo(image, ts)
    val h = hands.detectForVideo(image, ts)
    val w = bitmap.width
    val hh = bitmap.height

    val raw = Features.rawFrame(p, h)
    val norm = Features.normalize(raw, w, hh)
    val nHands = Features.handsInFrame(raw)

    prevNorm?.let { motionEma = 0.6f * motionEma + 0.4f * Features.wristMotion(it, norm) }
    prevNorm = norm

    buffer.addLast(norm)
    if (buffer.size > seqLen) buffer.removeFirst()
    handHistory.addLast(nHands)
    if (handHistory.size > seqLen / 2) handHistory.removeFirst()
    sinceLast++

    var signPred: Prediction? = null
    var letterPred: Prediction? = null
    if (buffer.size == seqLen && sinceLast >= STEP) {
      sinceLast = 0
      val seq = flatten()
      signPred = signs.predict(seq)
      if (wantLetters) {
        val motionLetter = lettersMotion?.predict(seq)
        val staticLetter = letters?.let { c -> Features.letterFeatures(raw, w, hh)?.let { c.predict(it) } }
        // Con movimiento gana el modelo de secuencia; quieto, el de una sola mano.
        letterPred = when {
          motionLetter != null && staticLetter != null ->
            if (motionEma > 0.08f && motionLetter.confidence >= staticLetter.confidence) motionLetter else staticLetter
          else -> motionLetter ?: staticLetter
        }
      }
    }

    return FrameResult(raw, w, hh, nHands, quality(raw, w, hh, nHands), signPred, letterPred, motionEma)
  }

  /** ¿Hubo manos en al menos el 60% de la media ventana reciente? */
  fun handsRecently(): Boolean = handHistory.isNotEmpty() && handHistory.count { it > 0 } * 10 >= handHistory.size * 6

  fun reset() {
    buffer.clear()
    handHistory.clear()
    sinceLast = 0
    prevNorm = null
    motionEma = 0f
  }

  fun close() {
    pose.close()
    hands.close()
    signs.close()
    letters?.close()
    lettersMotion?.close()
  }

  private fun flatten(): FloatArray {
    val out = FloatArray(seqLen * Features.FRAME_DIM)
    buffer.forEachIndexed { i, f -> System.arraycopy(f, 0, out, i * Features.FRAME_DIM, Features.FRAME_DIM) }
    return out
  }

  private fun quality(raw: FloatArray, w: Int, h: Int, nHands: Int): String {
    var pose = false
    for (i in 0 until Features.POSE_DIM) if (raw[i] != 0f) { pose = true; break }
    if (!pose && nHands == 0) return "no_person"
    if (pose) {
      val ratio = Features.shoulderWidthRatio(raw, w, h)
      if (ratio > 0.62f) return "too_close"
      if (ratio < 0.14f) return "too_far"
    }
    if (nHands == 0) return "no_hands"
    for (s in 0..1) {
      val b = Features.POSE_DIM + s * Features.HAND_DIM
      if (raw[b] == 0f && raw[b + 1] == 0f) continue
      for (i in 0 until Features.HAND_N) {
        val x = raw[b + i * 3]; val y = raw[b + i * 3 + 1]
        if (x < 0.01f || x > 0.99f || y < 0.01f || y > 0.99f) return "hands_cut"
      }
    }
    return "ok"
  }

  private fun base(context: Context, asset: String): BaseOptions =
    BaseOptions.builder().setModelAssetBuffer(readAsset(context, asset)).setDelegate(Delegate.CPU).build()
}

internal fun readAsset(context: Context, name: String): ByteBuffer {
  val bytes = context.assets.open(name).use { it.readBytes() }
  return ByteBuffer.allocateDirect(bytes.size).order(ByteOrder.nativeOrder()).apply { put(bytes); rewind() }
}

/** Un modelo TFLite de clasificación con sus etiquetas. */
class Classifier private constructor(private val interpreter: Interpreter, private val labels: List<String>) {
  val inputSize = interpreter.getInputTensor(0).numElements()
  private val input = ByteBuffer.allocateDirect(inputSize * 4).order(ByteOrder.nativeOrder())
  private val output = Array(1) { FloatArray(labels.size) }

  fun predict(features: FloatArray): Prediction {
    input.rewind()
    for (i in 0 until inputSize) input.putFloat(if (i < features.size) features[i] else 0f)
    input.rewind()
    interpreter.run(input, output)
    val probs = output[0]
    var top = 0
    var second = -1
    for (i in probs.indices) if (probs[i] > probs[top]) top = i
    for (i in probs.indices) if (i != top && (second < 0 || probs[i] > probs[second])) second = i
    val conf = probs[top]
    val margin = conf - if (second >= 0) probs[second] else 0f
    return Prediction(labels[top], conf, margin)
  }

  fun close() = interpreter.close()

  companion object {
    fun load(context: Context, model: String, labelsFile: String): Classifier? {
      val names = context.assets.list("")?.toSet() ?: emptySet()
      if (model !in names || labelsFile !in names) return null
      val json = context.assets.open(labelsFile).bufferedReader().use { it.readText() }
      val arr = JSONArray(json)
      val labels = List(arr.length()) { arr.getString(it) }
      val opts = Interpreter.Options().apply { setNumThreads(2) }
      return Classifier(Interpreter(readAsset(context, model), opts), labels)
    }
  }
}
