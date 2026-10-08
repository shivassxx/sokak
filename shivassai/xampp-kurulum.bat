@echo off
chcp 65001 >nul
setlocal EnableExtensions EnableDelayedExpansion
title shivassai - XAMPP kurulumu

rem ============================================================
rem  shivassai.com -> XAMPP kurulum betigi
rem  Kullanim: bu dosyaya cift tikla (veya: xampp-kurulum.bat D:\xampp)
rem ============================================================

set "XAMPP=%~1"
if "%XAMPP%"=="" set "XAMPP=C:\xampp"
set "PHP=%XAMPP%\php\php.exe"
set "PHPINI=%XAMPP%\php\php.ini"
set "HTTPD=%XAMPP%\apache\conf\httpd.conf"
set "VHOST=%XAMPP%\apache\conf\extra\shivassai.conf"
set "APP=%~dp0"
if "%APP:~-1%"=="\" set "APP=%APP:~0,-1%"
set "APPFWD=%APP:\=/%"

echo.
echo  shivassai - XAMPP kurulumu
echo  -----------------------------------------
echo  XAMPP  : %XAMPP%
echo  Proje  : %APP%
echo.

if not exist "%PHP%" (
  echo [HATA] %PHP% bulunamadi. XAMPP kurulu mu? Farkli klasordeyse:
  echo        xampp-kurulum.bat D:\xampp
  goto :fail
)
if not exist "%APP%\public\index.php" (
  echo [HATA] Bu dosya shivassai klasorunun icinde olmali.
  goto :fail
)

echo %APP% | findstr /I "\\htdocs\\" >nul && (
  echo [UYARI] Proje htdocs icinde. Daha guvenli yer: %XAMPP%\shivassai
  echo         ^(Kok .htaccess yine de veritabanini korur.^)
  echo.
)

rem --- 1. PHP surumu -------------------------------------------------
echo [1/6] PHP surumu:
"%PHP%" -r "echo '       '.PHP_VERSION.PHP_EOL;"
"%PHP%" -r "exit(version_compare(PHP_VERSION, '8.2.0', '>=') ? 0 : 1);"
if errorlevel 1 (
  echo [HATA] PHP 8.2 veya ustu gerekli. Guncel XAMPP indir: https://www.apachefriends.org
  goto :fail
)

rem --- 2. PHP eklentileri --------------------------------------------
echo [2/6] PHP eklentileri kontrol ediliyor...
if not exist "%PHPINI%.shivassai.bak" copy /y "%PHPINI%" "%PHPINI%.shivassai.bak" >nul
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$p='%PHPINI%'; $c=Get-Content -Raw $p; foreach($e in 'pdo_sqlite','sqlite3','mbstring','fileinfo','gd'){ $c=[regex]::Replace($c,'(?m)^\s*;\s*extension\s*=\s*(php_)?'+$e+'(\.dll)?\s*$','extension='+$e) }; Set-Content -NoNewline -Encoding ascii $p $c"
for %%e in (pdo_sqlite mbstring fileinfo) do (
  "%PHP%" -m | findstr /I /X "%%e" >nul || (
    echo [HATA] PHP eklentisi acilamadi: %%e  ^(%PHPINI% dosyasinda extension=%%e satirini ac^)
    goto :fail
  )
)
"%PHP%" -m | findstr /I /X "gd" >nul || echo        ^(gd yok: buyuk gorseller icin kucuk kopya uretilmez, site yine calisir^)
echo        tamam

rem --- 3. Yerel ayar dosyasi -----------------------------------------
echo [3/6] Ayar dosyasi...
if not exist "%APP%\config\config.local.php" (
  > "%APP%\config\config.local.php" (
    echo ^<?php
    echo return ['app' =^> ['url' =^> 'http://localhost:8080', 'env' =^> 'local', 'debug' =^> true]];
  )
  echo        config\config.local.php olusturuldu
) else (
  echo        config\config.local.php zaten var, dokunulmadi
)

rem --- 4. Veritabani --------------------------------------------------
echo [4/6] Veritabani kuruluyor...
pushd "%APP%"
"%PHP%" scripts\install.php || (popd & goto :fail)

rem --- 5. Yonetici ----------------------------------------------------
"%PHP%" scripts\has-admin.php
if errorlevel 1 (
  echo [5/6] Yonetici hesabi olustur ^(sifre en az 12 karakter^):
  "%PHP%" scripts\create-admin.php
) else (
  echo [5/6] Yonetici zaten var. Sifre sifirlamak icin: %PHP% scripts\create-admin.php
)
popd

rem --- 6. Apache ayari -------------------------------------------------
echo [6/6] Apache ayari yaziliyor...
> "%VHOST%" (
  echo # shivassai - xampp-kurulum.bat tarafindan olusturuldu
  echo Listen 8080
  echo ^<VirtualHost *:8080^>
  echo     ServerName localhost
  echo     DocumentRoot "%APPFWD%/public"
  echo     ^<Directory "%APPFWD%/public"^>
  echo         Options -Indexes +FollowSymLinks
  echo         AllowOverride All
  echo         Require all granted
  echo     ^</Directory^>
  echo     ErrorLog "logs/shivassai-error.log"
  echo     CustomLog "logs/shivassai-access.log" common
  echo ^</VirtualHost^>
)
findstr /C:"conf/extra/shivassai.conf" "%HTTPD%" >nul || (
  if not exist "%HTTPD%.shivassai.bak" copy /y "%HTTPD%" "%HTTPD%.shivassai.bak" >nul
  >> "%HTTPD%" echo.
  >> "%HTTPD%" echo # shivassai
  >> "%HTTPD%" echo Include "conf/extra/shivassai.conf"
)
findstr /R /C:"^LoadModule rewrite_module" "%HTTPD%" >nul || (
  powershell -NoProfile -Command "$p='%HTTPD%'; (Get-Content -Raw $p) -replace '(?m)^#\s*LoadModule rewrite_module','LoadModule rewrite_module' | Set-Content -NoNewline -Encoding ascii $p"
)
"%XAMPP%\apache\bin\httpd.exe" -t >nul 2>&1 && echo        Apache ayari gecerli || echo [UYARI] Apache ayar testi basarisiz: "%XAMPP%\apache\bin\httpd.exe" -t

echo.
echo  =========================================
echo   KURULUM TAMAM
echo  =========================================
echo   1. XAMPP Control Panel'de Apache'yi Stop, sonra Start yap.
echo   2. Site : http://localhost:8080
echo   3. Panel: http://localhost:8080/admin
echo.
echo   Telefondan: ayni Wi-Fi'da http://BILGISAYAR-IP:8080
echo   ^(IP icin: ipconfig -^> IPv4 Address. Guvenlik duvari sorarsa izin ver.^)
echo.
pause
exit /b 0

:fail
echo.
echo Kurulum tamamlanamadi. Yukaridaki mesaji Claude'a gonder.
pause
exit /b 1
