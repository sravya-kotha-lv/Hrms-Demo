package com.frontend

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost

class MainApplication : Application(), ReactApplication {
  private fun ensureNotificationChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return
    }

    val manager = getSystemService(NotificationManager::class.java) ?: return
    val channel = NotificationChannel(
      "upanaya-notifications",
      "Upanaya Notifications",
      NotificationManager.IMPORTANCE_HIGH
    ).apply {
      description = "Notifications for Upanaya updates and alerts"
    }

    manager.createNotificationChannel(channel)
  }

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          add(SessionStoragePackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    ensureNotificationChannel()
    loadReactNative(this)
  }
}
