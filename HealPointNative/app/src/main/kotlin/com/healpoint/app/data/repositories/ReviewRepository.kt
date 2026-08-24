package com.healpoint.app.data.repositories

import com.healpoint.app.data.ApiError
import com.healpoint.app.data.ApiErrorCategory
import com.healpoint.app.data.AppResult
import com.healpoint.app.data.exceptionToError
import com.healpoint.app.data.remote.ApiService
import com.healpoint.app.data.remote.dto.CreateReviewRequest
import com.healpoint.app.data.remote.dto.ReviewDto

/** Reviews repository. Creating requires auth; reading public reviews does not. */
class ReviewRepository(private val api: ApiService) {

    suspend fun createReview(
        doctorId: String,
        rating: Int,
        comment: String,
        name: String? = null,
        email: String? = null,
    ): AppResult<ReviewDto> {
        return try {
            val res = api.createReview(
                CreateReviewRequest(
                    doctorId = doctorId,
                    name = name,
                    email = email,
                    rating = rating,
                    title = null,
                    comment = comment,
                    avatar = null,
                )
            )
            val review = res.review
                ?: return AppResult.Failure(ApiError("Unable to submit your review.", ApiErrorCategory.UNKNOWN))
            AppResult.Success(review)
        } catch (e: Throwable) {
            AppResult.Failure(exceptionToError(e))
        }
    }

    suspend fun getPublicReviews(): AppResult<List<ReviewDto>> {
        return try {
            val res = api.getPublicReviews()
            AppResult.Success(res.reviews ?: emptyList())
        } catch (e: Throwable) {
            AppResult.Failure(exceptionToError(e))
        }
    }
}
