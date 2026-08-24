package com.healpoint.app.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.healpoint.app.data.ApiErrorCategory
import com.healpoint.app.data.AppResult
import com.healpoint.app.data.SessionManager
import com.healpoint.app.data.remote.dto.UserDto
import com.healpoint.app.data.repositories.AuthRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class AuthUiState(
    val isRestoring: Boolean = true,
    val isAuthenticated: Boolean = false,
    val user: UserDto? = null,
    val busy: Boolean = false,
    val error: String? = null,
    val message: String? = null,
)

/**
 * Owns the JWT + cached user, restores the persisted session on startup and
 * drives login / register / logout. Navigation reacts to [AuthUiState.isAuthenticated].
 */
class AuthViewModel(
    private val repo: AuthRepository,
    private val session: SessionManager,
) : ViewModel() {

    private val _state = MutableStateFlow(AuthUiState())
    val state = _state.asStateFlow()

    init {
        restoreSession()
    }

    private fun restoreSession() {
        viewModelScope.launch {
            val token = session.token
            val user = session.user
            if (token.isNullOrBlank() || user == null) {
                _state.update { it.copy(isAuthenticated = false, isRestoring = false) }
                return@launch
            }
            _state.update { it.copy(user = user) }
            // Revalidate the token against the server in the background.
            when (val result = repo.getProfile(user.requiredId())) {
                is AppResult.Success -> {
                    session.saveUser(result.data)
                    _state.update { it.copy(user = result.data, isAuthenticated = true, isRestoring = false) }
                }
                is AppResult.Failure -> {
                    if (result.error.category == ApiErrorCategory.UNAUTHORIZED) {
                        session.clear()
                        _state.update { it.copy(user = null, isAuthenticated = false, isRestoring = false) }
                    } else {
                        // Offline / server error: the valid cached session keeps working.
                        _state.update { it.copy(isAuthenticated = true, isRestoring = false) }
                    }
                }
            }
        }
    }

    fun login(email: String, password: String) {
        viewModelScope.launch {
            _state.update { it.copy(busy = true, error = null, message = null) }
            when (val result = repo.login(email, password)) {
                is AppResult.Success -> {
                    _state.update { it.copy(busy = false, user = result.data, isAuthenticated = true, error = null) }
                }
                is AppResult.Failure -> {
                    _state.update { it.copy(busy = false, error = result.error.message) }
                }
            }
        }
    }

    fun register(name: String, email: String, password: String) {
        viewModelScope.launch {
            _state.update { it.copy(busy = true, error = null, message = null) }
            when (val result = repo.register(name, email, password)) {
                is AppResult.Success -> {
                    _state.update {
                        it.copy(busy = false, error = null, message = "Registration successful! Please login to continue.")
                    }
                }
                is AppResult.Failure -> {
                    _state.update { it.copy(busy = false, error = result.error.message) }
                }
            }
        }
    }

    fun logout() {
        viewModelScope.launch {
            repo.logout()
            _state.update { it.copy(user = null, isAuthenticated = false, error = null, message = null) }
        }
    }

    fun refreshProfile() {
        val userId = session.userId() ?: return
        viewModelScope.launch {
            when (val result = repo.getProfile(userId)) {
                is AppResult.Success -> {
                    session.saveUser(result.data)
                    _state.update { it.copy(user = result.data) }
                }
                is AppResult.Failure -> Unit
            }
        }
    }

    fun clearTransient() {
        _state.update { it.copy(error = null, message = null) }
    }

    fun forgotPassword(identifier: String, onDone: (String) -> Unit = {}) {
        viewModelScope.launch {
            _state.update { it.copy(busy = true, error = null, message = null) }
            when (val result = repo.forgotPassword(identifier)) {
                is AppResult.Success -> {
                    _state.update { it.copy(busy = false, message = result.data) }
                    onDone(identifier)
                }
                is AppResult.Failure -> _state.update { it.copy(busy = false, error = result.error.message) }
            }
        }
    }

    fun verifyOtp(identifier: String, otp: String, onDone: (String) -> Unit = {}) {
        viewModelScope.launch {
            _state.update { it.copy(busy = true, error = null, message = null) }
            when (val result = repo.verifyOtp(identifier, otp)) {
                is AppResult.Success -> {
                    _state.update { it.copy(busy = false) }
                    onDone(result.data)
                }
                is AppResult.Failure -> _state.update { it.copy(busy = false, error = result.error.message) }
            }
        }
    }

    fun resetPassword(resetToken: String, newPassword: String, onDone: () -> Unit = {}) {
        viewModelScope.launch {
            _state.update { it.copy(busy = true, error = null, message = null) }
            when (val result = repo.resetPassword(resetToken, newPassword)) {
                is AppResult.Success -> {
                    _state.update { it.copy(busy = false, message = result.data) }
                    onDone()
                }
                is AppResult.Failure -> _state.update { it.copy(busy = false, error = result.error.message) }
            }
        }
    }
}