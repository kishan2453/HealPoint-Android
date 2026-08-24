package com.healpoint.app.data.remote

import com.healpoint.app.data.SessionManager
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

/**
 * HTTP client factory. Wires OkHttp (timeouts, Bearer token injection,
 * logging) into Retrofit. All repositories talk to the backend through this.
 */
object ApiClient {

    private const val CONNECT_TIMEOUT_MS = 20_000L
    private const val READ_TIMEOUT_MS = 20_000L
    private const val WRITE_TIMEOUT_MS = 20_000L

    fun create(sessionManager: SessionManager): ApiService {
        val logging = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BASIC
        }

        val client = OkHttpClient.Builder()
            .connectTimeout(CONNECT_TIMEOUT_MS, TimeUnit.MILLISECONDS)
            .readTimeout(READ_TIMEOUT_MS, TimeUnit.MILLISECONDS)
            .writeTimeout(WRITE_TIMEOUT_MS, TimeUnit.MILLISECONDS)
            .addInterceptor { chain ->
                val original = chain.request()
                val token = sessionManager.token
                val request = if (token.isNullOrBlank()) {
                    original
                } else {
                    original.newBuilder()
                        .header("Authorization", "Bearer $token")
                        .build()
                }
                chain.proceed(request)
            }
            .addInterceptor(logging)
            .build()

        return Retrofit.Builder()
            .baseUrl(ApiConfig.baseUrl)
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(ApiService::class.java)
    }
}
