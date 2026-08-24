package com.healpoint.app.data.repositories

import com.healpoint.app.data.ApiError
import com.healpoint.app.data.ApiErrorCategory
import com.healpoint.app.data.AppResult
import com.healpoint.app.data.SessionManager
import com.healpoint.app.data.exceptionToError
import com.healpoint.app.data.remote.ApiService
import com.healpoint.app.data.remote.dto.LoginRequest
import com.healpoint.app.data.remote.dto.RegisterRequest
import com.healpoint.app.data.remote.dto.ResetPasswordRequest
import com.healpoint.app.data.remote.dto.UpdatePasswordRequest
import com.healpoint.app.data.remote.dto.UserDto
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.RequestBody.Companion.toRequestBody

/**
 * Authentication & profile repository. Persists the session via
 * [SessionManager] on successful login so the app survives restarts.
 */
class AuthRepository(
    private val api: ApiService,
    private val session: SessionManager,
) {

    suspend fun login(email: String, password: String): AppResult<UserDto> {
        return try {
            val res = api.login(LoginRequest(email = email, password = password))
            val user = res.user
                ?: return AppResult.Failure(ApiError(res.message ?: "Login failed. Please try again.", ApiErrorCategory.VALIDATION))
            val token = res.token
                ?: return AppResult.Failure(ApiError("Login failed. No session token returned.", ApiErrorCategory.SERVER))
            session.saveAuth(token, user)
            AppResult.Success(user)
        } catch (e: Throwable) {
            AppResult.Failure(exceptionToError(e))
        }
    }

    suspend fun register(name: String, email: String, password: String): AppResult<UserDto> {
        return try {
            val res = api.register(RegisterRequest(name = name, email = email, password = password))
            val user = res.user
                ?: return AppResult.Failure(ApiError(res.message ?: "Registration failed. Please try again.", ApiErrorCategory.VALIDATION))
            AppResult.Success(user)
        } catch (e: Throwable) {
            AppResult.Failure(exceptionToError(e))
        }
    }

    suspend fun forgotPassword(identifier: String): AppResult<String> {
        return try {
            val res = api.forgotPassword(mapOf("identifier" to identifier))
            AppResult.Success(res.message ?: "If this account exists, an OTP has been sent to your email/phone.")
        } catch (e: Throwable) {
            AppResult.Failure(exceptionToError(e))
        }
    }

    suspend fun verifyOtp(identifier: String, otp: String): AppResult<String> {
        return try {
            val res = api.verifyOtp(mapOf("identifier" to identifier, "otp" to otp))
            val resetToken = res.resetToken
                ?: return AppResult.Failure(ApiError("Verification failed. Please try again.", ApiErrorCategory.VALIDATION))
            AppResult.Success(resetToken)
        } catch (e: Throwable) {
            AppResult.Failure(exceptionToError(e))
        }
    }

    suspend fun resetPassword(resetToken: String, newPassword: String): AppResult<String> {
        return try {
            val res = api.resetPassword(ResetPasswordRequest(resetToken = resetToken, newPassword = newPassword))
            AppResult.Success(res.message ?: "Password updated successfully.")
        } catch (e: Throwable) {
            AppResult.Failure(exceptionToError(e))
        }
    }

    suspend fun logout(): AppResult<Unit> {
        return try {
            api.logout()
            session.clear()
            AppResult.Success(Unit)
        } catch (e: Throwable) {
            // Logout is best-effort: clear the local session regardless.
            session.clear()
            AppResult.Failure(exceptionToError(e))
        }
    }

    suspend fun getProfile(userId: String): AppResult<UserDto> {
        return try {
            val res = api.getProfile(userId)
            val user = res.user
                ?: return AppResult.Failure(ApiError("Unable to load profile.", ApiErrorCategory.UNKNOWN))
            AppResult.Success(user)
        } catch (e: Throwable) {
            AppResult.Failure(exceptionToError(e))
        }
    }

    /** Updates the profile. [fields] holds only the changed plain-text fields. */
    suspend fun updateProfile(userId: String, fields: Map<String, String>, imageUri: String?): AppResult<UserDto> {
        return try {
            val body = buildProfileMultipart(fields, imageUri)
            val res = api.updateProfile(userId, body)
            val user = res.user
                ?: return AppResult.Failure(ApiError("Unable to update profile.", ApiErrorCategory.UNKNOWN))
            AppResult.Success(user)
        } catch (e: Throwable) {
            AppResult.Failure(exceptionToError(e))
        }
    }

    suspend fun updatePassword(userId: String, oldPassword: String, newPassword: String): AppResult<String> {
        return try {
            val res = api.updatePassword(userId, UpdatePasswordRequest(oldPassword = oldPassword, newPassword = newPassword))
            AppResult.Success(res.message ?: "Password updated successfully.")
        } catch (e: Throwable) {
            AppResult.Failure(exceptionToError(e))
        }
    }

    suspend fun getFavoriteIds(): AppResult<List<String>> {
        return try {
            val res = api.getFavorites()
            val ids = (res.favorites ?: emptyList()).mapNotNull { it.doctorId ?: it.id }.toSet().toList()
            AppResult.Success(ids)
        } catch (e: Throwable) {
            AppResult.Failure(exceptionToError(e))
        }
    }

    suspend fun addFavorite(doctorId: String): AppResult<Boolean> {
        return try {
            AppResult.Success(api.addFavorite(doctorId).isFavorite == true)
        } catch (e: Throwable) {
            AppResult.Failure(exceptionToError(e))
        }
    }

    suspend fun removeFavorite(doctorId: String): AppResult<Boolean> {
        return try {
            AppResult.Success(api.removeFavorite(doctorId).isFavorite == true)
        } catch (e: Throwable) {
            AppResult.Failure(exceptionToError(e))
        }
    }

    private fun buildProfileMultipart(fields: Map<String, String>, imageUri: String?): okhttp3.MultipartBody {
        val builder = okhttp3.MultipartBody.Builder().setType(okhttp3.MultipartBody.FORM)
        fields.forEach { (key, value) ->
            builder.addFormDataPart(key, value)
        }
        if (!imageUri.isNullOrBlank()) {
            val (fileName, mime) = mimeFor(imageUri)
            builder.addFormDataPart("image", fileName, imageUri.toRequestBody(mime.toMediaTypeOrNull()))
        }
        return builder.build()
    }

    private fun mimeFor(uri: String): Pair<String, String> {
        val lower = uri.lowercase()
        return when {
            lower.endsWith(".png") -> "profile.png" to "image/png"
            lower.endsWith(".webp") -> "profile.webp" to "image/webp"
            lower.endsWith(".gif") -> "profile.gif" to "image/gif"
            else -> "profile.jpg" to "image/jpeg"
        }
    }
}
