<?php
/** @var array<string, string> $errors @var array<string, string> $old @var bool $sent */
$social = \App\Models\SocialLink::active();
$val = static fn (string $k): string => e($old[$k] ?? '');
?>
<section class="pb-[clamp(96px,11vw,160px)] pt-40 md:pt-48">
  <div class="wrap grid gap-16 lg:grid-cols-12">
    <div class="lg:col-span-5">
      <p class="micro normal-case reveal">~/shivassai/iletisim</p>
      <h1 class="display mt-6 reveal"><?= e(t('contact.title')) ?></h1>
      <p class="h-md mt-10 reveal"><span class="dim"><?= e(t('contact.lead_1')) ?></span><br><?= e(t('contact.lead_2')) ?></p>

      <?php if ($social): ?>
        <div class="mt-14 reveal">
          <p class="micro mb-3"><?= e(t('contact.channels')) ?></p>
          <ul class="border-b border-line">
            <?php foreach ($social as $s): ?>
              <li>
                <a href="<?= e($s['href']) ?>" class="group flex items-center justify-between gap-6 border-t border-line py-5"<?= $s['platform'] !== 'email' ? ' rel="me noopener" target="_blank"' : '' ?>>
                  <span class="micro w-20"><?= e($s['label']) ?></span>
                  <span class="flex-1 truncate text-[17px]"><?= e($s['display']) ?></span>
                  <span class="transition-transform group-hover:translate-x-1" aria-hidden="true">↗</span>
                </a>
              </li>
            <?php endforeach; ?>
          </ul>
        </div>
      <?php endif; ?>
    </div>

    <div id="form" class="lg:col-span-6 lg:col-start-7 lg:pt-6">
      <div class="panel p-6 md:p-10 reveal">
        <p class="micro mb-8"><?= e(t('contact.form')) ?></p>

        <?php if ($sent): ?>
          <div class="notice mb-8" role="status"><?= e(t('contact.sent')) ?></div>
        <?php endif; ?>
        <?php if (isset($errors['form'])): ?>
          <div class="notice mb-8" role="alert"><?= e($errors['form']) ?></div>
        <?php endif; ?>

        <form method="post" action="/iletisim" class="space-y-6" novalidate>
          <?= csrf_field() ?>
          <!-- Honeypot: hidden from people, tempting for bots -->
          <div class="absolute -left-[9999px] h-px w-px overflow-hidden" aria-hidden="true">
            <label for="website">Website</label>
            <input type="text" id="website" name="website" tabindex="-1" autocomplete="off">
          </div>

          <div class="field">
            <label class="field-label" for="name"><?= e(t('contact.name')) ?></label>
            <input class="input" id="name" name="name" type="text" required minlength="2" maxlength="80" autocomplete="name" value="<?= $val('name') ?>"<?= isset($errors['name']) ? ' aria-invalid="true" aria-describedby="name-err"' : '' ?>>
            <?php if (isset($errors['name'])): ?><p id="name-err" class="field-error"><?= e($errors['name']) ?></p><?php endif; ?>
          </div>
          <div class="field">
            <label class="field-label" for="email"><?= e(t('contact.email')) ?></label>
            <input class="input" id="email" name="email" type="email" required maxlength="160" autocomplete="email" inputmode="email" value="<?= $val('email') ?>"<?= isset($errors['email']) ? ' aria-invalid="true" aria-describedby="email-err"' : '' ?>>
            <?php if (isset($errors['email'])): ?><p id="email-err" class="field-error"><?= e($errors['email']) ?></p><?php endif; ?>
          </div>
          <div class="field">
            <label class="field-label" for="message"><?= e(t('contact.message')) ?></label>
            <textarea class="input min-h-[180px]" id="message" name="message" required minlength="10" maxlength="4000" rows="7"<?= isset($errors['message']) ? ' aria-invalid="true" aria-describedby="message-err"' : '' ?>><?= $val('message') ?></textarea>
            <?php if (isset($errors['message'])): ?><p id="message-err" class="field-error"><?= e($errors['message']) ?></p><?php endif; ?>
          </div>
          <div class="flex flex-col-reverse gap-5 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <p class="text-[12px] text-muted"><?= e(t('contact.privacy')) ?> <a class="link" href="/kvkk"><?= e(t('footer.kvkk')) ?></a></p>
            <button type="submit" class="btn btn-primary"><?= e(t('contact.send')) ?> <span class="arrow" aria-hidden="true">→</span></button>
          </div>
        </form>
      </div>
    </div>
  </div>
</section>

<?= \App\Services\View::partial('partials/faq') ?>
