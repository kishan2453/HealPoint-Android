package com.healpoint.app.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.healpoint.app.data.AppResult
import com.healpoint.app.data.repositories.SettingsRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class SettingsUiState(
    val isLoading: Boolean = false,
    val guideVideoUrl: String? = null,
    val error: String? = null,
)

/** Platform settings (guide video from /settings/public). */
class SettingsViewModel(private val repo: SettingsRepository) : ViewModel() {

    private val _state = MutableStateFlow(SettingsUiState())
    val state = _state.asStateFlow()

    init {
        load()
    }

    fun load() {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, error = null) }
            when (val result = repo.getPublicSettings()) {
                is AppResult.Success -> _state.update { it.copy(isLoading = false, guideVideoUrl = result.data) }
                is AppResult.Failure -> _state.update { it.copy(isLoading = false, error = result.error.message) }
            }
        }
    }
}