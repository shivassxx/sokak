<?php

declare(strict_types=1);

/*
 * Initial content. Only facts supplied by the site owner are used here.
 * Everything else is editable from /admin.
 */

return [
    'settings' => [
        'hero_line_1'  => 'Fikirden ürüne.',
        'hero_line_2'  => 'AI ile daha hızlı.',
        'hero_text'    => 'Claude Code ve modern web teknolojileriyle fikirleri çalışan ürünlere dönüştürüyorum.',
        'intro_line_1' => 'Fikir.',
        'intro_line_2' => 'Ürün.',
        'intro_body'   => "Ben Çağrı. Kafamdaki fikirleri tarayıcıda çalışan, tıklanabilen, oynanabilen şeylere dönüştürmeyi seviyorum. Oyunlar, simülasyonlar, küçük araçlar.\n\nBenim için vibe coding, kodu tek başıma satır satır yazmak değil; Claude Code gibi AI kodlama ajanlarıyla birlikte düşünmek, denemek ve hızla yinelemek demek. Yönü ben veriyorum, kararları ben alıyorum, AI ile birlikte inşa ediyorum.\n\nBöyle çalışıyorum çünkü fikirle ürün arasındaki mesafe kısaldı. Bir akşam aklıma gelen şeyi aynı hafta denenebilir bir prototipe çevirebiliyorum. Bu sitede hem ortaya çıkanları hem de nasıl ortaya çıktıklarını paylaşıyorum.",
        'about_bio'    => "Ben Çağrı. Türkiye'de yaşıyorum ve yazılımı AI kodlama ajanlarıyla birlikte geliştiriyorum.\n\nBu bölümü yönetim panelinden kendi hikâyenle güncelleyebilirsin.",
        'about_vibe'   => "Vibe coding, fikri doğal dille tarif edip AI kodlama ajanlarıyla birlikte koda dönüştürmek demek. Ama işin kolay kısmı bu. Asıl iş; neyin doğru olduğunu anlamak, test etmek, yönlendirmek ve sonucu sahiplenmek.",
        'about_process'=> "1. **Fikir** — Önce neyin eğlenceli ya da işe yarar olduğunu netleştiriyorum.\n2. **Prototip** — Claude Code ile en küçük çalışan sürümü çıkarıyorum.\n3. **İterasyon** — Deniyorum, kırıyorum, düzeltiyorum. AI ile hızlı döngüler.\n4. **Sonuç** — Çalışan, paylaşılabilir bir ürün.",
        'about_tools'  => "Claude Code\nGit",
        'about_technologies' => "React\nTypeScript\nThree.js\nPHP\nSQLite\nWebGL\nNode.js\nAPI'ler",
        'about_focus'  => 'Şu anda PROJECT VANTA, Sokak Oyunları ve ChronosBox üzerinde çalışıyorum.',
        'location'     => 'Türkiye',
        'footer_statement' => 'AI ile birlikte yazılım geliştiren bir vibe coder.',
    ],

    'social_links' => [
        // URLs are intentionally empty: only links that exist are rendered. Fill in from /admin/settings.
        ['platform' => 'github', 'url' => '', 'sort_order' => 1],
        ['platform' => 'x',      'url' => '', 'sort_order' => 2],
        ['platform' => 'email',  'url' => '', 'sort_order' => 3],
    ],

    'projects' => [
        [
            'title'             => 'PROJECT VANTA',
            'slug'              => 'project-vanta',
            'short_description' => '2–6 oyunculu, tarayıcıda çalışan 3D kooperatif soruşturma gerilim oyunu.',
            'category'          => 'oyun',
            'status'            => 'gelistiriliyor',
            'technologies'      => ['Three.js', 'Colyseus', 'TypeScript', 'WebGL'],
            'is_featured'       => 1,
            'sort_order'        => 1,
        ],
        [
            'title'             => 'Sokak Oyunları',
            'slug'              => 'sokak-oyunlari',
            'short_description' => 'Türk mahalle oyunlarını tarayıcıya taşıyan çok oyunculu oyun projesi. İlk oyun: Saklambaç.',
            'category'          => 'oyun',
            'status'            => 'gelistiriliyor',
            // Taken from the project's own technical guide (sokak repo CLAUDE.md).
            'technologies'      => ['TypeScript', 'Three.js', 'Colyseus'],
            'is_featured'       => 1,
            'sort_order'        => 2,
        ],
        [
            'title'             => 'ChronosBox',
            'slug'              => 'chronosbox',
            'short_description' => 'WorldBox tarzında tanrı simülasyonu ve tarih simülasyonu.',
            'category'          => 'oyun',
            'status'            => 'gelistiriliyor',
            'technologies'      => ['TypeScript', 'WebGL2', 'ECS'],
            'is_featured'       => 1,
            'sort_order'        => 3,
        ],
    ],

    // Unpublished drafts, clearly marked as samples. They never appear publicly until edited and published.
    'build_logs' => [
        ['title' => "PROJECT VANTA'ya multiplayer altyapısı eklerken", 'slug' => 'project-vanta-multiplayer-altyapisi', 'project' => 'project-vanta'],
        ['title' => 'Bir fikri Three.js sahnesine dönüştürmek', 'slug' => 'bir-fikri-threejs-sahnesine-donusturmek', 'project' => null],
        ['title' => 'Saklambaç neden tarayıcıda çalışmalı?', 'slug' => 'saklambac-neden-tarayicida-calismali', 'project' => 'sokak-oyunlari'],
    ],
];
