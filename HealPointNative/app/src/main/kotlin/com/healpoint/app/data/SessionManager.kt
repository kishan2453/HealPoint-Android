package com.healpoint.app.data

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.healpoint.app.data.remote.dto.UserDto
import com.google.gson.Gson

/**
 * Secure session storage. The JWT and the cached user profile live in
 * EncryptedSharedPreferences (AES-256) so they survive app restarts without
 * ever being written in plain text. No secrets ever reach the client logs.
 */
class SessionManager(context: Context) {

    private val gson = Gson()

    private val prefs: SharedPreferences = run {
        val masterKey = MasterKey.Builder(context.applicationContext)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        EncryptedSharedPreferences.create(
            context.applicationContext,
            "healpoint_secure_session",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    }

    val token: String?
        get() = prefs.getString(KEY_TOKEN, null)

    val user: UserDto?
        get() {
            val json = prefs.getString(KEY_USER, null) ?: return null
            return try {
                gson.fromJson(json, UserDto::class.java)
            } catch (_: Exception) {
                null
            }
        }

    fun saveAuth(newToken: String, newUser: UserDto) {
        prefs.edit()
            .putString(KEY_TOKEN, newToken)
            .putString(KEY_USER, gson.toJson(newUser))
            .apply()
    }

    fun saveUser(newUser: UserDto) {
        prefs.edit().putString(KEY_USER, gson.toJson(newUser)).apply()
    }

    fun clear() {
        prefs.edit().remove(KEY_TOKEN).remove(KEY_USER).apply()
    }

    fun userId(): String? = user?.id

    companion object {
        private const val KEY_TOKEN = "healpoint.auth.token"
        private const val KEY_USER = "healpoint.auth.user"
    }
}
