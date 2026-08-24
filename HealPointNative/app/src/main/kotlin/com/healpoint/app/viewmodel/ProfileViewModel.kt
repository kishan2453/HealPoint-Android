package com.healpoint.app.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.healpoint.app.data.AppResult
import com.healpoint.app.data.SessionManager
import com.healpoint.app.data.repositories.AuthRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class ProfileActionState(
    val busy: Boolean = false,
    val error: String? = null,
    val message: String? = null,
)

/** Profile edits and password change. */
class ProfileViewModel(
    private val repo: AuthRepository,
    private val session: SessionManager,
) : ViewModel() {

    private val _action = MutableStateFlow(ProfileActionState())
    val action = _action.asStateFlow()

    fun updateProfile(fields: Map<String, String>, imageUri: String?, onDone: () -> Unit = {}) {
        val userId = session.userId() ?: return
        if (fields.isEmpty() && imageUri.isNullOrBlank()) return
        viewModelScope.launch {
            _action.update { it.copy(busy = true, error = null, message = null) }
            when (val result = repo.updateProfile(userId, fields, imageUri)) {
                is AppResult.Success -> {
                    session.saveUser(result.data)
                    _action.update { it.copy(busy = false, message = "Profile updated successfully.") }
                    onDone()
                }
                is AppResult.Failure -> _action.update { it.copy(busy = false, error = result.error.message) }
            }
        }
    }

    fun changePassword(oldPassword: String, newPassword: String, onDone: () -> Unit = {}) {
        val userId = session.userId() ?: return
        viewModelScope.launch {
            _action.update { it.copy(busy = true, error = null, message = null) }
            when (val result = repo.updatePassword(userId, oldPassword, newPassword)) {
                is AppResult.Success -> {
                    _action.update { it.copy(busy = false, message = result.data) }
                    onDone()
                }
                is AppResult.Failure -> _action.update { it.copy(busy = false, error = result.error.message) }
            }
        }
    }

    fun clearTransient() {
        _action.update { it.copy(error = null, message = null) }
    }
}