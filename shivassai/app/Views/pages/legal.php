<?php
/** @var string $page */
// Plain, honest descriptions of what this site actually does. Editable here; review with a lawyer if needed.
$content = [
    'privacy' => [
        ['Ne topluyoruz?', 'Bu site hesap, reklam veya izleme (analytics) aracı kullanmaz. İletişim formunu doldurursan yazdığın isim, e-posta ve mesaj sana dönüş yapabilmek için saklanır.'],
        ['Nerede saklanıyor?', 'Form mesajları bu sitenin kendi sunucusundaki veritabanında tutulur ve üçüncü taraflarla paylaşılmaz.'],
        ['Ne kadar süre?', 'Mesajlar, ilgili konuşma bittikten sonra makul bir süre içinde silinir. Silinmesini istersen iletişim formundan yazman yeterli.'],
        ['Sunucu kayıtları', 'Güvenlik amacıyla (ör. spam ve kaba kuvvet girişimlerini sınırlamak) IP adresleri tek yönlü özetlenmiş (hash) biçimde kısa süreli tutulur.'],
    ],
    'kvkk' => [
        ['Veri sorumlusu', 'shivassai.com sitesinin sahibi Çağrı.'],
        ['İşlenen veriler', 'İletişim formu aracılığıyla paylaştığın ad, e-posta adresi ve mesaj içeriği.'],
        ['İşleme amacı', 'Sadece iletişim talebine yanıt vermek.'],
        ['Hukuki sebep', 'Talebin üzerine iletişim kurulması (6698 sayılı KVKK m.5/2-c ve açık rızan).'],
        ['Aktarım', 'Veriler üçüncü kişilere veya yurt dışına aktarılmaz.'],
        ['Hakların', 'KVKK m.11 kapsamındaki haklarını (bilgi talep etme, düzeltme, silme vb.) iletişim formu üzerinden kullanabilirsin.'],
    ],
    'cookies' => [
        ['Kullanılan çerezler', 'Bu site reklam veya takip çerezi kullanmaz.'],
        ['Oturum çerezi', 'İletişim formunu güvenli göndermek (CSRF koruması) ve yönetim paneline giriş için teknik olarak zorunlu tek bir oturum çerezi (shv_session) kullanılır. Tarayıcı kapanınca silinir.'],
        ['Tema tercihi', 'Koyu/açık tema seçimin çerezde değil, tarayıcının yerel depolamasında (localStorage) tutulur ve sunucuya gönderilmez.'],
    ],
][$page] ?? [];
?>
<section class="pb-[clamp(96px,11vw,160px)] pt-40 md:pt-48">
  <div class="wrap max-w-[1040px]">
    <p class="micro normal-case">~/shivassai/yasal</p>
    <h1 class="h-xl mt-6"><?= e(t("legal.{$page}.title")) ?></h1>
    <p class="micro mt-6">Son güncelleme: <?= e(format_date('2026-10-08')) ?></p>
    <dl class="mt-14 border-b border-line">
      <?php foreach ($content as [$title, $text]): ?>
        <div class="grid gap-3 border-t border-line py-7 md:grid-cols-12">
          <dt class="text-[15px] font-medium text-fg md:col-span-4"><?= e($title) ?></dt>
          <dd class="body md:col-span-8"><?= e($text) ?></dd>
        </div>
      <?php endforeach; ?>
    </dl>
  </div>
</section>
