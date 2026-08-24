package com.healpoint.app.ui.components

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import coil.compose.AsyncImage
import com.healpoint.app.util.ImageUtils

/**
 * Loads an image that may be either an https URL or a base64 data URI (both are
 * returned by the backend). URLs go through Coil; data URIs are decoded to a
 * Bitmap directly.
 */
@Composable
fun RemoteImage(
    url: String?,
    modifier: Modifier = Modifier,
    contentScale: ContentScale = ContentScale.Crop,
) {
    val source = url?.trim()
    if (source.isNullOrBlank()) {
        Box(modifier = modifier.background(MaterialTheme.colorScheme.surfaceVariant))
        return
    }
    if (ImageUtils.isDataUri(source)) {
        val bitmap = remember(source) { ImageUtils.decodeDataUri(source) }
        if (bitmap != null) {
            Image(
                bitmap = bitmap.asImageBitmap(),
                contentDescription = null,
                modifier = modifier,
                contentScale = contentScale,
            )
        } else {
            Box(modifier = modifier.background(MaterialTheme.colorScheme.surfaceVariant))
        }
    } else {
        AsyncImage(
            model = source,
            contentDescription = null,
            modifier = modifier,
            contentScale = contentScale,
        )
    }
}
