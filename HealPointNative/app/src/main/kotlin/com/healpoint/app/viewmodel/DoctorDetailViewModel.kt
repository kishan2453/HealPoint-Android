package com.healpoint.app.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.healpoint.app.data.AppResult
import com.healpoint.app.data.remote.dto.DoctorDto
import com.healpoint.app.data.repositories.AuthRepository
import com.healpoint.app.data.repositories.DoctorRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class DoctorDetailUiState(
    val doctor: DoctorDto? = null,
    val isLoading: Boolean = false,
    val error: String? = null,
    val isFavorite: Boolean = false,
    val togglingFavorite: Boolean = false,
)

/** Doctor profile with real catalog data + server-backed favorite toggle. */
class DoctorDetailViewModel(
    private val doctorRepo: DoctorRepository,
    private val authRepo: AuthRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(DoctorDetailUiState())
    val state = _state.asStateFlow()

    fun load(doctorId: String) {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, error = null) }
            when (val result = doctorRepo.getDoctorDetails(doctorId)) {
                is AppResult.Success -> {
                    _state.update { it.copy(doctor = result.data, isLoading = false) }
                    loadFavorite(doctorId)
                }
                is AppResult.Failure -> _state.update { it.copy(isLoading = false, error = result.error.message) }
            }
        }
    }

    fun toggleFavorite(doctorId: String) {
        if (_state.value.togglingFavorite) return
        viewModelScope.launch {
            _state.update { it.copy(togglingFavorite = true) }
            val wasFavorite = _state.value.isFavorite
            _state.update { it.copy(isFavorite = !wasFavorite) }
            val result = if (wasFavorite) authRepo.removeFavorite(doctorId) else authRepo.addFavorite(doctorId)
            result.onFailure {
                _state.update { it.copy(isFavorite = wasFavorite) }
            }
            _state.update { it.copy(togglingFavorite = false) }
        }
    }

    private fun loadFavorite(doctorId: String) {
        viewModelScope.launch {
            when (val result = authRepo.getFavoriteIds()) {
                is AppResult.Success -> _state.update { it.copy(isFavorite = result.data.contains(doctorId)) }
                is AppResult.Failure -> Unit
            }
        }
    }
}