# Tesis: sistema de gestión de entrenamientos

Proyecto universitario de gestión de gimnasio con tres roles: atleta, entrenador y administrador. La aplicación se llama RutinaTrack; este repositorio se llama tesis-gym.

## Archivos entregados

- **tesis-gym-codigo.zip:** código fuente completo con estructura de carpetas, proyectos Android/iOS, backend, frontend, Electron, pruebas, scripts y configuración de despliegue. Descomprimir antes de ejecutar los comandos.
- **DEFENSA.md:** presentación oral, arquitectura, modelo de datos, decisiones técnicas, guion de demo y preguntas frecuentes.

Esta entrega utiliza un archivo ZIP para conservar la estructura del proyecto en la carga web de GitHub. El código no está desplegado como árbol de archivos en este repositorio. No se incluyen node_modules, bases de datos, contraseñas, secretos, certificados privados ni instaladores. Las dependencias se instalan mediante los package-lock.json incluidos.

## Probar localmente

Instalar Node.js compatible (se probó el servidor con Node 22.22.1) y npm. En la carpeta extraída:

```sh
npm ci
npm --prefix frontend ci
npm --prefix backend ci
npm run build
npm --prefix backend run seed
npm --prefix backend run start:demo
```

Consultar backend/DEMO.md y README.md dentro del ZIP para el puerto y las cuentas ficticias. El seed es exclusivamente para desarrollo; no usar sus cuentas conocidas en un servidor público.

```sh
npm --prefix backend test
node --test frontend/test/server-check.test.js
```

## Tecnologías y alcance

React + Vite, CSS propio, Node.js + Express, SQLite mediante sql.js, JWT y bcryptjs. Electron permite el empaquetado de Windows; Capacitor reutiliza el frontend en los proyectos Android e iOS. Caddy sirve HTTPS y systemd mantiene el backend en Ubuntu.

Implementados: rutinas, registro de series, historial, progreso, peso corporal, permisos por rol, reportes CSV y QR público limitado. El límite de 20 repeticiones también se valida en backend.

Se generó un instalador Windows. Los proyectos Android/iOS están preparados, pero la compilación y validación nativa final siguen pendientes; no se incluye APK ni IPA. El instalador macOS tampoco está verificado. Ver DEFENSA.md para las limitaciones y los resultados comprobados.

GitHub conserva el código; no aloja el backend Express. La instancia desplegada depende de la disponibilidad de la máquina anfitriona y su VM.
