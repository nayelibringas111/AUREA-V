# MatrixFlow Enterprise – Documentación técnica

Implementación del *Plan Maestro de Desarrollo v1.0* para **TecnoAndes Distribuciones S.A.C.** (RUC 20601234571), empresa comercializadora de equipos tecnológicos con cinco sucursales.

## 1. Escenario empresarial implementado

| Entidad | Datos cargados |
|---|---|
| Sucursales (filas de las matrices) | LIM Sede Lima · AQP Sede Arequipa · TRU Sede Trujillo · CUS Sede Cusco · PIU Sede Piura |
| Productos (columnas de las matrices) | P-001 Laptop (S/ 3 200) · P-002 PC (S/ 2 800) · P-003 Monitor (S/ 750) · P-004 Teclado (S/ 120) · P-005 Mouse (S/ 60) |
| Categorías | Computadoras, Periféricos |
| Ventas | ~2 200 ventas diarias desde hace 6 meses hasta hoy, con estacionalidad y demanda por sucursal |
| Metas | Metas mensuales por sucursal × producto (unidades e importe), del mes −6 al mes +1 |
| Inventario | Existencias y stock mínimo por sucursal × producto (incluye alertas de stock bajo) |
| Usuarios | Administrador, Analista y Consulta (gerencia) |
| Álgebra | Vectores de precios y costos, matrices Q y T del mes anterior y 4 operaciones de ejemplo |

La carga está en `backend/app/seed.py`, es reproducible (semilla fija) e idempotente (no duplica datos en cada arranque).

## 2. Modelo matemático

| Símbolo | Significado | Dimensión | Origen |
|---|---|---|---|
| **Q** | Unidades vendidas | sucursales × productos | `sale_details.quantity` |
| **A** | Ventas en importe (S/) | sucursales × productos | `sale_details.subtotal` |
| **T** | Metas (unidades o importe) | sucursales × productos | `targets` |
| **S** | Existencias | sucursales × productos | `inventory.stock` |
| **p**, **c** | Precios y costos unitarios | productos | `products` |
| **1** | Vector de unos | — | — |

| Indicador | Fórmula | Operación de la Semana 06 |
|---|---|---|
| Ventas por sucursal | A · 1 | Multiplicación matriz-vector |
| Ventas por producto | Aᵀ · 1 | Transpuesta + multiplicación |
| Ingresos a precio de lista | Q · p | Multiplicación matricial |
| Ingreso total | (Qᵀ·1) · p | Producto escalar |
| Costo de ventas | (Qᵀ·1) · c | Producto escalar |
| Margen por sucursal | A·1 − Q·c | Resta de vectores |
| Brecha vs. metas | G = A − T | Resta matricial |
| Cumplimiento | (A·1) / (T·1) | — |
| Proyección | k · A (k = 1.08) | Multiplicación por escalar |
| Acumulado de periodos | A₁ + A₂ | Suma matricial |
| Rotación de inventario | Q / (S + Q/2) | Operaciones elemento a elemento |
| Índice de desempeño | w₁·ventas + w₂·margen + w₃·cumplimiento + w₄·rotación | Combinación lineal |

Todas las fórmulas se ejecutan en el backend con NumPy (`app/services/analytics_service.py`) usando las funciones del motor (`app/algorithms`).

## 3. Fases del plan y su implementación

| Fase | Entregable del plan | Implementación |
|---|---|---|
| 1 – Frontend | UI, navegación y módulos | `frontend/src`: 17 pantallas (`/login`, `/dashboard`, `/empresa`, `/sucursales`, `/productos`, `/ventas`, `/inventario`, `/metas`, `/vectores`, `/matrices`, `/operaciones`, `/combinaciones`, `/historial`, `/reportes`, `/usuarios`, `/auditoria`, `/configuracion`), layout responsive con sidebar, identidad visual §8.4 |
| 2 – Backend | API REST y servicios | `backend/app/api/routes/*` (13 routers), `services/`, `repositories/`, `schemas/` (Pydantic) |
| 3 – Persistencia | Modelo de datos y migraciones | 19 tablas en `models/`, migraciones Alembic `0001` (esquema) y `0002` (RLS Supabase), `database/schema.sql` |
| 4 – Álgebra lineal | Algoritmos | `algorithms/vectors.py`, `matrices.py`, `linear_algebra.py` (funciones puras, sin dependencia de BD) |
| 5 – Integración | React ↔ FastAPI ↔ NumPy ↔ PostgreSQL | TanStack Query + Axios (`services/`), matrices generadas desde ventas, “casos empresariales” en un clic |
| 6 – Seguridad | JWT + RBAC + auditoría | `core/security.py` (bcrypt + JWT HS256), `core/deps.py` (roles), `services/audit_service.py`, RLS en Supabase |
| 7 – Analítica | Dashboard y reportes | `services/analytics_service.py`, `/reports/*`, exportación CSV, gráficos Recharts |
| 8 – Calidad | Pruebas | `backend/tests` (38 pruebas), `frontend/src/__tests__` (9 pruebas), CI en GitHub Actions |

## 4. Motor matemático (Fase 4)

| Función | Descripción | Validación |
|---|---|---|
| `sum_vector`, `subtract_vector` | u ± v | igual dimensión |
| `scalar_multiply` | k·u | escalar finito |
| `dot_product` | u · v | igual dimensión |
| `add_matrix`, `subtract_matrix` | A ± B | igual forma |
| `multiply_matrix` | A·B o A·v | columnas de A = filas de B |
| `transpose_matrix` | Aᵀ | — |
| `scalar_multiply_matrix` | k·A | escalar finito |
| `linear_combination` | Σ cᵢXᵢ | mismo tamaño, n.º coeficientes = n.º operandos |
| `validate_vector`, `validate_matrix`, `validate_dimensions` | Validaciones | numéricos, finitos, rectangular, máx. 200 |

Flujo de una operación (`POST /api/v1/operations`):

```
React → Pydantic (OperationCreate) → operation_service.execute
      → resuelve operandos (guardados o en línea, con etiquetas)
      → NumPy (algoritmo) → mide duración
      → guarda operations + operation_inputs + operation_results (+ vector/matriz si se pidió)
      → audit_logs → JSON → React
```

Si las dimensiones son incompatibles la operación **también se guarda** con estado `error` y la API responde 422 con el mensaje y el `operation_id`.

## 5. Modelo de datos (Fase 3)

`users`, `roles`, `companies`, `branches`, `categories`, `products`, `sales`, `sale_details`, `inventory`, `inventory_movements`, `targets`, `vectors`, `vector_values`, `matrices`, `matrix_values`, `operations`, `operation_inputs`, `operation_results`, `audit_logs`.

- Vectores y matrices se almacenan normalizados (`vector_values(position, value)`, `matrix_values(row_index, col_index, value)`), con etiquetas JSON.
- Registrar una venta descuenta inventario y crea un movimiento `salida`; anularla lo restituye.
- Sucursales, productos y usuarios usan baja lógica (`is_active`) para conservar la trazabilidad histórica.

## 6. API (Fase 2)

Documentación interactiva en `/docs` (Swagger) y `/redoc`. Prefijo `/api/v1`.

| Método | Ruta | Rol |
|---|---|---|
| POST | `/auth/login` · GET `/auth/me` · POST `/auth/change-password` | público / autenticado |
| GET/POST/PATCH/DELETE | `/users`, `/users/roles` | administrador |
| GET · PATCH | `/companies`, `/companies/current` | todos · administrador |
| GET · POST/PATCH/DELETE | `/branches`, `/categories`, `/products` | todos · administrador |
| GET/POST | `/sales`, `/sales/{id}/cancel` | administrador, analista |
| GET/PATCH/POST | `/inventory`, `/inventory/movements` | administrador, analista |
| GET/PUT/PATCH | `/targets`, `/targets/periods` | administrador, analista |
| CRUD + POST | `/vectors`, `/vectors/from-products` | administrador, analista |
| CRUD + POST | `/matrices`, `/matrices/from-sales`, `/matrices/preview-from-sales` | administrador, analista |
| POST · GET | `/operations`, `/operations/types`, `/operations/{id}` | administrador, analista |
| GET | `/reports/dashboard`, `sales-by-branch`, `sales-by-product`, `target-compliance`, `inventory-rotation`, `performance-index`, `monthly-trend`, `operations-stats`, `export/{reporte}.csv` | todos |
| GET | `/audit` | administrador |
| GET | `/health` | público |

## 7. Seguridad (Fase 6)

| Rol | Módulos |
|---|---|
| Administrador | Todos (usuarios, empresa, sucursales, productos, ventas, inventario, metas, vectores, matrices, operaciones, combinaciones, historial, reportes, auditoría, configuración) |
| Analista | Dashboard, ventas, inventario, metas, vectores, matrices, operaciones, combinaciones, historial, reportes |
| Consulta | Dashboard y reportes |

- Contraseñas con **bcrypt**; sesiones con **JWT** (HS256, 8 h).
- Permisos verificados en el backend en cada endpoint; el frontend oculta módulos según `modules` de `/auth/me`.
- Auditoría: usuario, acción, módulo, entidad, fecha, IP (`X-Forwarded-For`), estado y detalle; incluye intentos de login fallidos.
- Datos aislados por empresa (`company_id`).
- En producción el backend rechaza arrancar con una `SECRET_KEY` débil.
- Supabase: RLS activado en todas las tablas para bloquear la API REST pública.

## 8. Trazabilidad de requerimientos

| Código | Requerimiento | Dónde | Prueba |
|---|---|---|---|
| RF-01 | Iniciar sesión | `/auth/login`, `pages/Login.tsx` | `test_login_invalid`, UI `login` |
| RF-02 | Usuarios y roles | `/users`, `pages/Usuarios.tsx` | `test_user_management`, `test_rbac` |
| RF-03 | Empresas y sucursales | `/companies`, `/branches` | `test_admin_creates_branch_and_product` |
| RF-04 | Productos y categorías | `/products`, `/categories` | ídem |
| RF-05 | Registrar ventas | `/sales`, `pages/Ventas.tsx` | `test_sale_updates_inventory` |
| RF-06 | Inventario | `/inventory` | `test_inventory_movements`, `test_sale_insufficient_stock` |
| RF-07 | Metas | `/targets`, `pages/Metas.tsx` | `test_targets` |
| RF-08 / RF-09 | Vectores y matrices | `/vectors`, `/matrices` | `test_vector_crud`, `test_matrix_validation_and_from_sales` |
| RF-10 / RF-11 | Operaciones vectoriales y matriciales | `/operations` | `test_all_operation_types`, `test_algorithms.py` |
| RF-12 | Combinaciones lineales | `/operations`, `/reports/performance-index` | `test_linear_combination_*` |
| RF-13 | Historial | `/operations` (GET) | `test_incompatible_dimensions_are_rejected_and_logged` |
| RF-14 | Reportes | `/reports/*` | `test_reports` |
| RF-15 | Auditoría | `/audit` | `test_audit_log` |

| Criterio | Verificación |
|---|---|
| CA-01 Autenticación por rol | `test_me_modules_by_role`, `test_rbac`, `test_requires_token` |
| CA-02 Admin registra sucursales y productos | `test_admin_creates_branch_and_product` |
| CA-03 Usuario autorizado registra ventas | `test_sale_updates_inventory` |
| CA-04 / CA-05 Datos como vectores y matrices | `test_vector_crud`, `test_matrix_validation_and_from_sales` |
| CA-06 Dimensiones incompatibles rechazadas | `test_vector_dimension_mismatch`, `test_multiply_rectangular_shapes`, `test_incompatible_dimensions_are_rejected_and_logged` |
| CA-07 Resultados matemáticamente válidos | `test_algorithms.py`, `test_business_operation_revenue` (compara contra cálculo manual) |
| CA-08 Cada operación queda en el historial | `test_incompatible_dimensions_are_rejected_and_logged` |
| CA-09 Resultado visible en el frontend | `OperationResultView`, pantallas Operaciones / Historial |
| CA-10 Reportes con datos persistidos | `test_reports` (suma por sucursal = suma por producto) |

## 9. Sprints (Scrum)

| Sprint | Objetivo | Resultado |
|---|---|---|
| 1 | Diseño y frontend base | Layout, login, navegación, dashboard |
| 2 | Módulos empresariales | Empresa, sucursales, productos, ventas, inventario, metas |
| 3 | Frontend matemático | Vectores, matrices (editor), operaciones, combinaciones, historial |
| 4 | Backend | FastAPI, 13 routers, servicios, repositorio |
| 5 | Base de datos | 19 tablas, Alembic, esquema SQL, datos de TecnoAndes |
| 6 | Motor matemático | NumPy + pruebas unitarias |
| 7 | Integración | Matrices desde ventas, casos empresariales, TanStack Query |
| 8 | Seguridad y auditoría | JWT, RBAC, auditoría, RLS |
| 9 | Reportes | Dashboard, cumplimiento, rotación, índice, CSV |
| 10 | Pruebas y documentación | 47 pruebas, CI, README y esta documentación |

## 10. Trabajo futuro

- Exportación a PDF/Excel con formato.
- Importación masiva de ventas desde CSV.
- Proyecciones con regresión lineal (mínimos cuadrados, `numpy.linalg.lstsq`).
- Multiempresa con selector de empresa para el administrador.
