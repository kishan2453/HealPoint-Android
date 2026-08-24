# HealPoint - ProGuard / R8 rules

# Retrofit
-keepattributes Signature, InnerClasses, EnclosingMethod, *Annotation*
-keepclassmembers,allowshrinking,allowobfuscation interface * {
    @retrofit2.http.* <methods>;
}
-keep,allowobfuscation,allowshrinking class retrofit2.Response
-dontwarn retrofit2.**
-keepclassmembers class * extends retrofit2.Converter.Factory { *; }

# Gson
-keepattributes Signature
-keep class com.healpoint.app.data.remote.dto.** { *; }
-keepclassmembers class com.healpoint.app.data.remote.dto.** { *; }

# OkHttp
-dontwarn okhttp3.**
-dontwarn okio.**

# Coroutines
-dontwarn kotlinx.coroutines.**

# Coil
-dontwarn coil.**
