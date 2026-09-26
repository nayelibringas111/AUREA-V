# MatrixFlow Enterprise

Sistema web empresarial de análisis de **ventas, inventario e indicadores mediante álgebra lineal**, implementado para la empresa **TecnoAndes Distribuciones S.A.C.** (5 sucursales: Lima, Arequipa, Trujillo, Cusco y Piura · 5 productos: Laptop, PC, Monitor, Teclado y Mouse).

| Capa | Tecnología | Despliegue |
|---|---|---|
| Frontend | React 18 + TypeScript + Vite + Tailwind + TanStack Query + Recharts | **Vercel** |
| Backend | Python 3.12 + FastAPI + Pydantic + SQLAlchemy + Alembic | **Render** |
| Motor matemático | NumPy | (dentro del backend) |
| Base de datos | PostgreSQL | **Supabase** |

```
Usuario → React (Vercel) → HTTPS/JSON → FastAPI (Render) → Servicios → NumPy
                                                          ↘ PostgreSQL (Supabase) → Historial / Auditoría
```

Las 8 fases del Plan Maestro están implementadas; el detalle y la trazabilidad con los requerimientos están en [`docs/DOCUMENTACION_TECNICA.md`](docs/DOCUMENTACION_TECNICA.md).

---

## 🚀 Despliegue (GitHub → Supabase → Render → Vercel)

Tiempo aproximado: 15 minutos. Todo funciona con los planes gratuitos.

### 0. Subir el código a GitHub

```bash
cd matrixflow-enterprise
git init && git add . && git commit -m "MatrixFlow Enterprise v1.0"   # (si aún no tiene commits)
git branch -M main
git remote add origin https://github.com/<su-usuario>/matrixflow-enterprise.git
git push -u origin main
```

### 1. Supabase (base de datos PostgreSQL)

1. Entre a <https://supabase.com> → **New project**.
   - Nombre: `matrixflow` · Región: **East US (North Virginia)** · Anote la **Database Password**.
2. Cuando el proyecto esté listo, pulse **Connect** (arriba) → pestaña **Connection string** → modo **Session pooler**.
3. Copie la cadena. Tiene esta forma:
   ```
   postgresql://postgres.abcdefghijklmnop:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:5432/postgres
   ```
   Reemplace `[YOUR-PASSWORD]` por su contraseña. Si la contraseña tiene símbolos como `@ # / %`, codifíquelos (`@`→`%40`, `#`→`%23`, `/`→`%2F`, `%`→`%25`) o cree una contraseña solo con letras y números.

> **No necesita crear tablas manualmente.** El backend ejecuta las migraciones Alembic y carga los datos de la empresa al arrancar. (Si prefiere hacerlo a mano, `database/schema.sql` se puede pegar en *SQL Editor*.)
>
> ℹ️ Use el **Session pooler** y no la conexión directa: Render usa IPv4 y la conexión directa de Supabase es solo IPv6.
>
> 🔒 La migración `0002` activa **Row Level Security** en todas las tablas, de modo que la API REST pública de Supabase (clave `anon`) no puede leer datos; solo el backend, que se conecta como propietario.

### 2. Render (API FastAPI)

1. Entre a <https://render.com> → **New +** → **Blueprint** → conecte su cuenta de GitHub y elija el repositorio.
2. Render detecta `render.yaml` y crea el servicio **matrixflow-api**. Le pedirá estas variables:

   | Variable | Valor |
   |---|---|
   | `DATABASE_URL` | La cadena *Session pooler* del paso 1 |
   | `CORS_ORIGINS` | Por ahora `http://localhost:5173` (se actualiza en el paso 4) |
   | `ADMIN_PASSWORD` | Contraseña para `admin@tecnoandes.pe` |
   | `DEMO_USERS_PASSWORD` | Contraseña para `analista@tecnoandes.pe` y `gerencia@tecnoandes.pe` |

   `SECRET_KEY` se genera automáticamente.
3. Pulse **Apply**. El primer despliegue tarda 3–5 min: instala dependencias, crea las 19 tablas, carga ~2 200 ventas históricas de TecnoAndes y arranca.
4. Verifique: `https://matrixflow-api.onrender.com/health` debe responder `{"status":"ok","database":true,...}` y `…/docs` muestra la documentación interactiva (Swagger).
   (El nombre exacto de su URL aparece en el panel de Render.)

> El plan gratuito de Render “duerme” el servicio tras 15 min sin uso; la primera petición posterior tarda ~1 minuto. El login muestra un mensaje explicándolo si ocurre.

### 3. Vercel (frontend React)

1. Entre a <https://vercel.com> → **Add New… → Project** → importe el repositorio.
2. En **Root Directory** seleccione **`frontend`** (importante). Vercel detecta Vite automáticamente.
3. En **Environment Variables** agregue:

   | Variable | Valor |
   |---|---|
   | `VITE_API_URL` | `https://matrixflow-api.onrender.com/api/v1` (su URL de Render **+ `/api/v1`**) |
   | `VITE_SHOW_DEMO_USERS` | `true` para mostrar los accesos de demostración en el login (o `false`) |

4. **Deploy**. Anote la URL final, p. ej. `https://matrixflow-enterprise.vercel.app`.

### 4. Conectar ambos (CORS)

En Render → **matrixflow-api → Environment** cambie `CORS_ORIGINS` por la URL de Vercel (sin `/` final) y guarde; Render redesplegará solo:

```
CORS_ORIGINS=https://matrixflow-enterprise.vercel.app
```

`CORS_ORIGIN_REGEX` ya permite las URLs de *preview* de Vercel cuyo nombre empiece por `matrixflow-enterprise`. Si su proyecto de Vercel tiene otro nombre, ajuste esa expresión regular.

### 5. ¡Listo! Ingrese

| Rol | Usuario | Contraseña | Acceso |
|---|---|---|---|
| Administrador | `admin@tecnoandes.pe` | la de `ADMIN_PASSWORD` | Todo el sistema |
| Analista | `analista@tecnoandes.pe` | la de `DEMO_USERS_PASSWORD` | Ventas, inventario, metas, álgebra lineal, historial, reportes |
| Consulta | `gerencia@tecnoandes.pe` | la de `DEMO_USERS_PASSWORD` | Dashboard y reportes |

Después del primer ingreso puede cambiar la contraseña en **Configuración**.

### Solución de problemas

| Síntoma | Causa / solución |
|---|---|
| El login dice “No se pudo conectar con el servidor” | La API está despertando (espere 1 min) o `VITE_API_URL` es incorrecta. Tras cambiar una variable en Vercel hay que **Redeploy**. |
| Error de CORS en la consola del navegador | `CORS_ORIGINS` en Render no coincide exactamente con la URL de Vercel (https, sin `/` final). |
| Render: `password authentication failed` | Contraseña mal escrita o con símbolos sin codificar en `DATABASE_URL`. |
| Render: `Network is unreachable` / timeout | Está usando la conexión *Direct* (IPv6). Use la cadena **Session pooler**. |
| Render: `SECRET_KEY insegura en producción` | Defina `SECRET_KEY` con 32+ caracteres aleatorios (el Blueprint la genera). |
| Al recargar una página de Vercel aparece 404 | Verifique que el *Root Directory* sea `frontend` (allí está `vercel.json`, que redirige las rutas a `index.html`). |

---

## 💻 Desarrollo local

**Opción A – Docker (todo en un comando):**

```bash
docker compose up --build
# Frontend: http://localhost:5173    API: http://localhost:8000/docs
```

**Opción B – manual:**

```bash
# Base de datos: un PostgreSQL local (o la cadena de Supabase)
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
cp .env.example .env                                   # edite DATABASE_URL
alembic upgrade head && python -m app.seed
uvicorn app.main:app --reload                          # http://localhost:8000/docs

# Frontend (otra terminal)
cd frontend
npm install
cp .env.example .env
npm run dev                                            # http://localhost:5173
```

### Pruebas

```bash
cd backend && pytest -q                 # 38 pruebas: algoritmos, API, seguridad, aceptación (SQLite por defecto)
TEST_DATABASE_URL=postgresql://... pytest -q   # las mismas pruebas sobre PostgreSQL
cd frontend && npm test                 # pruebas de UI y validación (Vitest + Testing Library)
```

GitHub Actions (`.github/workflows/ci.yml`) ejecuta todo automáticamente en cada *push*, con PostgreSQL real.

---

## 📁 Estructura

```
matrixflow-enterprise/
├── frontend/                 React + TypeScript (Vercel)
│   ├── src/
│   │   ├── components/       UI, layout, editores y vistas de matrices, gráficos
│   │   ├── pages/            17 pantallas (login, dashboard, empresa, …, configuración)
│   │   ├── hooks/            useAuth (sesión y permisos por rol)
│   │   ├── services/         Axios + endpoints tipados
│   │   ├── schemas/          Validación con Zod
│   │   └── types/            Tipos TypeScript
│   └── vercel.json
├── backend/                  FastAPI (Render)
│   ├── app/
│   │   ├── api/routes/       auth, users, companies, branches, products, sales, inventory,
│   │   │                     targets, vectors, matrices, operations, reports, audit
│   │   ├── core/             configuración, base de datos, JWT, RBAC
│   │   ├── models/           19 tablas SQLAlchemy
│   │   ├── schemas/          Pydantic
│   │   ├── services/         lógica de negocio, operaciones, analítica, auditoría
│   │   ├── repositories/     repositorio genérico
│   │   ├── algorithms/       motor NumPy (vectores, matrices, álgebra lineal)
│   │   ├── seed.py           datos de TecnoAndes
│   │   └── main.py
│   ├── alembic/              migraciones
│   └── tests/
├── database/schema.sql       esquema SQL equivalente (opcional para Supabase)
├── docs/                     documentación técnica
├── render.yaml               Blueprint de Render
├── docker-compose.yml
└── .env.example
```
