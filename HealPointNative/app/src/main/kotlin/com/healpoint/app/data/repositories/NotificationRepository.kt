package com.healpoint.app.data.repositories

import com.healpoint.app.data.AppResult
import com.healpoint.app.data.exceptionToError
import com.healpoint.app.data.remote.ApiService
import com.healpoint.app.data.remote.dto.NotificationDto

/** Notifications repository (all endpoints require auth). */
class NotificationRepository(private val api: ApiService) {

    suspend fun getNotifications(limit: Int? = null): AppResult<List<NotificationDto>> {
        return try {
            val res = api.getNotifications(status = null, type = null, limit = limit)
            AppResult.Success(res.notifications ?: emptyList())
        } catch (e: Throwable) {
            AppResult.Failure(exceptionToError(e))
        }
    }

    suspend fun getUnreadCount(): AppResult<Int> {
        return try {
            val res = api.getNotifications(status = "unread", type = null, limit = null)
            AppResult.Success(res.unreadCount ?: 0)
        } catch (e: Throwable) {
            AppResult.Failure(exceptionToError(e))
        }
    }

    suspend fun markRead(id: String): AppResult<Unit> {
        return try {
            api.updateNotificationRead(id, mapOf("isRead" to true))
            AppResult.Success(Unit)
        } catch (e: Throwable) {
            AppResult.Failure(exceptionToError(e))
        }
    }

    suspend fun markAllRead(): AppResult<Unit> {
        return try {
            api.markAllNotificationsRead(mapOf("isRead" to true))
            AppResult.Success(Unit)
        } catch (e: Throwable) {
            AppResult.Failure(exceptionToError(e))
        }
    }

    suspend fun delete(id: String): AppResult<Unit> {
        return try {
            api.deleteNotification(id)
            AppResult.Success(Unit)
        } catch (e: Throwable) {
            AppResult.Failure(exceptionToError(e))
        }
    }
}
