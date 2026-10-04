package expo.modules.togovision

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.Paint
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CaptureRequest
import android.os.SystemClock
import android.util.Log
import android.util.Range
import android.view.View
import android.widget.FrameLayout
import androidx.annotation.OptIn
import androidx.camera.camera2.interop.Camera2CameraInfo
import androidx.camera.camera2.interop.Camera2Interop
import androidx.camera.camera2.interop.ExperimentalCamera2Interop
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.core.resolutionselector.ResolutionSelector
import androidx.camera.core.resolutionselector.ResolutionStrategy
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import kotlin.math.max

/**
 * Vista nativa: vista previa de la cámara + manos dibujadas + reconocimiento.
 * Props desde JS: active, mode ("signs"|"letters"), showHands, facing ("back"|"front").
 * Eventos: onPrediction, onStatus (~4/s), onEngineError.
 */
class TogoVisionView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  // React Native no mide ni acomoda a los hijos nativos: sin esto la vista previa
  // queda en tamaño 0 (negra) aunque la cámara funcione.
  override val shouldUseAndroidLayout = true

  private val onPrediction by EventDispatcher()
  private val onStatus by EventDispatcher()
  private val onEngineError by EventDispatcher()

  private val preview = PreviewView(context).apply {
    scaleType = PreviewView.ScaleType.FILL_CENTER
    implementationMode = PreviewView.ImplementationMode.COMPATIBLE
  }
  private val overlay = HandOverlay(context)
  // ExpoView es un LinearLayout: dos hijos MATCH_PARENT quedan uno debajo del
  // otro y la capa de manos medía 0 de alto (por eso no se dibujaban). Un
  // FrameLayout los apila uno encima del otro.
  private val stack = FrameLayout(context)

  private var executor: ExecutorService? = null
  @Volatile private var engine: SignEngine? = null
  private var provider: ProcessCameraProvider? = null

  // Props
  private var active = false
  private var facingBack = true
  @Volatile var lettersEnabled = true
  @Volatile var showHands = true

  // Métricas
  private var lastStatusAt = 0L
  private var frames = 0
  private var fpsWindowStart = 0L
  private var fps = 0f
  private var lastLatency = 0L

  init {
    val full = FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT)
    stack.addView(preview, full)
    stack.addView(overlay, FrameLayout.LayoutParams(full))
    addView(stack, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
  }

  fun setActive(value: Boolean) {
    if (value == active) return
    active = value
    if (active) start() else stop()
  }

  fun setFacing(value: String) {
    val back = value != "front"
    if (back == facingBack) return
    facingBack = back
    if (active) { stop(); start() }
  }

  override fun onDetachedFromWindow() {
    super.onDetachedFromWindow()
    stop()
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    if (active && provider == null) start()
  }

  private fun start() {
    val owner = appContext.currentActivity as? LifecycleOwner
    if (owner == null) {
      emitError("No hay actividad para la cámara")
      return
    }
    if (executor == null) executor = Executors.newSingleThreadExecutor()
    // Cargar modelos fuera del hilo principal (tarda ~1 s la primera vez).
    executor?.execute {
      try {
        if (engine == null) engine = SignEngine(context.applicationContext)
        engine?.reset()
      } catch (e: Throwable) {
        Log.e(TAG, "Motor", e)
        emitError("No se pudo cargar el modelo: ${e.message}")
      }
    }
    val future = ProcessCameraProvider.getInstance(context)
    future.addListener({
      try {
        val p = future.get()
        provider = p
        val selector = if (facingBack) CameraSelector.DEFAULT_BACK_CAMERA else CameraSelector.DEFAULT_FRONT_CAMERA
        // Cuadros por segundo de la cámara: el máximo que acepte (hasta 60) y fijo,
        // para que la vista previa no baje a 15 FPS con poca luz. El reconocimiento
        // sigue tomando ~20 cuadros/s (como los videos de entrenamiento).
        val fpsRange = bestFpsRange(p, selector)
        val previewBuilder = Preview.Builder()
        fpsRange?.let { applyFps(previewBuilder, it) }
        val previewUse = previewBuilder.build().also { it.surfaceProvider = preview.surfaceProvider }
        val analysisBuilder = ImageAnalysis.Builder()
          .setResolutionSelector(
            ResolutionSelector.Builder()
              .setResolutionStrategy(ResolutionStrategy(android.util.Size(640, 480), ResolutionStrategy.FALLBACK_RULE_CLOSEST_HIGHER_THEN_LOWER))
              .build()
          )
          .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
          .setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_RGBA_8888)
        fpsRange?.let { applyFps(analysisBuilder, it) }
        val analysis = analysisBuilder.build()
        analysis.setAnalyzer(executor!!) { img -> analyze(img) }
        p.unbindAll()
        p.bindToLifecycle(owner, selector, previewUse, analysis)
        fpsWindowStart = SystemClock.elapsedRealtime()
      } catch (e: Throwable) {
        Log.e(TAG, "Cámara", e)
        emitError("No se pudo abrir la cámara: ${e.message}")
      }
    }, ContextCompat.getMainExecutor(context))
  }

  @OptIn(ExperimentalCamera2Interop::class)
  private fun bestFpsRange(p: ProcessCameraProvider, selector: CameraSelector): Range<Int>? = try {
    val info = selector.filter(p.availableCameraInfos).firstOrNull()
    val ranges = info?.let {
      Camera2CameraInfo.from(it).getCameraCharacteristic(CameraCharacteristics.CONTROL_AE_AVAILABLE_TARGET_FPS_RANGES)
    }
    // Primero el tope más alto (máx. MAX_FPS); entre iguales, el que no baja (fijo).
    ranges?.filter { it.upper <= MAX_FPS && it.lower >= MIN_FPS }
      ?.maxWithOrNull(compareBy<Range<Int>>({ it.upper }, { it.lower }))
  } catch (e: Throwable) {
    Log.w(TAG, "FPS", e)
    null
  }

  @OptIn(ExperimentalCamera2Interop::class)
  private fun <T> applyFps(builder: androidx.camera.core.ExtendableBuilder<T>, range: Range<Int>) {
    Camera2Interop.Extender(builder).setCaptureRequestOption(CaptureRequest.CONTROL_AE_TARGET_FPS_RANGE, range)
  }

  private fun stop() {
    try { provider?.unbindAll() } catch (_: Throwable) {}
    provider = null
    overlay.clear()
    // El motor se cierra en su propio hilo, después del último frame en curso.
    // Se captura aquí para que un start() inmediato (p. ej. cambiar de cámara)
    // no pierda el motor nuevo.
    val ex = executor
    val old = engine
    executor = null
    engine = null
    ex?.execute { old?.close() }
    ex?.shutdown()
  }

  private fun analyze(img: ImageProxy) {
    val eng = engine
    val now = SystemClock.elapsedRealtime()
    if (eng == null || !eng.wantsFrame(now)) { img.close(); return }
    try {
      val bmp = toUprightBitmap(img)
      val res = eng.process(bmp, now, lettersEnabled)
      val done = SystemClock.elapsedRealtime()
      lastLatency = done - now
      frames++
      if (done - fpsWindowStart >= 1000) {
        fps = frames * 1000f / (done - fpsWindowStart)
        frames = 0
        fpsWindowStart = done
      }

      if (showHands) overlay.update(res.raw, res.width, res.height, !facingBack) else overlay.clear()

      // Una seña solo cuenta si hay manos AHORA y en la mayor parte de la ventana.
      // Antes bastaba con haberlas visto hace poco: por eso seguía diciendo
      // frases con las manos fuera del cuadro.
      val handsVisible = res.hands > 0 && eng.handsRecently()
      res.signs?.let { emitPrediction("signs", it, handsVisible, res.motion) }
      res.letter?.let { emitPrediction("letters", it, res.hands > 0, res.motion) }

      if (done - lastStatusAt >= 120) {  // ~8/s: manos abajo responde rápido
        lastStatusAt = done
        val payload = mapOf(
          "type" to "status",
          "quality" to res.quality,
          "hands" to res.hands,
          "fps" to Math.round(fps * 10) / 10.0,
          "latencyMs" to lastLatency,
          "hasLetters" to eng.hasLetters,
        )
        post { onStatus(payload) }
      }
    } catch (e: Throwable) {
      Log.e(TAG, "Análisis", e)
    } finally {
      img.close()
    }
  }

  private fun emitPrediction(mode: String, p: Prediction, handsVisible: Boolean, motion: Float) {
    val payload = mapOf(
      "type" to "prediction",
      "mode" to mode,
      "label" to p.label,
      "confidence" to p.confidence.toDouble(),
      "margin" to p.margin.toDouble(),
      "handsVisible" to handsVisible,
      "motion" to motion.toDouble(),
      "ts" to System.currentTimeMillis(),
    )
    post { onPrediction(payload) }
  }

  private fun emitError(message: String) {
    post { onEngineError(mapOf("message" to message)) }
  }

  /** RGBA del analizador -> Bitmap derecho (la persona de pie), sin espejo. */
  private fun toUprightBitmap(img: ImageProxy): Bitmap {
    val src = img.toBitmap()
    val rot = img.imageInfo.rotationDegrees
    if (rot == 0) return src
    val m = Matrix().apply { postRotate(rot.toFloat()) }
    return Bitmap.createBitmap(src, 0, 0, src.width, src.height, m, true)
  }

  companion object {
    private const val TAG = "TogoVision"
    private const val MAX_FPS = 60
    private const val MIN_FPS = 24
  }
}

/**
 * Dibuja las manos encima de la vista previa. Los puntos llegan ~20 veces por
 * segundo, pero se dibujan a la frecuencia de la pantalla deslizándose hacia la
 * última posición: el esqueleto se mueve suave en vez de a saltos.
 * Convierte coordenadas de la imagen analizada a la vista, con el mismo recorte
 * que FILL_CENTER.
 */
class HandOverlay(context: Context) : View(context) {
  private val line = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    color = Color.parseColor("#B7D4E6"); strokeWidth = 6f; style = Paint.Style.STROKE; strokeCap = Paint.Cap.ROUND
  }
  private val dot = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.parseColor("#F6C453"); style = Paint.Style.FILL }
  private val tip = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.parseColor("#F08A5D"); style = Paint.Style.FILL }

  private val lock = Any()
  private var target: FloatArray? = null          // última detección
  private var shown: FloatArray? = null           // lo que se dibuja (se acerca a target)
  @Volatile private var imgW = 1
  @Volatile private var imgH = 1
  @Volatile private var mirror = false

  init { setWillNotDraw(false) }

  fun update(raw: FloatArray, w: Int, h: Int, mirrored: Boolean) {
    val next = raw.copyOfRange(Features.POSE_DIM, Features.FRAME_DIM)
    synchronized(lock) {
      val cur = shown
      // Una mano que aparece (o cambia de lado) salta directo; las demás se deslizan.
      if (cur == null) shown = next.copyOf()
      else for (s in 0..1) {
        val b = s * Features.HAND_DIM
        val had = cur[b] != 0f || cur[b + 1] != 0f
        val has = next[b] != 0f || next[b + 1] != 0f
        if (!had || !has) System.arraycopy(next, b, cur, b, Features.HAND_DIM)
      }
      target = next
    }
    imgW = w; imgH = h; mirror = mirrored
    postInvalidateOnAnimation()
  }

  fun clear() {
    synchronized(lock) { target = null; shown = null }
    postInvalidateOnAnimation()
  }

  override fun onDraw(canvas: Canvas) {
    var moving = false
    val pts: FloatArray = synchronized(lock) {
      val t = target
      val s = shown
      if (t == null || s == null) null
      else {
        for (i in s.indices) {
          val d = t[i] - s[i]
          if (kotlin.math.abs(d) > 0.0005f) { s[i] += d * SMOOTH; moving = true } else s[i] = t[i]
        }
        s.copyOf()
      }
    } ?: return
    val scale = max(width / imgW.toFloat(), height / imgH.toFloat())
    val ox = (width - imgW * scale) / 2f
    val oy = (height - imgH * scale) / 2f
    fun px(i: Int, b: Int): Float {
      val x = ox + pts[b + i * 3] * imgW * scale
      return if (mirror) width - x else x
    }
    fun py(i: Int, b: Int) = oy + pts[b + i * 3 + 1] * imgH * scale

    for (s in 0..1) {
      val b = s * Features.HAND_DIM
      if (pts[b] == 0f && pts[b + 1] == 0f) continue
      for ((a, c) in CONNECTIONS) canvas.drawLine(px(a, b), py(a, b), px(c, b), py(c, b), line)
      for (i in 0 until Features.HAND_N) {
        val isTip = i == 4 || i == 8 || i == 12 || i == 16 || i == 20
        canvas.drawCircle(px(i, b), py(i, b), if (isTip) 9f else 6f, if (isTip) tip else dot)
      }
    }
    if (moving) postInvalidateOnAnimation()
  }

  companion object {
    private const val SMOOTH = 0.45f  // fracción del camino por cuadro de pantalla
    private val CONNECTIONS = listOf(
      0 to 1, 1 to 2, 2 to 3, 3 to 4,
      0 to 5, 5 to 6, 6 to 7, 7 to 8,
      5 to 9, 9 to 10, 10 to 11, 11 to 12,
      9 to 13, 13 to 14, 14 to 15, 15 to 16,
      13 to 17, 0 to 17, 17 to 18, 18 to 19, 19 to 20,
    )
  }
}
