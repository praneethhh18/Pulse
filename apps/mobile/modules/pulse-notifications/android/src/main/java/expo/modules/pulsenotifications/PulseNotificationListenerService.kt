package expo.modules.pulsenotifications

import android.app.Notification
import android.content.Context
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

// Runs as a system-bound service once the user grants "Notification access".
// Every notification any app posts lands here; we extract title/text + the
// originating app and POST it to Pulse's backend (?defer=1 = store only, the
// app triggers the reasoning pass). Runs even when the Pulse app is closed.
class PulseNotificationListenerService : NotificationListenerService() {

  override fun onNotificationPosted(sbn: StatusBarNotification?) {
    if (sbn == null) return
    try {
      val prefs = getSharedPreferences("pulse_phone", Context.MODE_PRIVATE)
      val apiUrl = prefs.getString("apiUrl", null) ?: return
      val userId = prefs.getString("userId", "demo-user") ?: "demo-user"

      // Skip our own notifications and ongoing/foreground-service noise.
      if (sbn.packageName == packageName) return
      val n = sbn.notification ?: return
      if (n.flags and Notification.FLAG_ONGOING_EVENT != 0) return
      if (n.flags and Notification.FLAG_FOREGROUND_SERVICE != 0) return

      val extras = n.extras ?: return
      val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString()
      val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString()
      if (title.isNullOrBlank() && text.isNullOrBlank()) return

      val signal = JSONObject()
        .put("kind", "notification")
        .put("app", appLabel(sbn.packageName))
        .put("title", title ?: "")
        .put("body", text ?: "")
      val payload = JSONObject().put("signals", JSONArray().put(signal)).toString()

      // Network off the main thread; failures are silently ignored (best-effort).
      Thread {
        var conn: HttpURLConnection? = null
        try {
          val url = URL(apiUrl.trimEnd('/') + "/me/signals?defer=1")
          conn = url.openConnection() as HttpURLConnection
          conn.requestMethod = "POST"
          conn.setRequestProperty("Content-Type", "application/json")
          conn.setRequestProperty("x-user-id", userId)
          conn.connectTimeout = 8000
          conn.readTimeout = 8000
          conn.doOutput = true
          conn.outputStream.use { it.write(payload.toByteArray(Charsets.UTF_8)) }
          conn.responseCode // execute the request
        } catch (_: Exception) {
        } finally {
          conn?.disconnect()
        }
      }.start()
    } catch (_: Exception) {
      // Never let a single notification crash the listener.
    }
  }

  private fun appLabel(pkg: String): String {
    return try {
      val pm = packageManager
      pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString()
    } catch (_: Exception) {
      pkg
    }
  }
}
