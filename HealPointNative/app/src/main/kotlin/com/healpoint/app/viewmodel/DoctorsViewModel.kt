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

/** Doctor catalog list (search + department filter) + server-backed favorites. */
class DoctorsViewModel(
    private val repo: DoctorRepository,
    private val authRepo: AuthRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(UiState<List<DoctorDto>>())
    val state = _state.asStateFlow()

    private val _query = MutableStateFlow("")
    val query = _query.asStateFlow()

    private val _department = MutableStateFlow<String?>(null)

    private val _favoriteIds = MutableStateFlow<Set<String>>(emptySet())
    val favoriteIds = _favoriteIds.asStateFlow()

    init {
        load()
        refreshFavorites()
    }

    fun load() {
        viewModelScope.launch {
            _state.update { it.loading(true) }
            when (val result = repo.getDoctors(search = _query.value, department = _department.value)) {
                is AppResult.Success -> _state.update { it.withData(result.data) }
                is AppResult.Failure -> _state.update { it.failed(result.error.message) }
            }
        }
    }

    fun setQuery(value: String) {
        _query.value = value
    }

    fun setDepartment(value: String?) {
        _department.value = value
        load()
    }

    fun departments(): List<String> =
        _state.value.data.orEmpty().mapNotNull { it.department }.filter { it.isNotBlank() }.distinct()

    fun refreshFavorites() {
        viewModelScope.launch {
            when (val result = authRepo.getFavoriteIds()) {
                is AppResult.Success -> _favoriteIds.update { result.data.toSet() }
                is AppResult.Failure -> Unit
            }
        }
    }

    fun toggleFavorite(doctorId: String) {
        viewModelScope.launch {
            val wasFavorite = _favoriteIds.value.contains(doctorId)
            _favoriteIds.update { current ->
                val next = current.toMutableSet()
                if (wasFavorite) next.remove(doctorId) else next.add(doctorId)
                next
            }
            val result = if (wasFavorite) authRepo.removeFavorite(doctorId) else authRepo.addFavorite(doctorId)
            result.onFailure {
                // Roll back to the server truth.
                _favoriteIds.update { current ->
                    val next = current.toMutableSet()
                    if (wasFavorite) next.add(doctorId) else next.remove(doctorId)
                    next
                }
            }
        }
    }
}