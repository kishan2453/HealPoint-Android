package com.healpoint.app.ui.components

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import com.healpoint.app.ui.theme.Primary

enum class HealPointButtonVariant { Filled, Outlined, Text }

/** Primary call-to-action button (filled/outlined/text) with loading support. */
@Composable
fun HealPointButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    variant: HealPointButtonVariant = HealPointButtonVariant.Filled,
    enabled: Boolean = true,
    loading: Boolean = false,
    icon: ImageVector? = null,
) {
    val shape = RoundedCornerShape(16.dp)
    val content: @Composable RowScope.() -> Unit = {
        if (loading) {
            CircularProgressIndicator(
                modifier = Modifier.size(22.dp),
                color = if (variant == HealPointButtonVariant.Filled) MaterialTheme.colorScheme.onPrimary else Primary,
                strokeWidth = 2.dp,
            )
        } else {
            if (icon != null) {
                Icon(icon, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
            }
            Text(text = text, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.SemiBold)
        }
    }

    when (variant) {
        HealPointButtonVariant.Filled -> Button(
            onClick = onClick,
            modifier = modifier.fillMaxWidth().height(52.dp),
            enabled = enabled && !loading,
            shape = shape,
            content = content,
        )

        HealPointButtonVariant.Outlined -> OutlinedButton(
            onClick = onClick,
            modifier = modifier.fillMaxWidth().height(52.dp),
            enabled = enabled && !loading,
            shape = shape,
            content = content,
        )

        HealPointButtonVariant.Text -> TextButton(
            onClick = onClick,
            modifier = modifier.fillMaxWidth().height(48.dp),
            enabled = enabled && !loading,
            content = content,
        )
    }
}

/** Outlined text field with label, error message, password toggle and icons. */
@Composable
fun HealPointTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    placeholder: String? = null,
    error: String? = null,
    keyboardType: KeyboardType = KeyboardType.Text,
    password: Boolean = false,
    leadingIcon: ImageVector? = null,
    enabled: Boolean = true,
    singleLine: Boolean = true,
) {
    var showPassword by remember { mutableStateOf(false) }

    Column(modifier = modifier.fillMaxWidth()) {
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            modifier = Modifier.fillMaxWidth(),
            label = { Text(label) },
            placeholder = placeholder?.let { { Text(it) } },
            isError = error != null,
            enabled = enabled,
            singleLine = singleLine,
            keyboardOptions = KeyboardOptions(
                keyboardType = if (password) KeyboardType.Password else keyboardType,
                imeAction = if (singleLine) ImeAction.Done else ImeAction.Default,
            ),
            visualTransformation = if (password && !showPassword) PasswordVisualTransformation() else VisualTransformation.None,
            shape = RoundedCornerShape(14.dp),
            leadingIcon = leadingIcon?.let { icon -> { Icon(icon, contentDescription = null) } },
            trailingIcon = if (password) {
                {
                    IconButton(onClick = { showPassword = !showPassword }) {
                        Icon(
                            if (showPassword) Icons.Filled.VisibilityOff else Icons.Filled.Visibility,
                            contentDescription = if (showPassword) "Hide password" else "Show password",
                        )
                    }
                }
            } else {
                null
            },
        )
        if (error != null) {
            Text(
                text = error,
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.labelSmall,
                modifier = Modifier.padding(start = 4.dp, top = 4.dp),
            )
        }
    }
}