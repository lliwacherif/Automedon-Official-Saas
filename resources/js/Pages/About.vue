<template>
    <div class="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
            <!-- Logo -->
            <div class="mb-10">
                <img src="/images/icon-automedon.png" alt="Automedon Logo" class="h-32 w-32 mx-auto object-contain" />
            </div>
            
            <!-- Title -->
            <h1 class="text-4xl font-extrabold text-gray-900 mb-6">Automedon</h1>
            
            <!-- Description -->
            <div class="space-y-6 text-xl text-gray-600 leading-relaxed">
                <p>
                    {{ $t('about.description') }}
                </p>
                <p class="mt-4 text-sm font-medium text-indigo-600">
                    {{ $t('about.visit_website') }} <a href="https://cherifcorp.com" target="_blank" class="underline hover:text-indigo-800">cherifcorp.com</a>
                </p>
            </div>


        </div>
    </div>
</template>
