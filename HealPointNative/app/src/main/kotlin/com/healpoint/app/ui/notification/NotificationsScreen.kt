package com.healpoint.app.ui.notification

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.NotificationsNone
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavHostController
import com.healpoint.app.data.remote.dto.NotificationDto
import com.healpoint.app.ui.components.AppHeader
import com.healpoint.app.ui.components.EmptyState
import com.healpoint.app.ui.components.ErrorState
import com.healpoint.app.ui.components.LoadingState
import com.healpoint.app.ui.navigation.appViewModel
import com.healpoint.app.ui.theme.Primary
import com.healpoint.app.viewmodel.NotificationsViewModel

/** Notifications list. Tapping an unread one marks it read. */
@Composable
fun NotificationsScreen(navController: NavHostController) {
    val vm: NotificationsViewModel = appViewModel()
    val state by vm.state.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { vm.load() }

    Column(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        AppHeader(
            title = "Notifications",
            onBack = { navController.popBackStack() },
            actions = {
                if (state.unreadCount > 0) {
                    TextButton(onClick = { vm.markAllRead() }) { Text("Mark all read") }
                }
            },
        )

        when {
            state.isLoading -> LoadingState("Loading notifications...", Modifier.fillMaxWidth().weight(1f))
            state.error != null -> ErrorState(state.error.orEmpty(), onRetry = { vm.load() }, modifier = Modifier.fillMaxWidth().weight(1f))
            state.notifications.isEmpty() -> EmptyState("No notifications", "You're all caught up!", Modifier.fillMaxWidth().weight(1f), icon = Icons.Outlined.NotificationsNone)
            else -> LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                items(state.notifications, key = { it.id ?: it.toString() }) { notification ->
                    NotificationItem(
                        notification = notification,
                        onClick = { if (notification.isRead != true) notification.id?.let { vm.markRead(it) } },
                    )
                }
            }
        }
    }
}

@Composable
private fun NotificationItem(notification: NotificationDto, onClick: () -> Unit) {
    val unread = notification.isRead != true
    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (unread) MaterialTheme.colorScheme.surfaceVariant else MaterialTheme.colorScheme.surface,
        ),
    ) {
        Row(modifier = Modifier.padding(16.dp), verticalAlignment = Alignment.Top) {
            Box(
                modifier = Modifier.size(8.dp).clip(RoundedCornerShape(4.dp)),
            ) {
                if (unread) {
                    Box(
                        modifier = Modifier.fillMaxSize().background(Primary).clip(RoundedCornerShape(4.dp)),
                        contentAlignment = Alignment.Center,
                    )
                }
            }
            Column(modifier = Modifier.weight(1f).padding(start = 12.dp)) {
                Text(notification.title ?: "Notification", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                Text(notification.message.orEmpty(), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}