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
import org.json.JSONObject
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
  /** Modelo único: sus 3 opciones (ya con la máscara de deletreo), cada STEP frames. */
  val top: List<Candidate>? = null,
)

data class Prediction(val label: String, val confidence: Float, val margin: Float)

/** Una opción del modelo único. kind: "sign", "letter" o "none" (la clase "nada"). */
data class Candidate(val label: String, val p: Float, val kind: String)

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
 *
 * MODELO ÚNICO (si existe lessa_unico.tflite, ver docs/modelo-unico.md): reemplaza
 * a los tres. Señas, letras y "nada" en un solo modelo, una inferencia por paso
 * (cuadros de 447 = v3 + forma de la mano que deletrea). Entrega su top-3; el
 * modo deletreo es una máscara sobre sus salidas (solo letras y "nada").
 * Sin ese archivo, todo sigue como antes.
 */
class SignEngine(context: Context) {
  companion object {
    const val STEP = 3            // ventana deslizante: una predicción cada 3 frames (~150 ms)
    const val MIN_FRAME_MS = 45L  // ~20 FPS, como los videos de entrenamiento
  }

  private val pose: PoseLandmarker
  private val hands: HandLandmarker
  private val unico: Classifier?
  private val signs: Classifier?
  private val letters: Classifier?
  private val lettersMotion: Classifier?
  /** Modelo único: tipo de cada salida ("sign", "letter", "none"). */
  private val unicoKinds: List<String>

  /**
   * Formato del modelo, de signs_meta.json (lo escribe train_senas.py) o, con el
   * modelo único, de unico_meta.json (train_unico.py).
   * Sin ese archivo: formato v2 (258 por cuadro), el del modelo original.
   */
  private val frameDim: Int
  private val v3: Boolean
  private val unicoFeatures: Boolean
  private val canonical: Boolean
  /** Largo de la ventana: se lee del modelo (30 en v2, 40 en v3). */
  private val seqLen: Int
  private val buffer = ArrayDeque<FloatArray>()
  /** Por cuadro de la ventana: ¿estaba la mano "Left"/"Right"? (para la mano dominante) */
  private val presence = ArrayDeque<BooleanArray>()
  private val handHistory = ArrayDeque<Int>()
  private var sinceLast = 0
  private var lastTs = -1L
  private var prevNorm: FloatArray? = null
  private var motionEma = 0f

  val isUnified: Boolean get() = unico != null
  val hasLetters: Boolean
    get() = if (unico != null) "letter" in unicoKinds else letters != null || lettersMotion != null

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
    unico = Classifier.load(context, "lessa_unico.tflite", "unico_labels.json")
    if (unico != null) {
      // Un solo modelo: los otros tres no se cargan (menos memoria, una inferencia por paso).
      signs = null
      letters = null
      lettersMotion = null
    } else {
      signs = Classifier.load(context, "lessa_signs.tflite", "signs_labels.json")
        ?: throw IllegalStateException("Falta lessa_signs.tflite o signs_labels.json en assets")
      letters = Classifier.load(context, "lessa_letters.tflite", "letters_labels.json")
      lettersMotion = Classifier.load(context, "lessa_letters_motion.tflite", "letters_motion_labels.json")
    }
    val meta = runCatching {
      val file = if (unico != null) "unico_meta.json" else "signs_meta.json"
      JSONObject(context.assets.open(file).bufferedReader().use { it.readText() })
    }.getOrNull()
    unicoFeatures = unico != null
    v3 = unicoFeatures || meta?.optString("features") == "v3"
    canonical = meta?.optBoolean("canonical", unicoFeatures) ?: unicoFeatures
    val defaultDim = if (unicoFeatures) Features.UNICO_DIM else Features.FRAME_DIM
    frameDim = meta?.optInt("frame_dim", defaultDim) ?: defaultDim
    unicoKinds = unico?.let { kindsOf(it.labels, meta) } ?: emptyList()
    seqLen = (unico ?: signs!!).inputSize / frameDim
  }

  /** Tipo de cada etiqueta del modelo único, según unico_meta.json (o la forma de la etiqueta). */
  private fun kindsOf(labels: List<String>, meta: JSONObject?): List<String> {
    val arr = meta?.optJSONArray("letters")
    val metaLetters = arr?.let { a -> List(a.length()) { a.getString(it) }.toSet() }
    val noSign = meta?.optString("no_sign")?.takeIf { it.isNotEmpty() && it != "null" } ?: "nada"
    return labels.map { l ->
      when {
        l == noSign || l == "_nada" -> "none"
        metaLetters?.contains(l) ?: (l.length == 1 && l[0].isUpperCase()) -> "letter"
        else -> "sign"
      }
    }
  }

  /** Solo procesa si pasó el tiempo mínimo: el ritmo debe parecerse a los 20 FPS del dataset. */
  fun wantsFrame(nowMs: Long): Boolean = lastTs < 0 || nowMs - lastTs >= MIN_FRAME_MS

  fun process(bitmap: Bitmap, tsMs: Long, wantLetters: Boolean, spelling: Boolean = false): FrameResult {
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

    buffer.addLast(
      when {
        unicoFeatures -> Features.unicoFrame(raw, w, hh)
        v3 -> Features.v3Frame(raw, w, hh)
        else -> norm
      }
    )
    if (buffer.size > seqLen) buffer.removeFirst()
    presence.addLast(booleanArrayOf(Features.slotPresent(raw, 0), Features.slotPresent(raw, 1)))
    if (presence.size > seqLen) presence.removeFirst()
    handHistory.addLast(nHands)
    if (handHistory.size > seqLen / 2) handHistory.removeFirst()
    sinceLast++

    var signPred: Prediction? = null
    var letterPred: Prediction? = null
    var top: List<Candidate>? = null
    val u = unico
    if (buffer.size == seqLen && sinceLast >= STEP && u != null) {
      // Modelo único: una sola inferencia para señas, letras y "nada".
      sinceLast = 0
      top = topCandidates(u, u.probabilities(flatten()), wantLetters, spelling)
    } else if (buffer.size == seqLen && sinceLast >= STEP) {
      sinceLast = 0
      val seq = flatten()
      signPred = signs!!.predict(seq)
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

    return FrameResult(raw, w, hh, nHands, quality(raw, w, hh, nHands), signPred, letterPred, motionEma, top)
  }

  /**
   * Máscara + top-k del modelo único. Modo deletreo: solo letras y "nada"; sin
   * letras (wantLetters = false): solo señas y "nada". Lo permitido se vuelve a
   * repartir para que sume 1 (así las confianzas siguen siendo comparables).
   */
  private fun topCandidates(u: Classifier, probs: FloatArray, wantLetters: Boolean, spelling: Boolean, k: Int = 3): List<Candidate> {
    val p = FloatArray(probs.size)
    val canSpell = "letter" in unicoKinds
    var sum = 0f
    for (i in probs.indices) {
      val kind = unicoKinds[i]
      val allowed = when {
        spelling && canSpell -> kind != "sign"
        !wantLetters -> kind != "letter"
        else -> true
      }
      if (allowed) { p[i] = probs[i]; sum += probs[i] }
    }
    if (sum > 0f) for (i in p.indices) p[i] /= sum
    return p.indices.sortedByDescending { p[it] }.take(k).map { Candidate(u.labels[it], p[it], unicoKinds[it]) }
  }

  /** ¿Hubo manos en al menos el 60% de la media ventana reciente? */
  fun handsRecently(): Boolean = handHistory.isNotEmpty() && handHistory.count { it > 0 } * 10 >= handHistory.size * 6

  fun reset() {
    buffer.clear()
    presence.clear()
    handHistory.clear()
    sinceLast = 0
    prevNorm = null
    motionEma = 0f
  }

  fun close() {
    pose.close()
    hands.close()
    unico?.close()
    signs?.close()
    letters?.close()
    lettersMotion?.close()
  }

  private fun flatten(): FloatArray {
    // Mano dominante: si en la ventana la mano "Left" aparece más que la "Right",
    // se espeja toda la ventana (igual que dominant_is_left() al entrenar).
    val mirror = canonical && presence.count { it[0] } > presence.count { it[1] }
    val out = FloatArray(seqLen * frameDim)
    buffer.forEachIndexed { i, f ->
      val frame = if (mirror) Features.mirrorFrame(f) else f
      System.arraycopy(frame, 0, out, i * frameDim, frameDim)
    }
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
class Classifier private constructor(private val interpreter: Interpreter, val labels: List<String>) {
  val inputSize = interpreter.getInputTensor(0).numElements()
  private val input = ByteBuffer.allocateDirect(inputSize * 4).order(ByteOrder.nativeOrder())
  private val output = Array(1) { FloatArray(labels.size) }

  /** Probabilidades de cada etiqueta (copia: se puede guardar). */
  fun probabilities(features: FloatArray): FloatArray {
    input.rewind()
    for (i in 0 until inputSize) input.putFloat(if (i < features.size) features[i] else 0f)
    input.rewind()
    interpreter.run(input, output)
    return output[0].copyOf()
  }

  fun predict(features: FloatArray): Prediction {
    val probs = probabilities(features)
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
