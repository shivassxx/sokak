<?php

declare(strict_types=1);

namespace App\Services;

final class Router
{
    /** @var array<int, array{method: string, regex: string, handler: callable|array{0: class-string, 1: string}}> */
    private array $routes = [];

    public function get(string $path, callable|array $handler): void
    {
        $this->add('GET', $path, $handler);
    }

    public function post(string $path, callable|array $handler): void
    {
        $this->add('POST', $path, $handler);
    }

    public function add(string $method, string $path, callable|array $handler): void
    {
        $regex = preg_replace_callback(
            '/\{([a-z_]+)(?::([^}]+))?\}/',
            static fn (array $m): string => '(?P<' . $m[1] . '>' . ($m[2] ?? '[^/]+') . ')',
            rtrim($path, '/') ?: '/'
        );
        $this->routes[] = ['method' => $method, 'regex' => '#^' . $regex . '$#u', 'handler' => $handler];
    }

    /**
     * Returns the handler output (string body). Throws HttpException for 404/405.
     */
    public function dispatch(string $method, string $uri): string
    {
        $path = '/' . trim(rawurldecode((string) parse_url($uri, PHP_URL_PATH)), '/');
        $method = $method === 'HEAD' ? 'GET' : $method;
        $allowed = false;

        foreach ($this->routes as $route) {
            if (!preg_match($route['regex'], $path, $matches)) {
                continue;
            }
            if ($route['method'] !== $method) {
                $allowed = true;
                continue;
            }
            $params = array_filter($matches, 'is_string', ARRAY_FILTER_USE_KEY);
            $handler = $route['handler'];
            if (is_array($handler)) {
                $handler = [new $handler[0](), $handler[1]];
            }
            return (string) $handler(...array_values($params));
        }

        throw new HttpException($allowed ? 405 : 404);
    }
}
