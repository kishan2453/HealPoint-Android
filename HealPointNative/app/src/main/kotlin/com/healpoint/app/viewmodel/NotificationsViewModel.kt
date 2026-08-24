package com.healpoint.app.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.healpoint.app.data.AppResult
import com.healpoint.app.data.remote.dto.NotificationDto
import com.healpoint.app.data.repositories.NotificationRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class NotificationsUiState(
    val isLoading: Boolean = false,
    val error: String? = null,
    val notifications: List<NotificationDto> = emptyList(),
    val unreadCount: Int = 0,
)

/** Notifications list + mark-read actions. Also used for the home badge. */
class NotificationsViewModel(private val repo: NotificationRepository) : ViewModel() {

    private val _state = MutableStateFlow(NotificationsUiState())
    val state = _state.asStateFlow()

    fun load() {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, error = null) }
            when (val result = repo.getNotifications(limit = null)) {
                is AppResult.Success -> {
                    _state.update {
                        it.copy(
                            isLoading = false,
                            notifications = result.data,
                            unreadCount = result.data.count { notif -> notif.isRead != true },
                        )
                    }
                }
                is AppResult.Failure -> _state.update { it.copy(isLoading = false, error = result.error.message) }
            }
        }
    }

    fun refreshUnreadCount() {
        viewModelScope.launch {
            when (val result = repo.getUnreadCount()) {
                is AppResult.Success -> _state.update { it.copy(unreadCount = result.data) }
                is AppResult.Failure -> Unit
            }
        }
    }

    fun markRead(id: String) {
        viewModelScope.launch {
            repo.markRead(id).onSuccess {
                load()
            }
        }
    }

    fun markAllRead() {
        viewModelScope.launch {
            repo.markAllRead().onSuccess {
                load()
            }
        }
    }

    fun delete(id: String) {
        viewModelScope.launch {
            repo.delete(id).onSuccess {
                load()
            }
        }
    }
}