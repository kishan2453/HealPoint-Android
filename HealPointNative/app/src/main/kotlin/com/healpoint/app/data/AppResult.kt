package com.healpoint.app.data

import retrofit2.HttpException
import org.json.JSONObject
import java.io.IOException

/** Unified result type used by every repository. */
sealed class AppResult<out T> {
    data class Success<T>(val data: T) : AppResult<T>()
    data class Failure(val error: ApiError) : AppResult<Nothing>()

    inline fun onSuccess(action: (T) -> Unit): AppResult<T> {
        if (this is Success) action(data)
        return this
    }

    inline fun onFailure(action: (ApiError) -> Unit): AppResult<T> {
        if (this is Failure) action(error)
        return this
    }
}

enum class ApiErrorCategory {
    NETWORK,
    TIMEOUT,
    UNAUTHORIZED,
    FORBIDDEN,
    NOT_FOUND,
    VALIDATION,
    SERVER,
    UNKNOWN,
}

data class ApiError(
    val message: String,
    val category: ApiErrorCategory,
    val httpCode: Int = 0,
)

/** Converts any exception thrown by a Retrofit suspend call into a user-safe [ApiError]. */
fun exceptionToError(error: Throwable): ApiError = when (error) {
    is HttpException -> parseHttpError(error)
    is IOException -> ApiError(
        message = "Unable to reach the server. Check your internet connection and try again.",
        category = ApiErrorCategory.NETWORK,
    )
    else -> ApiError(
        message = error.message ?: "Something went wrong. Please try again.",
        category = ApiErrorCategory.UNKNOWN,
    )
}

private fun parseHttpError(error: HttpException): ApiError {
    val status = error.code()

    var serverMessage: String? = null
    try {
        val body = error.response()?.errorBody()?.string()
        if (!body.isNullOrBlank()) {
            serverMessage = JSONObject(body).optString("message").takeIf { it.isNotBlank() }
        }
    } catch (_: Exception) {
        // Body parsing is best-effort.
    }

    val category = when (status) {
        401 -> ApiErrorCategory.UNAUTHORIZED
        403 -> ApiErrorCategory.FORBIDDEN
        404 -> ApiErrorCategory.NOT_FOUND
        422 -> ApiErrorCategory.VALIDATION
        in 400..499 -> ApiErrorCategory.VALIDATION
        in 500..599 -> ApiErrorCategory.SERVER
        else -> ApiErrorCategory.UNKNOWN
    }

    val fallback = when (status) {
        401 -> "Your session has expired. Please login again."
        403 -> "You do not have permission to perform this action."
        404 -> "The requested resource was not found."
        in 500..599 -> "Something went wrong on the server. Please try again later."
        else -> "Your request could not be processed. Please check your details."
    }

    return ApiError(message = serverMessage ?: fallback, category = category, httpCode = status)
}
