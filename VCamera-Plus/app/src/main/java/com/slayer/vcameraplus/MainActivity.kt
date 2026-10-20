package com.slayer.vcameraplus

import android.app.Activity
import android.net.Uri
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.VideoView
import android.widget.ImageView
import android.widget.MediaController
import android.widget.Toast
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import androidx.activity.result.contract.ActivityResultContracts

class MainActivity : Activity() {
    private lateinit var root: LinearLayout
    private lateinit var previewFrame: LinearLayout
    private lateinit var imagePreview: ImageView
    private lateinit var videoPreview: VideoView
    private lateinit var statusText: TextView
    private var selectedVideo: Boolean = false
    private var selectedUri: Uri? = null
    private var loopVideo: Boolean = true
    private var rotationDegrees: Float = 0f

    private val pickImage = registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri != null) showImage(uri)
    }
    private val pickVideo = registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri != null) showVideo(uri)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = Color.rgb(12, 14, 24)
        window.navigationBarColor = Color.rgb(12, 14, 24)
        buildUi()
    }

    private fun buildUi() {
        val page = ScrollView(this).apply {
            setBackgroundColor(Color.rgb(12, 14, 24))
            isFillViewport = true
        }
        root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(26), dp(20), dp(30))
        }
        page.addView(root)
        setContentView(page)

        val brand = label("VCAMERA PLUS", 13f, Color.rgb(143, 130, 255), true)
        brand.letterSpacing = 0.12f
        root.addView(brand)
        root.addView(label("Your media studio", 29f, Color.WHITE, true).also {
            it.setPadding(0, dp(8), 0, dp(5))
        })
        root.addView(label(
            "Choose a local image or video, preview it, and control playback. This starter app does not replace the camera feed inside other apps.",
            14f, Color.rgb(180, 186, 205), false
        ).also { it.setPadding(0, 0, 0, dp(18)) })

        previewFrame = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(dp(12), dp(12), dp(12), dp(12))
            background = rounded(Color.rgb(24, 28, 46), 22)
        }
        imagePreview = ImageView(this).apply {
            adjustViewBounds = true
            scaleType = ImageView.ScaleType.FIT_CENTER
            visibility = View.GONE
        }
        videoPreview = VideoView(this).apply { visibility = View.GONE }
        statusText = label("No media selected\n\nChoose an image or video to preview it here.", 15f,
            Color.rgb(194, 199, 218), false).apply {
            gravity = Gravity.CENTER
            setPadding(dp(12), dp(24), dp(12), dp(24))
        }
        previewFrame.addView(statusText, LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, dp(220)
        ))
        previewFrame.addView(imagePreview, LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, dp(280)
        ))
        previewFrame.addView(videoPreview, LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, dp(280)
        ))
        root.addView(previewFrame, matchWrap().apply { bottomMargin = dp(18) })

        root.addView(label("MEDIA SOURCE", 12f, Color.rgb(143, 130, 255), true).also {
            it.setPadding(0, 0, 0, dp(10))
        })
        root.addView(actionButton("Choose image") { pickImage.launch("image/*") }, matchWrap())
        root.addView(actionButton("Choose video") { pickVideo.launch("video/*") }, matchWrap().apply {
            topMargin = dp(10)
        })
        root.addView(actionButton("Play / pause video") {
            if (!selectedVideo || selectedUri == null) toast("Choose a video first")
            else if (videoPreview.isPlaying) videoPreview.pause() else videoPreview.start()
        }, matchWrap().apply { topMargin = dp(10) })

        root.addView(label("PREVIEW CONTROLS", 12f, Color.rgb(143, 130, 255), true).also {
            it.setPadding(0, dp(24), 0, dp(10))
        })
        root.addView(actionButton(if (loopVideo) "Video loop: ON" else "Video loop: OFF") {
            loopVideo = !loopVideo
            (it as Button).text = if (loopVideo) "Video loop: ON" else "Video loop: OFF"
            if (selectedVideo && selectedUri != null) showVideo(selectedUri!!)
        }, matchWrap())
        root.addView(actionButton("Rotate preview 90°") {
            rotationDegrees = (rotationDegrees + 90f) % 360f
            imagePreview.rotation = rotationDegrees
            videoPreview.rotation = rotationDegrees
            toast("Preview rotation: " + rotationDegrees.toInt() + "°")
        }, matchWrap().apply { topMargin = dp(10) })
        root.addView(actionButton("Reset preview") {
            rotationDegrees = 0f
            imagePreview.rotation = 0f
            videoPreview.rotation = 0f
            if (selectedVideo && selectedUri != null) showVideo(selectedUri!!)
            else if (selectedUri != null) showImage(selectedUri!!)
            else resetPreview()
        }, matchWrap().apply { topMargin = dp(10) })

        root.addView(label("APP WORKSPACE", 12f, Color.rgb(143, 130, 255), true).also {
            it.setPadding(0, dp(24), 0, dp(10))
        })
        val info = label(
            "Parallel Space-style app cloning is not included in this first build. Android does not expose a universal public API to clone any installed app. The next stage can explore supported work profiles and multi-user options.",
            14f, Color.rgb(180, 186, 205), false
        )
        info.setPadding(dp(14), dp(14), dp(14), dp(14))
        info.background = rounded(Color.rgb(24, 28, 46), 16)
        root.addView(info, matchWrap())
        root.addView(label("Privacy-first • Local media picker • No account required", 12f,
            Color.rgb(133, 141, 164), false).also {
            it.gravity = Gravity.CENTER
            it.setPadding(0, dp(22), 0, 0)
        })
    }

    private fun showImage(uri: Uri) {
        selectedUri = uri
        selectedVideo = false
        videoPreview.stopPlayback()
        videoPreview.visibility = View.GONE
        statusText.visibility = View.GONE
        imagePreview.visibility = View.VISIBLE
        imagePreview.setImageURI(uri)
        imagePreview.rotation = rotationDegrees
    }

    private fun showVideo(uri: Uri) {
        selectedUri = uri
        selectedVideo = true
        imagePreview.setImageDrawable(null)
        imagePreview.visibility = View.GONE
        statusText.visibility = View.GONE
        videoPreview.visibility = View.VISIBLE
        videoPreview.setVideoURI(uri)
        videoPreview.setMediaController(MediaController(this).apply { setAnchorView(videoPreview) })
        videoPreview.setOnPreparedListener { player ->
            player.isLooping = loopVideo
            videoPreview.rotation = rotationDegrees
        }
        videoPreview.setOnErrorListener { _, _, _ ->
            toast("This video could not be played on this device")
            true
        }
        videoPreview.start()
    }

    private fun resetPreview() {
        selectedUri = null
        selectedVideo = false
        videoPreview.stopPlayback()
        videoPreview.visibility = View.GONE
        imagePreview.setImageDrawable(null)
        imagePreview.visibility = View.GONE
        statusText.visibility = View.VISIBLE
        statusText.text = "No media selected\n\nChoose an image or video to preview it here."
    }

    private fun actionButton(title: String, action: (View) -> Unit): Button =
        Button(this).apply {
            text = title
            isAllCaps = false
            textSize = 15f
            setTextColor(Color.WHITE)
            background = rounded(Color.rgb(89, 75, 210), 14)
            setPadding(dp(14), dp(10), dp(14), dp(10))
            setOnClickListener(action)
            minimumHeight = dp(52)
        }

    private fun label(text: String, size: Float, color: Int, bold: Boolean): TextView =
        TextView(this).apply {
            this.text = text
            textSize = size
            setTextColor(color)
            if (bold) setTypeface(typeface, Typeface.BOLD)
            gravity = Gravity.START
            setLineSpacing(dp(3).toFloat(), 1f)
        }

    private fun rounded(color: Int, radiusDp: Int): GradientDrawable =
        GradientDrawable().apply {
            setColor(color)
            cornerRadius = dp(radiusDp).toFloat()
        }

    private fun matchWrap() = LinearLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT
    )
    private fun dp(value: Int): Int = (value * resources.displayMetrics.density + 0.5f).toInt()
    private fun toast(message: String) = Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
}
