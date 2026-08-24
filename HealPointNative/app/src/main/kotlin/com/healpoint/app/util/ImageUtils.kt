package com.healpoint.app.util

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Base64

/**
 * Image helpers mirroring the web/RN client: stored images are either https
 * URLs or raw base64 strings from the backend. This resolves both.
 */
object ImageUtils {

    fun isDataUri(value: String?): Boolean =
        value?.trim()?.startsWith("data:") == true

    fun isHttpUrl(value: String?): Boolean =
        value?.trim()?.startsWith("https://") == true || value?.trim()?.startsWith("http://") == true

    /** Decodes a `data:image/...;base64,....` URI (or a raw base64 string) into a Bitmap. */
    fun decodeDataUri(dataUri: String): Bitmap? {
        return try {
            val trimmed = dataUri.trim()
            val comma = trimmed.indexOf(',')
            val base64 = if (comma >= 0) trimmed.substring(comma + 1) else trimmed
            val bytes = Base64.decode(base64, Base64.DEFAULT)
            BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
        } catch (_: Exception) {
            null
        }
    }
}
