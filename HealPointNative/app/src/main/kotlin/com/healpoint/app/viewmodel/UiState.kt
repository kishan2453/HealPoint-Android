package com.healpoint.app.viewmodel

/** Generic loading/data/error state used by list-style screens. */
data class UiState<T>(
    val isLoading: Boolean = false,
    val data: T? = null,
    val error: String? = null,
) {
    val hasContent: Boolean get() = data != null

    fun loading(newLoading: Boolean): UiState<T> = copy(isLoading = newLoading)
    fun withData(newData: T): UiState<T> = copy(data = newData, error = null, isLoading = false)
    fun failed(message: String): UiState<T> = copy(error = message, isLoading = false)
}