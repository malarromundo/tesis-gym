# RutinaTrack — backend, etapa 1

API REST implementada con Node.js, Express, JWT y SQLite mediante sql.js (WebAssembly). Las contraseñas usan bcryptjs: hashes bcrypt con factor 12, sin compilación nativa. Incluye el seed del Prompt 2; consultar DEMO.md para los accesos y el recorrido de prueba. Todavía no contiene frontend.

## Ejecutar

Requiere Node.js 24 o posterior. Desde esta carpeta:

```powershell
npm ci
npm run init-admin
npm start
```

La API escucha por defecto en http://127.0.0.1:3001. `GET /api/health` devuelve `{"status":"ok"}`. El administrador inicial se crea únicamente si no hay usuarios. Su contraseña aleatoria se guarda en `data/admin-inicial.txt`; no hay contraseña fija en el código. Cambiarla mediante `PATCH /api/auth/password` y eliminar el archivo después de usarlo.

Configuración opcional por variables de entorno:

| Variable | Predeterminado | Uso |
| --- | --- | --- |
| PORT | 3001 | Puerto HTTP |
| HOST | 127.0.0.1 | Interfaz de escucha |
| DATA_DIR | ./data | Carpeta de base y secreto JWT, relativa al directorio de ejecución |
| ADMIN_EMAIL | admin@rutinatrack.local | Email al inicializar la base |

SQLite se guarda en `data/rutinatrack.sqlite` y el secreto JWT en `data/jwt-secret`. Cada escritura ocurre en una transacción y se persiste mediante archivo temporal y reemplazo. Usar una única instancia del servidor por carpeta de datos; sql.js mantiene la base en memoria, por lo que no está pensado aquí para múltiples procesos o bases de gran tamaño. Respaldar los datos con el servidor detenido. No exponer este servidor HTTP directamente a Internet; un despliegue remoto requerirá HTTPS.

El backend puede servir un futuro frontend compilado en `public/`. `createApp()` permite embeber Express más adelante en Electron. La detección de IP local, el instalador y Capacitor pertenecen a etapas posteriores.

## Pruebas

```powershell
npm test
node scripts/smoke.js
```

`npm test` usa una base temporal y un servidor HTTP real en un puerto libre. Cubre autenticación, escalamiento de roles, aislamiento entre entrenadores y atletas, máximo de 20 repeticiones, consistencia de ejercicios, sesiones completadas, reportes/CSV, enlaces públicos, desactivación, reasignación, rollback, claves foráneas y persistencia.

`smoke.js` requiere el servidor iniciado y las credenciales de inicialización todavía válidas. Crea un atleta, un ejercicio y una sesión completada con dos series. Guarda las credenciales del atleta en `data/atleta-prueba.txt`. No es el seed: ejecutarlo nuevamente crea otros registros de prueba.

## Contratos

Peticiones con cuerpo: JSON. Rutas protegidas: `Authorization: Bearer TOKEN`. Los errores devuelven `{"error":"Mensaje"}` con estados 400, 401, 403, 404 o 409. Un recurso ajeno puede responder 404 para no revelar su existencia. Listados de usuarios, ejercicios, rutinas y sesiones aceptan `limit` (1–100, predeterminado 50) y `offset`.

### Auth

| Método | Ruta | Cuerpo / resultado |
| --- | --- | --- |
| POST | /api/auth/register | `{name,email,password}` → atleta. Nunca permite ADMIN/TRAINER ni trainer_id |
| POST | /api/auth/login | `{email,password}` → `{token,user}`; JWT de 8 horas |
| GET | /api/auth/me | Usuario actual, sin password_hash |
| PATCH | /api/auth/password | `{current_password,new_password}` → 204 |

Se comprueba el usuario activo en base en cada petición. El registro y login tienen un límite de 30 peticiones por IP por 15 minutos. Las contraseñas requieren al menos 8 caracteres y como máximo 72 bytes. Cambiar contraseña no revoca JWT ya emitidos; desactivar el usuario bloquea su uso inmediatamente.

### Users

| Método | Ruta | Acceso / cuerpo |
| --- | --- | --- |
| GET | /api/users | Admin; filtro `role` |
| POST | /api/users | Admin: `{name,email,password,role,trainer_id?}` |
| GET | /api/users/athletes | Trainer: propios; admin: todos |
| GET | /api/users/:id | Propio, admin o entrenador del atleta |
| PATCH | /api/users/:id | Admin: `{name?,email?,active?,trainer_id?}` |
| POST | /api/users/me/share-token/rotate | Regenera token del usuario autenticado |

No se cambian roles de cuentas existentes ni se permite desactivar al último administrador activo.

### Exercises

GET `/api/exercises` admite `q` y `muscle_group`; GET `/api/exercises/:id` devuelve el detalle. POST `/api/exercises`, PATCH y DELETE `/api/exercises/:id` requieren TRAINER o ADMIN. Cuerpo: `{name,muscle_group,description}`. `image_url` queda null. No se puede eliminar un ejercicio usado.

### Routines

GET/POST `/api/routines`, GET/PATCH `/api/routines/:id`, POST `/api/routines/:id/duplicate`. El listado admite `athlete_id` con autorización. Crear requiere:

```json
{
  "name": "Fuerza A",
  "description": "Rutina de fuerza",
  "assigned_to_id": 3,
  "exercises": [
    {"exercise_id": 1, "target_sets": 3, "target_reps": 10, "target_weight": 40}
  ]
}
```

Si crea un atleta, `assigned_to_id` se fuerza a sí mismo. El orden del array determina `order_index` desde 0. `target_weight` y `notes` son opcionales por ejercicio. PATCH admite datos, ejercicios y `active`; si la rutina ya tiene sesiones, solo admite cambiar `active`. Duplicar acepta los mismos campos como sobreescrituras. Las rutinas se desactivan, no se eliminan.

### Sessions

| Método | Ruta | Cuerpo / filtros |
| --- | --- | --- |
| GET | /api/sessions | `athlete_id`, `status`, `from`, `to` |
| POST | /api/sessions | `{routine_id?,notes?}`; atleta autenticado |
| GET | /api/sessions/:id | Incluye series e instrucciones |
| PATCH | /api/sessions/:id | `{notes}` mientras está abierta |
| POST | /api/sessions/:id/sets | `{exercise_id,routine_exercise_id?,set_number,reps,weight,rpe?}` |
| PATCH | /api/sessions/:id/sets/:setId | Campos de la serie a corregir |
| DELETE | /api/sessions/:id/sets/:setId | Quitar serie de sesión abierta |
| POST | /api/sessions/:id/complete | Completar; luego queda de solo lectura |

En sesión con rutina, `routine_exercise_id` es obligatorio y debe corresponder al ejercicio y a esa rutina. En sesión libre se omite. Repeticiones: entero de 1 a 20; peso: no negativo; RPE opcional de 1 a 10. Entrenadores y administradores consultan según sus permisos, pero no registran entrenamiento en nombre del atleta.

### Bodyweight

GET `/api/bodyweight` admite `athlete_id`, `from`, `to`. PUT `/api/bodyweight/:date` recibe `{weight_kg}` y crea o actualiza el registro propio de ese día. DELETE en esa misma ruta elimina el registro propio. Fechas: YYYY-MM-DD.

### Reports

| Ruta GET | Resultado |
| --- | --- |
| /api/reports/progress | `completed_sessions`, `weekly_volume`, `max_weight`, `body_weight` |
| /api/reports/trainer | Atletas propios (todos para admin) y actividad de últimos 30 días |
| /api/reports/admin | Usuarios por rol, sesiones diarias, 10 atletas más activos |
| /api/reports/export | CSV: `type=progress`, `trainer` o `admin`, con los mismos permisos |

Progreso acepta `athlete_id`, `exercise_id`, `from`, `to`. Progreso y admin usan por defecto los últimos 84 días, incluyendo hoy; el rango máximo es 3660 días. Las fechas y agrupaciones se interpretan en UTC; semanas desde el lunes. Si el rango empieza a mitad de semana, su primera semana contiene solo los días incluidos. Volumen = suma(peso × repeticiones), únicamente de sesiones completadas. Máximo por ejercicio = mayor carga registrada por día, no 1RM estimado. Semanas y días sin actividad se rellenan con cero. El CSV utiliza filas section/record/field/value y protege celdas que podrían ejecutarse como fórmulas.

### Public

GET `/public/share/:token` sin autenticación: nombre y rutinas activas asignadas, con instrucciones y objetivos. No incluye IDs, email, series históricas, peso corporal ni notas privadas. Token aleatorio de 256 bits, rotativo; usuarios inactivos responden 404. Quien posee el enlace puede consultar esta vista.

Las planchas medidas por tiempo se resolverán al preparar el catálogo; esta etapa conserva el modelo de repeticiones acordado y no registra segundos como repeticiones.
