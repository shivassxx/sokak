<?php

declare(strict_types=1);

use App\Controllers\Admin\AuthController;
use App\Controllers\Admin\BuildLogAdminController;
use App\Controllers\Admin\DashboardController;
use App\Controllers\Admin\MediaController;
use App\Controllers\Admin\MessageController;
use App\Controllers\Admin\ProjectAdminController;
use App\Controllers\Admin\SettingsController;
use App\Controllers\BuildLogController;
use App\Controllers\ContactController;
use App\Controllers\HomeController;
use App\Controllers\PageController;
use App\Controllers\ProjectController;
use App\Controllers\SeoController;
use App\Services\Router;

/** @var Router $router */

// Public
$router->get('/', [HomeController::class, 'index']);
$router->get('/projeler', [ProjectController::class, 'index']);
$router->get('/projeler/{slug:[a-z0-9-]+}', [ProjectController::class, 'show']);
$router->get('/build-log', [BuildLogController::class, 'index']);
$router->get('/build-log/{slug:[a-z0-9-]+}', [BuildLogController::class, 'show']);
$router->get('/hakkimda', [PageController::class, 'about']);
$router->get('/iletisim', [ContactController::class, 'show']);
$router->post('/iletisim', [ContactController::class, 'submit']);
$router->get('/gizlilik', [PageController::class, 'privacy']);
$router->get('/kvkk', [PageController::class, 'kvkk']);
$router->get('/cerezler', [PageController::class, 'cookies']);
$router->get('/sitemap.xml', [SeoController::class, 'sitemap']);
$router->get('/robots.txt', [SeoController::class, 'robots']);

// Admin: auth
$router->get('/admin/login', [AuthController::class, 'showLogin']);
$router->post('/admin/login', [AuthController::class, 'login']);
$router->post('/admin/logout', [AuthController::class, 'logout']);

// Admin: dashboard
$router->get('/admin', [DashboardController::class, 'index']);

// Admin: projects
$router->get('/admin/projects', [ProjectAdminController::class, 'index']);
$router->get('/admin/projects/create', [ProjectAdminController::class, 'create']);
$router->post('/admin/projects', [ProjectAdminController::class, 'store']);
$router->get('/admin/projects/{id:\d+}/edit', [ProjectAdminController::class, 'edit']);
$router->post('/admin/projects/{id:\d+}', [ProjectAdminController::class, 'update']);
$router->post('/admin/projects/{id:\d+}/delete', [ProjectAdminController::class, 'destroy']);
$router->post('/admin/projects/{id:\d+}/feature', [ProjectAdminController::class, 'feature']);
$router->post('/admin/projects/{id:\d+}/move', [ProjectAdminController::class, 'move']);

// Admin: build log
$router->get('/admin/build-log', [BuildLogAdminController::class, 'index']);
$router->get('/admin/build-log/create', [BuildLogAdminController::class, 'create']);
$router->post('/admin/build-log', [BuildLogAdminController::class, 'store']);
$router->get('/admin/build-log/{id:\d+}/edit', [BuildLogAdminController::class, 'edit']);
$router->post('/admin/build-log/{id:\d+}', [BuildLogAdminController::class, 'update']);
$router->post('/admin/build-log/{id:\d+}/delete', [BuildLogAdminController::class, 'destroy']);
$router->post('/admin/markdown-preview', [BuildLogAdminController::class, 'preview']);

// Admin: media
$router->get('/admin/media', [MediaController::class, 'index']);
$router->post('/admin/media', [MediaController::class, 'upload']);
$router->post('/admin/media/{id:\d+}/delete', [MediaController::class, 'destroy']);

// Admin: settings (about, social links, home copy)
$router->get('/admin/settings', [SettingsController::class, 'edit']);
$router->post('/admin/settings', [SettingsController::class, 'update']);

// Admin: contact messages
$router->get('/admin/messages', [MessageController::class, 'index']);
$router->post('/admin/messages/{id:\d+}/delete', [MessageController::class, 'destroy']);
