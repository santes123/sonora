# 4. Acceso al repositorio desde el servidor — Sonora

Cómo puede el servidor de `music.antoniogmportfolio.online` descargarse el
código de `github.com/santes123/sonora`, con los comandos exactos para copiar y
ejecutar.

---

## 0. Datos del servidor (valores reales)

| Qué | Valor |
|---|---|
| Dominio | `music.antoniogmportfolio.online` |
| Repositorio | `https://github.com/santes123/sonora.git` |
| SSH del repositorio | `git@github.com:santes123/sonora.git` |
| Directorio de trabajo | `/srv/sonora` |
| Código desplegado | `/srv/sonora/app` |
| Medios privados | `/srv/sonora/media` |
| Backups | `/srv/sonora/backups` |
| Scripts de mantenimiento | `/srv/sonora/deploy` |
| Raíz web (SPA) | `/var/www/site-music-antoniogmport-5de994/htdocs` |
| Logs de nginx | `/var/www/site-music-antoniogmport-5de994/logs` |
| Configuración de nginx | `/etc/nginx/sites-available/music.antoniogmportfolio.online.conf` |
| Snippets de nginx | `/etc/nginx/snippets/sonora-fastcgi.conf`, `security-headers.conf` |
| Tareas programadas | `/etc/cron.d/sonora-backup`, `sonora-monitor`, `sonora-maintenance` |
| Certificado TLS | `/etc/letsencrypt/live/music.antoniogmportfolio.online/` |
| Servicio de la aplicación | `app` (contenedor Docker) |

---

## 1. Preparar el servidor (una sola vez)

```bash
# Comprobar que está todo instalado
git --version && docker --version && docker compose version && nginx -v

# Si falta algo (Ubuntu 24.04 usa docker-compose-plugin; en 22.04, docker-compose-v2)
sudo apt update
sudo apt install -y git nginx
sudo apt install -y docker.io docker-compose-plugin

# Directorio de trabajo del proyecto
sudo mkdir -p /srv/sonora
sudo chown "$USER":"$USER" /srv/sonora

# El usuario de despliegue debe poder usar Docker sin sudo
sudo usermod -aG docker "$USER"
newgrp docker
```

> `docker compose version` debe imprimir una versión. Sin Docker Compose v2 el
> script `deploy.sh` no puede levantar el stack.

### Permisos de ejecución

`git` guarda el bit de ejecución, así que un clon nuevo ya trae
`deploy.sh` ejecutable. Si ves `Permission denied` (porque el clon es de una
versión anterior o el repo se clonó desde Windows), hay dos formas de seguir:

```bash
# A) Dar permiso una vez
sudo chmod +x /srv/sonora/app/deploy/*.sh
ls -la /srv/sonora/app/deploy/deploy.sh

# B) Invocar el script con bash (no necesita permiso de ejecución)
sudo bash /srv/sonora/app/deploy/deploy.sh --repo https://github.com/santes123/sonora.git
```

### Puertos que usa Sonora

| Servicio | Puerto en el host | Notas |
|---|---|---|
| PHP-FPM | **9001** | Solo `127.0.0.1`. Lo consume el nginx del host. Ajustable con `--fpm-port` |
| MariaDB | 3307 | Solo `127.0.0.1`. Variable `BIND_MARIADB_PORT` |
| Redis | 6380 | Solo `127.0.0.1`. Variable `BIND_REDIS_PORT` |
| nginx (host) | 80 y 443 | Los del servidor, no los de Docker |

> **El 9000 no se usa a propósito:** es el puerto por defecto de PHP-FPM y en
> servidores con Portainer o paneles de hosting suele estar ocupado. `deploy.sh`
> comprueba los puertos **antes** de construir las imágenes y dice qué
> contenedor los tiene si hay un conflicto.

### Cuántos contenedores se crean

**6 servicios**, de los que en producción se levantan **5**:

| Contenedor | Función |
|---|---|
| `sonora-app-1` | PHP-FPM: la API y las páginas |
| `sonora-queue-1` | Trabajos en segundo plano (portada WebP, metadatos) |
| `sonora-scheduler-1` | `schedule:work`: `media:gc` diario y purgas |
| `sonora-mariadb-1` | MariaDB 11.4 |
| `sonora-redis-1` | Redis 7 (sesiones, caché y colas) |
| `sonora-web-1` | nginx en Docker — **solo** con el perfil `nginx-docker`; en producción no se levanta porque el TLS lo termina el nginx del host |

---

## 2. Método 1 — HTTPS con token (recomendado)

El token viaja solo en la URL del clonado y `deploy.sh` limpia el remoto al
terminar: **no queda ningún token en `/srv/sonora/app/.git/config`**.

### 2.1 Crear el token en GitHub

**Opción A — token clásico** (`https://github.com/settings/tokens` →
**Generate new token (classic)**): marca el ámbito **`repo`**, elige una
caducidad (90 días) → *Generate token* y **guárdalo**: GitHub solo lo muestra
una vez.

**Opción B — token fino** (recomendado, más estrecho): en
`https://github.com/settings/personal-access-tokens/new` crea un token con:

- **Repository access**: solo `santes123/sonora`
- **Permissions → Repository permissions → Contents**: `Read-only`
- Caducidad: 90 días

También sirve para clonar y actualizar; no puede escribir nada en el repositorio.

Si ya lo has guardado en un archivo (por ejemplo
`fine-access-token-github.txt` en tu equipo), úsalo tal cual: el contenido del
archivo es el token.

### 2.2 Guardar el token en el servidor (sin que pase por el historial)

**Opción A — escribirlo a mano:**

```bash
sudo bash -c 'umask 077; read -rs TOKEN; printf "%s" "$TOKEN" > /root/.sonora-token; echo'
```

Pide el token y lo guarda en `/root/.sonora-token` con permisos `600`
(solo root puede leerlo).

**Opción B — subir el archivo que ya tienes** (`fine-access-token-github.txt`
en tu equipo) desde el equipo:

```bash
scp fine-access-token-github.txt root@music.antoniogmportfolio.online:/tmp/
ssh root@music.antoniogmportfolio.online 'sudo install -m 600 /tmp/fine-access-token-github.txt /root/.sonora-token && rm -f /tmp/fine-access-token-github.txt'
```

> Si tu usuario de SSH no es `root`, sustitúyelo en las dos líneas.

### 2.3 Clonar el repositorio

```bash
sudo bash -c 'T=$(cat /root/.sonora-token); git clone "https://x-access-token:${T}@github.com/santes123/sonora.git" /srv/sonora/app'
```

### 2.4 Desplegar

```bash
sudo bash -c 'REPO_TOKEN=$(cat /root/.sonora-token); export REPO_TOKEN; \
  /srv/sonora/app/deploy/deploy.sh --repo https://github.com/santes123/sonora.git'
```

El script clona o actualiza el código en `/srv/sonora/app`, construye las
imágenes, levanta el stack, instala nginx, publica la SPA, instala las tareas
programadas y verifica que todo responde.

Si el puerto de PHP-FPM que usa el servidor está ocupado, se cambia con
`--fpm-port` (por ejemplo `--fpm-port 9002`):

```bash
sudo bash -c 'REPO_TOKEN=$(cat /root/.sonora-token); export REPO_TOKEN; \
  /srv/sonora/app/deploy/deploy.sh --repo https://github.com/santes123/sonora.git --fpm-port 9002'
```

### 2.5 Si el despliegue falla a mitad (puerto ocupado)

Si el script se para al levantar el stack con
`Bind for 0.0.0.0:9000 failed: port is already allocated`, queda el stack a
medias. Se limpia y se vuelve a lanzar:

```bash
cd /srv/sonora/app

# Ver qué quedó levantado
sudo docker compose --env-file backend/.env.production -f docker-compose.prod.yml ps -a

# Limpiar los contenedores (los datos están en volúmenes: no se pierden)
sudo docker compose --env-file backend/.env.production -f docker-compose.prod.yml down

# Volver a desplegar
sudo bash -c 'REPO_TOKEN=$(cat /root/.sonora-token); export REPO_TOKEN; \
  /srv/sonora/app/deploy/deploy.sh --repo https://github.com/santes123/sonora.git'
```

Para ver quién tiene un puerto:

```bash
sudo ss -tlnp | grep 9000
sudo docker ps --format '{{.Names}}\t{{.Ports}}' | grep 9000
```

### 2.6 Comprobar que no ha quedado rastro del token

```bash
sudo git -C /srv/sonora/app remote -v
# origin  https://github.com/santes123/sonora.git (fetch)   ← sin token

sudo grep -E "ghp_|gho_|x-access-token" /srv/sonora/app/.git/config || echo "sin tokens en la config"
```

### 2.7 Revocar el token

En GitHub: *Settings → Developer settings → Personal access tokens → Revoke*.
Y en el servidor:

```bash
sudo rm -f /root/.sonora-token
```

---

## 3. Método 2 — HTTPS con credenciales guardadas en el servidor

Útil si vas a desplegar a menudo: no hay que pasar el token en cada ejecución.
Queda **un único archivo con permisos 600** para `root`.

```bash
# 1. Archivo de credenciales (solo root)
sudo bash -c 'umask 077; printf "https://x-access-token:TOKEN_AQUI@github.com\n" > /root/.git-credentials'

# 2. Git usa ese archivo para github.com (configuración de sistema)
sudo git config --system credential.https://github.com.helper "store --file=/root/.git-credentials"

# 3. Comprobación
sudo git ls-remote https://github.com/santes123/sonora.git HEAD
```

A partir de aquí, el despliegue es una sola línea y **sin token**:

```bash
sudo /srv/sonora/app/deploy/deploy.sh --repo https://github.com/santes123/sonora.git
```

> Con este método el token **sí** queda en el servidor
> (`/root/.git-credentials`, modo 600, legible solo por root). Si prefieres no
> dejar nada, usa el Método 1.

**Alternativa con GitHub CLI** (si ya lo usas):

```bash
sudo apt install gh          # o: snap install gh
gh auth login --hostname github.com --git-protocol https --web
gh auth setup-git
sudo git ls-remote https://github.com/santes123/sonora.git HEAD
```

`gh auth setup-git` configura el ayudante de credenciales **para el usuario que
lo ejecuta**. Si despliegues siempre con `sudo`, añade además el paso 2 de
este método (configuración a nivel de sistema) o usa el Método 1.

---

## 4. Método 3 — SSH con deploy key (clave por proyecto)

Una clave propia para este repositorio, registrada en GitHub con permiso de
**solo lectura**: no puede escribir nada en el repositorio.

### 4.1 Instalar la clave en el servidor

La clave ya está generada en tu equipo de desarrollo, en
`.deploy/sonora_deploy_key` (privada) y `.deploy/sonora_deploy_key.pub`
(pública). **Ya está registrada** en GitHub como deploy key de solo lectura
(id `170383283`, `verified: true`).

Copia la **privada** al servidor. Opción A, pegándola en el terminal:

```bash
sudo mkdir -p /root/.ssh && sudo chmod 700 /root/.ssh
sudo nano /root/.ssh/id_ed25519     # pega el contenido de .deploy/sonora_deploy_key
sudo chmod 600 /root/.ssh/id_ed25519
```

Opción B, copiándola con `scp` desde tu equipo (el dominio resuelve a
`79.117.135.189`, tu servidor):

```bash
scp .deploy/sonora_deploy_key root@music.antoniogmportfolio.online:/tmp/sonora_deploy_key
ssh root@music.antoniogmportfolio.online 'sudo install -m 600 /tmp/sonora_deploy_key /root/.ssh/id_ed25519 && rm -f /tmp/sonora_deploy_key'
```

> Si tu usuario de SSH no es `root`, sustitúyelo en las dos líneas (por ejemplo
> `antonio@music.antoniogmportfolio.online`).

> La clave **privada** nunca se sube al repositorio: la carpeta `.deploy/` está
> en `.gitignore` (verificado con `git check-ignore`).

### 4.2 Confiar en GitHub (known_hosts)

```bash
sudo ssh-keyscan github.com >> /root/.ssh/known_hosts
sudo ssh -T git@github.com
# Salida esperada: Hi santes123! You've successfully authenticated, but GitHub
# does not provide shell access.
```

### 4.3 Clonar y desplegar

```bash
sudo git clone git@github.com:santes123/sonora.git /srv/sonora/app
sudo /srv/sonora/app/deploy/deploy.sh --repo git@github.com:santes123/sonora.git
```

### 4.4 Comprobación de la clave

```bash
sudo ssh-keygen -lf /root/.ssh/id_ed25519.pub    # huella de la clave
sudo ssh -vT git@github.com 2>&1 | tail -20      # ver qué clave se intenta
```

Si `ssh -T` responde `Permission denied (publickey)`, el problema casi siempre
son los permisos: la clave debe ser `600` y `/root/.ssh` `700`.

### 4.5 Revocar la clave

En GitHub: *Settings → Deploy keys → "sonora-deploy" → Delete*. O desde la CLI:

```bash
gh api -X DELETE repos/santes123/sonora/keys/170383283
```

---

## 5. Método 4 — Repositorio público

Si el repositorio pasa a ser público, no hace falta ninguna credencial:

```bash
sudo git clone https://github.com/santes123/sonora.git /srv/sonora/app
sudo /srv/sonora/app/deploy/deploy.sh --repo https://github.com/santes123/sonora.git
```

Ventaja: cero secretos en el servidor. Inconveniente: cualquiera puede leer el
código (que **no** contiene secretos: `.env`, `login.txt`, los medios y
`.deploy/` están en `.gitignore`).

---

## 6. Actualizar el sitio (cada iteración)

**Un solo comando por iteración**: `deploy.sh` descarga el código nuevo de
GitHub, reconstruye las imágenes, levanta el stack, publica la SPA, ajusta
nginx y verifica que todo responde.

```bash
# Método 1 (token en cada ejecución) - el que usas ahora
sudo bash -c 'REPO_TOKEN=$(cat /root/.sonora-token); export REPO_TOKEN; \
  bash /srv/sonora/app/deploy/deploy.sh --repo https://github.com/santes123/sonora.git'

# Método 2 (credenciales guardadas) o Método 3 (SSH): sin token
sudo /srv/sonora/app/deploy/deploy.sh --repo https://github.com/santes123/sonora.git
```

> **Si el `deploy.sh` del servidor es una versión antigua**, este comando
> actualiza el código pero sigue ejecutando el script viejo (que puede dejar
> el vhost a medias). En ese caso, trae el código antes a mano:
>
> ```bash
> sudo bash -c 'T=$(cat /root/.sonora-token); cd /srv/sonora/app && \
>   git fetch "https://x-access-token:${T}@github.com/santes123/sonora.git" \
>     "+refs/heads/main:refs/remotes/origin/main" && \
>   git checkout -B main refs/remotes/origin/main && \
>   git reset --hard refs/remotes/origin/main && \
>   git remote set-url origin https://github.com/santes123/sonora.git'
> ```
>
> Con la versión actual (módulo 6.13 en adelante), el script **se relanza solo**
> tras descargar el código: no hace falta este paso previo.

Opciones útiles al actualizar:

| Opción | Para qué |
|---|---|
| `--skip-build` | No reconstruir imágenes (solo si no cambió el código) |
| `--skip-spa` | No publicar la SPA (la publicas tú) |
| `--install-nginx` | Reinstalar el vhost de nginx (por defecto se conserva el que haya) |
| `--install-cron` | Reinstalar las tareas programadas (por defecto se conservan) |
| `--fpm-port PUERTO` | Cambiar el puerto de PHP-FPM (por defecto 9001) |

### Administrar el sitio después de desplegar

El despliegue deja instalado `/srv/sonora/deploy/sonora.sh`, que resuelve todas
las rutas de forma absoluta (así funciona desde cualquier directorio, que es lo
que rompe cuando se lanza `docker compose` a mano desde `~`):

```bash
# Comandos de artisan
sudo /srv/sonora/deploy/sonora.sh artisan sonora:update-user \
  --email=viejo@correo.com --new-email=nuevo@correo.com
sudo /srv/sonora/deploy/sonora.sh artisan sonora:create-admin \
  --email=admin@ejemplo.com

# Base de datos (con las credenciales del .env.production)
sudo /srv/sonora/deploy/sonora.sh db -e "SELECT email, role FROM users;"

# Compose y logs
sudo /srv/sonora/deploy/sonora.sh compose ps
sudo /srv/sonora/deploy/sonora.sh logs app
```

### Cambiar la contraseña de un usuario

```bash
# Con una contraseña que eliges tú
sudo /srv/sonora/deploy/sonora.sh artisan sonora:update-user \
  --email=usuario@correo.com --password='contrasena-larga'

# O generando una nueva (la muestra por pantalla, no se guarda en ningún sitio)
sudo /srv/sonora/deploy/sonora.sh artisan sonora:update-user \
  --email=usuario@correo.com --reset-password
```

La contraseña mínima es de 8 caracteres. Si solo cambias el correo, la
contraseña **no se toca**.

Actualizar **sin** redesplegar todo (reconstruye solo lo que cambia):

```bash
cd /srv/sonora/app && sudo git pull && \
  sudo docker compose --env-file backend/.env.production -f docker-compose.prod.yml build && \
  sudo docker compose --env-file backend/.env.production -f docker-compose.prod.yml up -d
```

---

## 7. Primer arranque (después del despliegue)

```bash
# Crear la cuenta de administrador
cd /srv/sonora/app && sudo docker compose --env-file backend/.env.production \
  -f docker-compose.prod.yml exec app php artisan sonora:create-admin \
  --email=tu@correo.com --name="Administrador"
```

Luego entra en `https://music.antoniogmportfolio.online/admin` para registrar
usuarios y revisar los ajustes del sitio (el registro público y la indexación
ya vienen cerrados por defecto).

---

## 8. Verificación final (independiente del método)

```bash
# 1. El remoto está limpio (sin token, sin usuario embebido)
sudo git -C /srv/sonora/app remote -v

# 2. El código es el esperado
sudo git -C /srv/sonora/app log --oneline -1

# 3. No hay tokens en la configuración
sudo grep -E "ghp_|gho_|x-access-token" /srv/sonora/app/.git/config && echo "REVISAR" || echo "OK"

# 4. Los contenedores están en pie
cd /srv/sonora/app && sudo docker compose --env-file backend/.env.production \
  -f docker-compose.prod.yml ps

# 5. La app responde
curl -s -o /dev/null -w "%{http_code}\n" https://music.antoniogmportfolio.online/api/v1/health
```

---

## 9. Diagnóstico de errores

| Error | Causa | Solución |
|---|---|---|
| `could not read Username for 'https://github.com'` | No hay credenciales y `GIT_TERMINAL_PROMPT=0` impide preguntar | Método 1, 2 o 3 |
| `remote: Repository not found` / `403` | El token no tiene permiso sobre el repo | Comprueba el ámbito `repo` y que el token es de la cuenta `santes123` |
| `Invalid username or token` | Token caducado o mal copiado | Genera otro y revoca el anterior |
| `Permission denied (publickey)` | Clave mal instalada o permisos laxos | `chmod 700 /root/.ssh` y `chmod 600 /root/.ssh/id_ed25519` |
| `Host key verification failed` | Falta `github.com` en `known_hosts` | `sudo ssh-keyscan github.com >> /root/.ssh/known_hosts` |
| `detected dubious ownership in repository` | Git detecta que el repo es de otro usuario | `sudo git config --system --add safe.directory /srv/sonora/app` |
| `Permission denied (/srv/sonora/app)` al clonar | El directorio es de root | `sudo chown "$USER":"$USER" /srv/sonora` |
| `nginx: [emerg] ... unknown directive` | La configuración de nginx tiene un error | `sudo nginx -t` y revisa `/etc/nginx/sites-available/music.antoniogmportfolio.online.conf` |

---

## 10. Nota de seguridad

- La clave privada de despliegue **nunca** se sube al repositorio: la carpeta
  `.deploy/` está en `.gitignore` (verificado con `git check-ignore`).
- Los tokens de GitHub son de la cuenta, no del proyecto: si se filtra, revócalo
  en GitHub; el daño se limita a lo que ese token permita.
- El token `--repo-token` solo se usa para clonar/actualizar código. Nunca se
  escribe en `backend/.env.production` ni se copia a la imagen de Docker.
- `deploy.sh` limpia el remoto al terminar: tras la ejecución, el `origin` de
  `/srv/sonora/app` es siempre `https://github.com/santes123/sonora.git` sin
  credenciales.
