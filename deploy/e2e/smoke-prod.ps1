<#
.SYNOPSIS
    Prueba de humo del entorno de producción de Sonora.

.DESCRIPTION
    Ejecuta el camino completo de un usuario contra la URL base:
    registro -> sesión -> subida de audio -> URL firmada -> streaming con Range.

    Sirve para comprobar, tras un despliegue, que la imagen, el nginx, el
    PHP-FPM, la base de datos y el almacenamiento de medios funcionan juntos.

.EXAMPLE
    ./deploy/e2e/smoke-prod.ps1 -BaseUrl "https://music.antoniogmportfolio.online"
    ./deploy/e2e/smoke-prod.ps1 -BaseUrl "http://localhost:8081" -AudioFile "C:\música\cancion.mp3"
#>
param(
    [Parameter(Mandatory = $true)]
    [string]$BaseUrl,

    # Fichero de audio para probar la subida. Si no se indica, solo se prueba
    # el arranque (salud, sesión y cabeceras).
    [string]$AudioFile,

    [string]$Email = "",
    [string]$Password = ""
)

$ErrorActionPreference = 'Stop'
$BaseUrl = $BaseUrl.TrimEnd('/')

# HttpClient (subida multipart y Range) no está cargado por defecto en
# Windows PowerShell 5.1.
Add-Type -AssemblyName System.Net.Http

if (-not $Email) {
    $Email = "smoke+$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())@sonora.test"
}
if (-not $Password) {
    $Password = "Smoke-$([guid]::NewGuid().ToString('N').Substring(0, 12))"
}

$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$ok = 0
$fail = 0

function Step {
    param([string]$Name, [scriptblock]$Body)
    try {
        $result = & $Body
        Write-Host "  OK   $Name" -ForegroundColor Green
        $script:ok++
        return $result
    } catch {
        Write-Host "  FAIL $Name -> $($_.Exception.Message)" -ForegroundColor Red
        $script:fail++
        return $null
    }
}

function Get-CsrfHeader {
    # Sanctum solo activa el flujo stateful (cookie de sesión) si la petición
    # trae Origin o Referer del dominio permitido: el navegador los manda
    # solo, por eso aquí se añaden a mano.
    $headers = @{
        'Origin'  = $BaseUrl
        'Referer' = "$BaseUrl/"
        'Accept'  = 'application/json'
    }
    $cookie = $session.Cookies.GetCookies($BaseUrl) | Where-Object { $_.Name -eq 'XSRF-TOKEN' }
    if ($cookie) {
        $headers['X-XSRF-TOKEN'] = [System.Uri]::UnescapeDataString($cookie.Value)
    }
    return $headers
}

# Windows PowerShell 5.1 no tiene Invoke-RestMethod -Form: la subida
# multipart se hace con HttpClient.
function Invoke-MultipartUpload {
    param(
        [string]$Uri,
        [string]$FilePath,
        [hashtable]$Headers = @{},
        [Microsoft.PowerShell.Commands.WebRequestSession]$WebSession
    )

    $client = New-Object System.Net.Http.HttpClient
    $handler = New-Object System.Net.Http.HttpClientHandler
    $handler.CookieContainer = $WebSession.Cookies
    $handler.UseCookies = $true
    $client = New-Object System.Net.Http.HttpClient($handler)

    foreach ($k in $Headers.Keys) {
        $client.DefaultRequestHeaders.TryAddWithoutValidation($k, $Headers[$k]) | Out-Null
    }

    $content = New-Object System.Net.Http.MultipartFormDataContent
    $bytes = [System.IO.File]::ReadAllBytes($FilePath)
    $part = New-Object System.Net.Http.ByteArrayContent(, $bytes)
    $part.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse('audio/mpeg')
    $content.Add($part, 'file', (Split-Path $FilePath -Leaf))

    $resp = $client.PostAsync($Uri, $content).GetAwaiter().GetResult()
    $body = $resp.Content.ReadAsStringAsync().GetAwaiter().GetResult()
    $client.Dispose()

    if (-not $resp.IsSuccessStatusCode) {
        throw "HTTP $([int]$resp.StatusCode): $body"
    }
    return $body | ConvertFrom-Json
}

Write-Host "== Prueba de humo de Sonora en $BaseUrl ==" -ForegroundColor Cyan

# --- 1. Salud de la API ------------------------------------------------------
Step 'health de la API' {
    $r = Invoke-RestMethod "$BaseUrl/api/v1/health" -TimeoutSec 20
    if ($r.status -ne 'ok') { throw "estado inesperado: $($r | ConvertTo-Json -Compress)" }
    $r
}

# --- 2. La SPA se sirve ------------------------------------------------------
Step 'la SPA se sirve (index.html)' {
    $r = Invoke-WebRequest "$BaseUrl/" -UseBasicParsing -TimeoutSec 20
    if ($r.StatusCode -ne 200) { throw "status $($r.StatusCode)" }
    if ($r.Content -notmatch '<div id="root">') { throw 'no parece el index.html de la SPA' }
}

# --- 3. Cabeceras de seguridad ----------------------------------------------
Step 'cabeceras de seguridad' {
    $r = Invoke-WebRequest "$BaseUrl/" -UseBasicParsing -TimeoutSec 20
    foreach ($h in @('X-Content-Type-Options', 'X-Frame-Options', 'Referrer-Policy')) {
        if (-not $r.Headers[$h]) { throw "falta la cabecera $h" }
    }
    if ($r.Headers['X-Content-Type-Options'] -ne 'nosniff') { throw 'nosniff incorrecto' }
}

# --- 4. Service worker sin cache --------------------------------------------
Step 'el service worker no se cachea' {
    $r = Invoke-WebRequest "$BaseUrl/sw.js" -UseBasicParsing -TimeoutSec 20
    if ($r.Headers['Cache-Control'] -notmatch 'no-cache') {
        throw "Cache-Control inesperado: $($r.Headers['Cache-Control'])"
    }
}

# --- 5. Registro y sesión ----------------------------------------------------
Step 'cookie CSRF' {
    Invoke-WebRequest "$BaseUrl/sanctum/csrf-cookie" -WebSession $session -UseBasicParsing `
        -Headers @{ Origin = $BaseUrl; Referer = "$BaseUrl/" } -TimeoutSec 20 | Out-Null
}

Step 'registro de usuario' {
    $body = @{
        name                 = 'Smoke Test'
        email                = $Email
        password             = $Password
        password_confirmation = $Password
    } | ConvertTo-Json
    $headers = Get-CsrfHeader
    Invoke-RestMethod "$BaseUrl/api/v1/auth/register" -Method Post -Body $body `
        -ContentType 'application/json' -Headers $headers -WebSession $session -TimeoutSec 20 | Out-Null
}

Step 'login' {
    $body = @{ email = $Email; password = $Password } | ConvertTo-Json
    $headers = Get-CsrfHeader
    Invoke-RestMethod "$BaseUrl/api/v1/auth/login" -Method Post -Body $body `
        -ContentType 'application/json' -Headers $headers -WebSession $session -TimeoutSec 20 | Out-Null
}

Step 'sesión activa (GET /auth/me)' {
    $me = Invoke-RestMethod "$BaseUrl/api/v1/auth/me" -WebSession $session `
        -Headers (Get-CsrfHeader) -TimeoutSec 20
    if ($me.data.email -ne $Email) { throw "usuario inesperado: $($me.data.email)" }
}

# --- 6. Catálogo -------------------------------------------------------------
Step 'catálogo de canciones' {
    $r = Invoke-RestMethod "$BaseUrl/api/v1/songs?per_page=5" -WebSession $session `
        -Headers (Get-CsrfHeader) -TimeoutSec 20
    if ($null -eq $r.data) { throw 'respuesta sin data' }
}

# --- 7. Subida y streaming (opcional) ---------------------------------------
if ($AudioFile) {
    Step 'subida de audio' {
        $headers = Get-CsrfHeader
        $song = Invoke-MultipartUpload -Uri "$BaseUrl/api/v1/songs" -FilePath $AudioFile `
            -Headers $headers -WebSession $session
        if (-not $song.data.id) { throw 'la respuesta no trae id' }
        $script:uploadedSong = $song.data
    }

    Step 'URL firmada en lote (offline)' {
        $headers = Get-CsrfHeader
        $body = @{ song_ids = @($script:uploadedSong.id) } | ConvertTo-Json
        $r = Invoke-RestMethod "$BaseUrl/api/v1/offline/urls" -Method Post -Body $body `
            -ContentType 'application/json' -Headers $headers -WebSession $session -TimeoutSec 20
        if (-not $r.data[0].url) { throw 'no se obtuvo URL firmada' }
        $script:signedUrl = $r.data[0].url
    }

    Step 'streaming con Range (206)' {
        # Invoke-WebRequest de Windows PowerShell 5.1 no permite Range: se usa
        # HttpClient, que sí lo admite.
        $client = New-Object System.Net.Http.HttpClient
        $client.DefaultRequestHeaders.Range = New-Object System.Net.Http.Headers.RangeHeaderValue(0, 65535)
        $resp = $client.GetAsync("$BaseUrl$($script:signedUrl)").GetAwaiter().GetResult()
        if ([int]$resp.StatusCode -ne 206) {
            throw "status $([int]$resp.StatusCode) (se esperaba 206)"
        }
        if ($resp.Content.Headers.ContentType.MediaType -notmatch 'audio') {
            throw "tipo $($resp.Content.Headers.ContentType.MediaType)"
        }
        if (-not $resp.Headers.AcceptRanges.Contains('bytes')) { throw 'no acepta Range' }
        $client.Dispose()
    }
}

Write-Host ""
Write-Host "Resultado: $ok correctos, $fail fallidos" -ForegroundColor $(if ($fail -eq 0) { 'Green' } else { 'Red' })
exit $(if ($fail -eq 0) { 0 } else { 1 })
