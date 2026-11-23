package com.example.jr_universal_broadcast_encoder

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioPlaybackCaptureConfiguration
import android.media.AudioRecord
import android.media.MediaCodec
import android.media.MediaFormat
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log
import io.flutter.plugin.common.EventChannel
import java.nio.ByteBuffer
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Captures eligible media playback after explicit Android MediaProjection consent.
 * AAC-LC access units are wrapped in ADTS frames for the existing audio/aac Icecast path.
 */
class PlaybackCaptureService : Service() {
    companion object {
        const val EXTRA_RESULT_CODE = "projection_result_code"
        const val EXTRA_RESULT_DATA = "projection_result_data"
        const val ACTION_STOP = "com.example.jr_universal_broadcast_encoder.STOP_CAPTURE"
        private const val CHANNEL_ID = "jradio_automation_capture"
        private const val NOTIFICATION_ID = 732
        @Volatile var eventSink: EventChannel.EventSink? = null
        private val mainHandler = Handler(Looper.getMainLooper())
    }

    private val running = AtomicBoolean(false)
    private var projection: MediaProjection? = null
    private var audioRecord: AudioRecord? = null
    private var codec: MediaCodec? = null
    private var captureThread: Thread? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopSelf()
            return START_NOT_STICKY
        }
        if (running.get()) return START_STICKY

        val resultCode = intent?.getIntExtra(EXTRA_RESULT_CODE, 0) ?: 0
        @Suppress("DEPRECATION")
        val resultData = intent?.getParcelableExtra<Intent>(EXTRA_RESULT_DATA)
        if (resultCode == 0 || resultData == null) {
            emitStatus("error", "Android playback-capture permission data is missing.")
            stopSelf()
            return START_NOT_STICKY
        }

        createNotificationChannel()
        val notification = buildNotification()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }

        try {
            val manager = getSystemService(MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
            projection = manager.getMediaProjection(resultCode, resultData)
            startAudioCapture()
        } catch (error: Exception) {
            emitStatus("error", "Could not start automation audio capture: ${error.message}")
            stopSelf()
        }
        return START_NOT_STICKY
    }

    private fun startAudioCapture() {
        val activeProjection = projection ?: throw IllegalStateException("MediaProjection unavailable")
        val captureConfig = AudioPlaybackCaptureConfiguration.Builder(activeProjection)
            .addMatchingUsage(AudioAttributes.USAGE_MEDIA)
            .addMatchingUsage(AudioAttributes.USAGE_GAME)
            .addMatchingUsage(AudioAttributes.USAGE_UNKNOWN)
            .build()

        val audioFormat = AudioFormat.Builder()
            .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
            .setSampleRate(44100)
            .setChannelMask(AudioFormat.CHANNEL_IN_STEREO)
            .build()
        val minBuffer = AudioRecord.getMinBufferSize(
            44100,
            AudioFormat.CHANNEL_IN_STEREO,
            AudioFormat.ENCODING_PCM_16BIT
        )
        if (minBuffer <= 0) throw IllegalStateException("This device does not support the requested playback-capture audio format.")

        val recorder = AudioRecord.Builder()
            .setAudioPlaybackCaptureConfig(captureConfig)
            .setAudioFormat(audioFormat)
            .setBufferSizeInBytes(minBuffer * 2)
            .build()
        if (recorder.state != AudioRecord.STATE_INITIALIZED) {
            recorder.release()
            throw IllegalStateException("Android could not initialise playback audio capture.")
        }

        val format = MediaFormat.createAudioFormat(MediaFormat.MIMETYPE_AUDIO_AAC, 44100, 2).apply {
            setInteger(MediaFormat.KEY_AAC_PROFILE, MediaCodecInfo.CodecProfileLevel.AACObjectLC)
            setInteger(MediaFormat.KEY_BIT_RATE, 128000)
            setInteger(MediaFormat.KEY_MAX_INPUT_SIZE, minBuffer * 2)
        }
        val encoder = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_AUDIO_AAC)
        encoder.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)

        audioRecord = recorder
        codec = encoder
        running.set(true)
        activeProjection.registerCallback(object : MediaProjection.Callback() {
            override fun onStop() {
                emitStatus("warning", "Android playback-capture permission was withdrawn.")
                stopSelf()
            }
        }, mainHandler)

        recorder.startRecording()
        encoder.start()
        emitStatus("capturing", "Capturing eligible automation playback. If the app blocks capture, no programme audio will be received.")
        captureThread = Thread({ captureLoop(recorder, encoder) }, "JRadioPlaybackCapture").apply {
            isDaemon = true
            start()
        }
    }

    private fun captureLoop(recorder: AudioRecord, encoder: MediaCodec) {
        val pcm = ByteArray(8192)
        val info = MediaCodec.BufferInfo()
        var presentationTimeUs = 0L
        try {
            while (running.get()) {
                val read = recorder.read(pcm, 0, pcm.size)
                if (read <= 0) continue

                var inputIndex = encoder.dequeueInputBuffer(10000)
                if (inputIndex >= 0) {
                    val input = encoder.getInputBuffer(inputIndex)
                    if (input != null) {
                        input.clear()
                        val accepted = minOf(read, input.remaining())
                        input.put(pcm, 0, accepted)
                        val samples = accepted / 4 // 16-bit stereo
                        encoder.queueInputBuffer(inputIndex, 0, accepted, presentationTimeUs, 0)
                        presentationTimeUs += samples * 1_000_000L / 44100L
                    } else {
                        encoder.queueInputBuffer(inputIndex, 0, 0, presentationTimeUs, 0)
                    }
                }

                var outputIndex = encoder.dequeueOutputBuffer(info, 0)
                while (outputIndex >= 0) {
                    val output = encoder.getOutputBuffer(outputIndex)
                    if (output != null && info.size > 0 && (info.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG) == 0) {
                        output.position(info.offset)
                        output.limit(info.offset + info.size)
                        val payload = ByteArray(info.size)
                        output.get(payload)
                        emitAudio(addAdtsHeader(payload))
                    }
                    encoder.releaseOutputBuffer(outputIndex, false)
                    outputIndex = encoder.dequeueOutputBuffer(info, 0)
                }
            }
        } catch (error: Exception) {
            if (running.get()) {
                Log.e("JRadioCapture", "Playback capture loop failed", error)
                emitStatus("error", "Automation audio capture stopped: ${error.message}")
            }
        } finally {
            stopSelf()
        }
    }

    private fun addAdtsHeader(payload: ByteArray): ByteArray {
        val frameLength = payload.size + 7
        val header = byteArrayOf(
            0xFF.toByte(), 0xF1.toByte(),
            (((2 - 1) shl 6) or (4 shl 2) or (2 shr 2)).toByte(),
            (((2 and 3) shl 6) or (frameLength shr 11)).toByte(),
            ((frameLength and 0x7FF) shr 3).toByte(),
            (((frameLength and 7) shl 5) or 0x1F).toByte(),
            0xFC.toByte()
        )
        return header + payload
    }

    private fun emitAudio(bytes: ByteArray) {
        mainHandler.post { eventSink?.success(bytes) }
    }

    private fun emitStatus(status: String, message: String) {
        mainHandler.post { eventSink?.success(mapOf("status" to status, "message" to message)) }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "JRadio automation capture",
                NotificationManager.IMPORTANCE_LOW
            )
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }

    private fun buildNotification(): Notification {
        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL_ID)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
        }
        return builder
            .setContentTitle("JRadio Encoder is capturing automation")
            .setContentText("Eligible radio automation audio is being sent to your station.")
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setOngoing(true)
            .build()
    }

    override fun onDestroy() {
        running.set(false)
        try { audioRecord?.stop() } catch (_: Exception) {}
        try { audioRecord?.release() } catch (_: Exception) {}
        audioRecord = null
        try { codec?.stop() } catch (_: Exception) {}
        try { codec?.release() } catch (_: Exception) {}
        codec = null
        try { projection?.stop() } catch (_: Exception) {}
        projection = null
        captureThread = null
        emitStatus("stopped", "Automation audio capture stopped.")
        super.onDestroy()
    }
}
