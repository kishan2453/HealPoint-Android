package com.healpoint.app.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.healpoint.app.data.AppResult
import com.healpoint.app.data.remote.dto.HospitalDto
import com.healpoint.app.data.repositories.HospitalRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class HospitalDetailUiState(
    val hospital: HospitalDto? = null,
    val isLoading: Boolean = false,
    val error: String? = null,
)

/** Single hospital profile. */
class HospitalDetailViewModel(private val repo: HospitalRepository) : ViewModel() {

    private val _state = MutableStateFlow(HospitalDetailUiState())
    val state = _state.asStateFlow()

    fun load(idOrSlug: String) {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, error = null) }
            when (val result = repo.getHospitalDetails(idOrSlug)) {
                is AppResult.Success -> _state.update { it.copy(hospital = result.data, isLoading = false) }
                is AppResult.Failure -> _state.update { it.copy(isLoading = false, error = result.error.message) }
            }
        }
    }
}