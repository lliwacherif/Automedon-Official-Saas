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
                    Bienvenue chez <strong>Automedon</strong>, votre partenaire de confiance pour la location de voitures à Sousse, Tunisie.
                </p>
                <p>
                    Nous nous engageons à vous offrir une expérience de conduite exceptionnelle grâce à notre flotte de véhicules modernes et bien entretenus. Que ce soit pour un voyage d'affaires, des vacances en famille ou simplement pour le plaisir de conduire, nous avons la voiture qu'il vous faut.
                </p>
                <p>
                    Transparence, fiabilité et satisfaction client sont au cœur de nos priorités. Profitez de nos tarifs compétitifs et de notre service clientèle dévoué pour prendre la route en toute sérénité.
                </p>
                <p class="mt-4 text-sm font-medium text-indigo-600">
                    {{ $t('about.visit_website') }} <a href="https://cherifcorp.com" target="_blank" class="underline hover:text-indigo-800">cherifcorp.com</a>
                </p>
            </div>


        </div>
    </div>
</template>
