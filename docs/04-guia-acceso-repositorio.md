# 4. Acceso al repositorio desde el servidor — Sonora

Cómo puede el servidor de `music.antoniogmportfolio.online` descargarse el
código de `github.com/santes123/sonora`.

**Resumen rápido:** el método que usa `deploy.sh` por defecto y que no deja
credenciales persistentes es el **Método 1 (HTTPS + token en cada ejecución)**.
El **Método 2** deja las credenciales guardadas en el servidor, para no
repetir el token en cada despliegue. El **Método 3** (SSH con deploy key) está
documentado por si en el futuro quieres una clave por proyecto.

| Método | Cuándo usarlo | Qué se guarda en el servidor | Token en el historial |
|---|---|---|---|
| 1. HTTPS + `--repo-token` | Repositorio privado, un solo despliegue | Nada | No (si usas un archivo) |
| 2. HTTPS + credenciales del sistema | Repositorio privado, muchos despliegues | Sí (un archivo 600) | No |
| 3. SSH + deploy key | Clave por proyecto, varias máquinas | Sí (una clave 600) | No |
| 4. Repositorio público | Sin secretos | Nada | No |

---

## Método 1 — HTTPS con token en cada ejecución (recomendado)

No deja nada almacenado en el servidor: el token viaja solo en la URL del
clonado y `deploy.sh` limpia el remoto al terminar.

### 1. Crear el token en GitHub

`https://github.com/settings/tokens` → **Generate new token (classic)** →
marca el ámbito **`repo`** → elige una caducidad (90 días es un buen
compromiso) → *Generate token* y **guárdalo**: GitHub solo lo muestra una vez.

Alternativa con token fino (`Fine-grained`): *Permissions → Repository access →
sonora → Contents: Read-only*. Es más estrecho y solo sirve para un repositorio.

### 2. Guardar el token en el servidor, fuera del historial

```bash
# Como root, sin que el token pase por el historial de bash
sudo sh -c 'umask 077; read -rs TOKEN; printf "%s" "$TOKEN" > /root/.sonora-token; echo'
```

Pide el token y lo escribe en `/root/.sonora-token` con permisos `600`.

### 3. Desplegar

```bash
cd /ruta/al/repositorio/sonora
sudo sh -c 'REPO_TOKEN=$(cat /root/.sonora-token); export REPO_TOKEN; \
  ./deploy/deploy.sh --repo https://github.com/santes123/sonora.git'
```

El token **no** aparece en el historial (el shell del usuario nunca lo ve) y
**no** queda en `.git/config`.

### 4. Comprobar que no ha quedado rastro

```bash
sudo git -C /srv/sonora/app remote -v
# origin  https://github.com/santes123/sonora.git (fetch)   ← sin token
sudo grep -r "ghp_" /srv/sonora/app/.git/config || echo "sin tokens en la config"
```

### 5. Revocar el token cuando quieras

En GitHub: *Settings → Developer settings → Personal access tokens → Revoke*.
También conviene borrar `/root/.sonora-token` del servidor.

---

## Método 2 — HTTPS con credenciales persistentes en el servidor

Útil si vas a desplegar a menudo: el script funciona con solo
`--repo https://github.com/santes123/sonora.git` y no hay que pasar el token
cada vez. Las credenciales quedan en **un único archivo con permisos 600**
para `root`, que es el usuario que ejecuta el despliegue.

```bash
# 1. Archivo de credenciales (solo root, permisos 600)
sudo sh -c 'umask 077; printf "https://x-access-token:TOKEN_AQUI@github.com\n" > /root/.git-credentials'

# 2. Git usa ese archivo para github.com (configuración de sistema)
sudo git config --system credential.https://github.com.helper \
  "store --file=/root/.git-credentials"

# 3. Comprobación
sudo git ls-remote https://github.com/santes123/sonora.git HEAD
```

A partir de aquí:

```bash
sudo ./deploy/deploy.sh --repo https://github.com/santes123/sonora.git
```

> Con el Método 2 el token **sí** queda en el servidor (en
> `/root/.git-credentials`, modo 600, legible solo por root). Si prefieres no
> dejar nada, usa el Método 1.

**Alternativa con GitHub CLI**, si ya lo usas:

```bash
sudo apt install gh          # o: snap install gh
gh auth login --hostname github.com --git-protocol https --web
gh auth setup-git
sudo git ls-remote https://github.com/santes123/sonora.git HEAD
```

`gh auth setup-git` configura el ayudante de credenciales **para el usuario que
lo ejecuta**. Si despliegues siempre con `sudo`, configura además el ayudante a
nivel de sistema (Paso 2 de arriba) o usa el Método 1.

---

## Método 3 — SSH con deploy key (clave por proyecto)

Es la opción que más se parece a "usar una clave por proyecto, como en otros
casos": una clave propia para este repositorio, registrada en GitHub con
permiso de **solo lectura**, que no puede escribir nada en el repositorio.

### 3.1 Opción A — generar la clave en el servidor

```bash
ssh-keygen -t ed25519 -C "sonora-deploy" -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub
```

Copia la línea `ssh-ed25519 AAAA...` y pégala en
`https://github.com/santes123/sonora/settings/keys` → *New deploy key* →
marca **Allow write access: NO** (deja solo lectura).

### 3.2 Opción B — usar la clave que ya está generada en tu equipo

En el equipo de desarrollo ya existe una clave de despliegue lista para este
repositorio, en `.deploy/sonora_deploy_key` (privada) y
`.deploy/sonora_deploy_key.pub` (pública). **Ya está registrada** en GitHub
como deploy key de solo lectura (`read_only: true`, `verified: true`).

Copia la **privada** al servidor:

```bash
mkdir -p ~/.ssh && chmod 700 ~/.ssh
# pega el contenido de .deploy/sonora_deploy_key
cat > ~/.ssh/id_ed25519 <<'EOF'
-----BEGIN OPENSSH PRIVATE KEY-----
...
-----END OPENSSH PRIVATE KEY-----
EOF
chmod 600 ~/.ssh/id_ed25519

# Fingerprint de la clave pública (para comprobarlo contra GitHub)
ssh-keygen -lf ~/.ssh/id_ed25519.pub
```

### 3.3 Confiar en GitHub (known_hosts)

```bash
ssh-keyscan github.com >> ~/.ssh/known_hosts
ssh -T git@github.com
# Salida esperada: Hi santes123! You've successfully authenticated, but GitHub
# does not provide shell access.
```

### 3.4 Desplegar

```bash
sudo ./deploy/deploy.sh --repo git@github.com:santes123/sonora.git
```

### 3.5 Diagnóstico rápido de la clave

```bash
ssh -vT git@github.com 2>&1 | tail -20   # ver qué clave se intenta
ssh-keygen -lf ~/.ssh/id_ed25519.pub      # huella de la clave
```

Si `ssh -T` responde `Permission denied (publickey)`, el problema casi siempre
es de permisos: la clave debe ser `600` y `~/.ssh` `700`.

### 3.6 Revocar la clave

En GitHub: *Settings → Deploy keys → la clave "sonora-deploy" → Delete*.
También puedes hacerlo desde la CLI:

```bash
gh api -X DELETE repos/santes123/sonora/keys/170383283
```

---

## Método 4 — Repositorio público

Si el repositorio pasa a ser público, no hace falta ninguna credencial:

```bash
sudo ./deploy/deploy.sh --repo https://github.com/santes123/sonora.git
```

Ventaja: cero secretos en el servidor. Inconveniente: cualquiera puede leer el
código (y el código **no** contiene secretos: `.env`, `login.txt` y los medios
están en `.gitignore`).

---

## Diagnóstico de errores

| Error | Causa | Solución |
|---|---|---|
| `could not read Username for 'https://github.com'` | No hay credenciales y `GIT_TERMINAL_PROMPT=0` impide preguntar | Método 1, 2 o 3 |
| `remote: Repository not found` / `403` | Token sin permiso sobre el repo, o el repo es de otra cuenta | Comprueba el ámbito `repo` y que el token pertenece a `santes123` |
| `Invalid username or token` | Token caducado o mal copiado | Genera otro y revoca el anterior |
| `Permission denied (publickey)` | Clave mal instalada o permisos laxos | `chmod 700 ~/.ssh`, `chmod 600 ~/.ssh/id_ed25519` |
| `Host key verification failed` | Falta `github.com` en `known_hosts` | `ssh-keyscan github.com >> ~/.ssh/known_hosts` |
| `error: could not read Username` con repo público | Credenciales caducadas en el.helper | `sudo git config --system --unset credential.https://github.com.helper` |

---

## Verificación final (independiente del método)

```bash
# 1. El remoto está limpio (sin token, sin usuario embebido)
sudo git -C /srv/sonora/app remote -v

# 2. El código es el esperado
sudo git -C /srv/sonora/app log --oneline -1

# 3. No hay tokens en la configuración
sudo grep -E "ghp_|x-access-token" /srv/sonora/app/.git/config && echo "REVISAR" || echo "OK"

# 4. La app responde
curl -s -o /dev/null -w "%{http_code}\n" https://music.antoniogmportfolio.online/api/v1/health
```

---

## Nota de seguridad

- La clave privada de despliegue **nunca** se sube al repositorio: la carpeta
  `.deploy/` está en `.gitignore` (verificado con `git check-ignore`).
- Los tokens de GitHub son de la cuenta, no del proyecto: si se filtra, revócalo
  en GitHub; el daño se limita a lo que ese token permita.
- El token `--repo-token` solo se usa para clonar/actualizar código. Nunca se
  escribe en `backend/.env.production` ni se copia a la imagen de Docker.
