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

/** Hospital catalog list. */
class HospitalsViewModel(private val repo: HospitalRepository) : ViewModel() {

    private val _state = MutableStateFlow(UiState<List<HospitalDto>>())
    val state = _state.asStateFlow()

    private val _query = MutableStateFlow("")
    val query = _query.asStateFlow()

    init {
        load()
    }

    fun load() {
        viewModelScope.launch {
            _state.update { it.loading(true) }
            when (val result = repo.getPublicHospitals()) {
                is AppResult.Success -> _state.update { it.withData(result.data) }
                is AppResult.Failure -> _state.update { it.failed(result.error.message) }
            }
        }
    }

    fun setQuery(value: String) {
        _query.value = value
    }
}