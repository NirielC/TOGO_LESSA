package expo.modules.togovision

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class TogoVisionModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("TogoVision")

    /** ¿Hay modelo de abecedario instalado? (para que la UI sepa si mostrar letras). */
    Function("hasLettersModel") {
      val ctx = appContext.reactContext ?: return@Function false
      val names = ctx.assets.list("")?.toSet() ?: emptySet()
      // El modelo único trae letras si su formato las nombra (unico_meta.json > letters).
      val unicoLetters = "lessa_unico.tflite" in names && runCatching {
        org.json.JSONObject(ctx.assets.open("unico_meta.json").bufferedReader().use { it.readText() })
          .optJSONArray("letters")?.length()?.let { it > 0 } ?: false
      }.getOrDefault(false)
      unicoLetters || "lessa_letters.tflite" in names || "lessa_letters_motion.tflite" in names
    }

    View(TogoVisionView::class) {
      Events("onPrediction", "onStatus", "onEngineError")

      Prop("active") { view: TogoVisionView, value: Boolean -> view.setActive(value) }
      Prop("facing") { view: TogoVisionView, value: String -> view.setFacing(value) }
      Prop("showHands") { view: TogoVisionView, value: Boolean -> view.showHands = value }
      Prop("letters") { view: TogoVisionView, value: Boolean -> view.lettersEnabled = value }
      Prop("spelling") { view: TogoVisionView, value: Boolean -> view.spellingEnabled = value }
    }
  }
}
