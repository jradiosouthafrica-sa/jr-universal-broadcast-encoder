package com.example.jr_universal_broadcast_encoder

import android.app.Activity
import android.content.Intent
import android.media.projection.MediaProjectionManager
import android.os.Build
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.EventChannel
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    companion object {
        private const val METHOD_CHANNEL = "jradio/automation_capture"
        private const val EVENT_CHANNEL = "jradio/automation_capture_events"
        private const val REQUEST_MEDIA_PROJECTION = 7412
    }

    private var pendingCaptureResult: MethodChannel.Result? = null

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, METHOD_CHANNEL)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "start" -> startPlaybackCapture(result)
                    "stop" -> {
                        stopService(Intent(this, PlaybackCaptureService::class.java))
                        result.success(null)
                    }
                    else -> result.notImplemented()
                }
            }
        EventChannel(flutterEngine.dartExecutor.binaryMessenger, EVENT_CHANNEL)
            .setStreamHandler(object : EventChannel.StreamHandler {
                override fun onListen(arguments: Any?, events: EventChannel.EventSink?) {
                    PlaybackCaptureService.eventSink = events
                }

                override fun onCancel(arguments: Any?) {
                    PlaybackCaptureService.eventSink = null
                }
            })
    }

    private fun startPlaybackCapture(result: MethodChannel.Result) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            result.error("UNSUPPORTED_ANDROID", "Automation playback capture requires Android 10 or later.", null)
            return
        }
        if (pendingCaptureResult != null) {
            result.error("CAPTURE_BUSY", "An automation capture permission request is already open.", null)
            return
        }
        pendingCaptureResult = result
        val manager = getSystemService(MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        @Suppress("DEPRECATION")
        startActivityForResult(manager.createScreenCaptureIntent(), REQUEST_MEDIA_PROJECTION)
    }

    @Deprecated("Deprecated in Android API; retained for broad Android compatibility.")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != REQUEST_MEDIA_PROJECTION) return
        val result = pendingCaptureResult
        pendingCaptureResult = null
        if (resultCode != Activity.RESULT_OK || data == null) {
            result?.error("CAPTURE_DENIED", "Android playback-capture permission was not granted.", null)
            return
        }
        try {
            val serviceIntent = Intent(this, PlaybackCaptureService::class.java).apply {
                putExtra(PlaybackCaptureService.EXTRA_RESULT_CODE, resultCode)
                putExtra(PlaybackCaptureService.EXTRA_RESULT_DATA, data)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(serviceIntent)
            } else {
                startService(serviceIntent)
            }
            result?.success(true)
        } catch (error: Exception) {
            result?.error("CAPTURE_START_FAILED", error.message, null)
        }
    }

    override fun onDestroy() {
        PlaybackCaptureService.eventSink = null
        super.onDestroy()
    }
}
