package expo.modules.pulsenotifications

import android.content.Context
import android.content.Intent
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// The JS-facing module. It only does control-plane work: check/open the
// "Notification access" permission and hand the service the backend URL + user
// id. The actual capture + upload happens in PulseNotificationListenerService,
// which the system runs even when the app is closed.
class PulseNotificationsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PulseNotifications")

    // Is Pulse currently allowed to read notifications?
    Function("isPermissionGranted") {
      val ctx = appContext.reactContext ?: return@Function false
      val flat = Settings.Secure.getString(
        ctx.contentResolver,
        "enabled_notification_listeners",
      )
      flat != null && flat.contains(ctx.packageName)
    }

    // Open the system screen where the user toggles notification access on.
    Function("openSettings") {
      val ctx = appContext.reactContext
      if (ctx != null) {
        val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        ctx.startActivity(intent)
      }
    }

    // Persist where to POST signals + which user, so the background service
    // can upload even when no JS is running.
    Function("configure") { apiUrl: String, userId: String ->
      val ctx = appContext.reactContext
      if (ctx != null) {
        ctx.getSharedPreferences("pulse_phone", Context.MODE_PRIVATE)
          .edit()
          .putString("apiUrl", apiUrl)
          .putString("userId", userId)
          .apply()
      }
    }
  }
}
