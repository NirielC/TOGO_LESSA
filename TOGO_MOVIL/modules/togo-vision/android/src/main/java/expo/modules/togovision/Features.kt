package expo.modules.togovision

import com.google.mediapipe.tasks.vision.handlandmarker.HandLandmarkerResult
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarkerResult
import kotlin.math.hypot
import kotlin.math.max

/**
 * CONTRATO DE CARACTERÍSTICAS — copia exacta de TOGO_DATASET/togo_features.py.
 * Si uno cambia, el otro también; si no, el modelo recibe números distintos a
 * los que vio al entrenar y falla sin avisar.
 *
 * Frame crudo (258): pose 33×(x,y,z,vis) | mano "Left" 21×(x,y,z) | mano "Right" 21×(x,y,z)
 */
object Features {
  const val POSE_N = 33
  const val HAND_N = 21
  const val POSE_DIM = POSE_N * 4      // 132
  const val HAND_DIM = HAND_N * 3      // 63
  const val FRAME_DIM = POSE_DIM + 2 * HAND_DIM  // 258
  const val SEQ_LEN = 30
  const val SEQ_FPS = 20

  private const val L_SHOULDER = 11
  private const val R_SHOULDER = 12
  private const val MIN_SHOULDER_PX = 20f

  /** Igual que frame_from_results(). */
  fun rawFrame(pose: PoseLandmarkerResult?, hands: HandLandmarkerResult?): FloatArray {
    val out = FloatArray(FRAME_DIM)
    pose?.landmarks()?.firstOrNull()?.let { lms ->
      lms.forEachIndexed { i, p ->
        out[i * 4] = p.x()
        out[i * 4 + 1] = p.y()
        out[i * 4 + 2] = p.z()
        out[i * 4 + 3] = p.visibility().orElse(0f)
      }
    }
    if (hands != null && hands.landmarks().isNotEmpty()) {
      // La mano más segura reclama su lado; si ambas dicen el mismo, la segunda toma el libre.
      val list = hands.landmarks().indices.map { i ->
        val cat = hands.handedness()[i][0]
        Triple(cat.score(), cat.categoryName(), hands.landmarks()[i])
      }.sortedByDescending { it.first }
      val taken = mutableSetOf<String>()
      for ((_, side, lms) in list) {
        val slot = if (side !in taken) side else if (side == "Left") "Right" else "Left"
        if (slot in taken) continue
        taken += slot
        val start = if (slot == "Left") POSE_DIM else POSE_DIM + HAND_DIM
        lms.forEachIndexed { i, p ->
          out[start + i * 3] = p.x()
          out[start + i * 3 + 1] = p.y()
          out[start + i * 3 + 2] = p.z()
        }
      }
    }
    return out
  }

  /** Igual que normalize_sequence() para un frame. */
  fun normalize(raw: FloatArray, width: Int, height: Int): FloatArray {
    val w = width.toFloat()
    val h = height.toFloat()
    val out = FloatArray(FRAME_DIM)

    var posePresent = false
    for (i in 0 until POSE_N) {
      if (raw[i * 4] != 0f || raw[i * 4 + 1] != 0f || raw[i * 4 + 2] != 0f) { posePresent = true; break }
    }

    val lsx = raw[L_SHOULDER * 4] * w; val lsy = raw[L_SHOULDER * 4 + 1] * h
    val rsx = raw[R_SHOULDER * 4] * w; val rsy = raw[R_SHOULDER * 4 + 1] * h
    var cx = (lsx + rsx) / 2f
    var cy = (lsy + rsy) / 2f
    var shoulder = hypot(lsx - rsx, lsy - rsy)
    if (!(posePresent && shoulder >= MIN_SHOULDER_PX)) {
      cx = w / 2f; cy = h / 2f; shoulder = w * 0.3f
    }

    if (posePresent) {
      for (i in 0 until POSE_N) {
        val b = i * 4
        out[b] = (raw[b] * w - cx) / shoulder
        out[b + 1] = (raw[b + 1] * h - cy) / shoulder
        out[b + 2] = (raw[b + 2] * w) / shoulder
        out[b + 3] = raw[b + 3]
      }
    }
    for (i in 0 until 2 * HAND_N) {
      val b = POSE_DIM + i * 3
      val present = raw[b] != 0f || raw[b + 1] != 0f || raw[b + 2] != 0f
      if (!present) continue
      out[b] = (raw[b] * w - cx) / shoulder
      out[b + 1] = (raw[b + 1] * h - cy) / shoulder
      out[b + 2] = (raw[b + 2] * w) / shoulder
    }
    return out
  }

  fun handsInFrame(raw: FloatArray): Int {
    var n = 0
    for (s in 0..1) {
      val start = POSE_DIM + s * HAND_DIM
      for (k in start until start + HAND_DIM) if (raw[k] != 0f) { n++; break }
    }
    return n
  }

  /**
   * Características de UNA mano para el abecedario (igual que hand_letter_features()):
   * relativa a la muñeca, escalada por el tamaño de la palma (muñeca -> nudillo
   * medio) y llevada a "mano derecha" (la izquierda se espeja). Devuelve null si
   * no hay mano.
   */
  fun letterFeatures(raw: FloatArray, width: Int, height: Int): FloatArray? {
    var best: Int = -1
    var bestSize = 0f
    for (s in 0..1) {
      val b = POSE_DIM + s * HAND_DIM
      if (raw[b] == 0f && raw[b + 1] == 0f) continue
      val size = hypot((raw[b + 27] - raw[b]) * width, (raw[b + 28] - raw[b + 1]) * height)
      if (size > bestSize) { bestSize = size; best = s }
    }
    if (best < 0 || bestSize < 1f) return null
    val b = POSE_DIM + best * HAND_DIM
    val mirror = if (best == 0) -1f else 1f  // slot 0 = "Left"
    val wx = raw[b] * width; val wy = raw[b + 1] * height; val wz = raw[b + 2] * width
    val out = FloatArray(HAND_DIM)
    for (i in 0 until HAND_N) {
      out[i * 3] = mirror * (raw[b + i * 3] * width - wx) / bestSize
      out[i * 3 + 1] = (raw[b + i * 3 + 1] * height - wy) / bestSize
      out[i * 3 + 2] = (raw[b + i * 3 + 2] * width - wz) / bestSize
    }
    return out
  }

  /** Movimiento medio de las muñecas entre dos frames normalizados (en anchos de hombro). */
  fun wristMotion(a: FloatArray, b: FloatArray): Float {
    var m = 0f
    var n = 0
    for (s in 0..1) {
      val k = POSE_DIM + s * HAND_DIM
      val pa = a[k] != 0f || a[k + 1] != 0f
      val pb = b[k] != 0f || b[k + 1] != 0f
      if (pa && pb) { m += hypot(a[k] - b[k], a[k + 1] - b[k + 1]); n++ }
    }
    return if (n == 0) 0f else m / n
  }

  fun shoulderWidthRatio(raw: FloatArray, width: Int, height: Int): Float {
    val dx = (raw[L_SHOULDER * 4] - raw[R_SHOULDER * 4]) * width
    val dy = (raw[L_SHOULDER * 4 + 1] - raw[R_SHOULDER * 4 + 1]) * height
    return max(0f, hypot(dx, dy) / width)
  }
}
