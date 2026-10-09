# RutinaTrack

Actualización de acceso remoto: destino elegido `https://incomexar.sytes.net/rutinatrack`.
Publicado y verificado en Ubuntu 192.168.1.55; Incomex conserva sus rutas.
Ver `deploy/windows/README.md` para el estado comprobado y el fragmento de proxy.

Aplicación React + Vite y Express, con servidor integrado en Windows y clientes móviles Capacitor. CSS propio, fuentes incluidas en el build y ningún recurso de imágenes de ejercicios descargado.

## Probar ahora

Demo web: http://localhost:3002/login mientras el servidor esté ejecutándose. Credenciales y catálogo: backend/DEMO.md. Las pruebas visuales añadieron una sesión de Lucía con dos series; los datos actuales pueden incluir también las pruebas del usuario.

La interfaz incluye login/registro, dashboards por rol, rutinas, registro de series, historial, gráficos, peso corporal, catálogo, atletas, usuarios, reportes CSV, QR públicos y apartado Servidor para administradores.

## Windows: instalación y servidor para varios equipos

Ejecutar `release/RutinaTrack-Setup-1.0.0.exe`. Es un instalador NSIS para Windows x64, sin firma digital. No requiere instalar Node.js. La primera apertura crea un administrador aleatorio y el catálogo, no los usuarios de demo. Las credenciales se muestran en un diálogo y se guardan en la carpeta de datos del usuario; cambiarlas desde Tu cuenta.

Express corre dentro del proceso principal de Electron, con puerto 3131 por defecto. La base y el secreto JWT se guardan bajo la carpeta userData del sistema. El programa queda en la bandeja al cerrar la ventana para seguir sirviendo a otros equipos; Salir y apagar servidor detiene el servicio. No es un servicio de Windows que arranque antes de iniciar sesión: la aplicación y la PC deben seguir encendidas, sin suspensión.

En Administración → Servidor se muestran los enlaces para otros equipos de la misma red. El administrador de la PC debe permitir el puerto 3131 en el firewall de la red privada si está bloqueado; el programa no modifica el firewall automáticamente.

Para acceso desde otras redes, usar el despliegue HTTPS central descrito en deploy/README.md. Windows puede conectarse a ese mismo servidor desde el apartado del login Conectar a un servidor remoto. Cada equipo inicia sesión con su cuenta; no se comparten tokens. No hay sincronización automática entre bases independientes.

## Compilar

```powershell
npm ci
npm --prefix frontend ci
npm --prefix backend ci
npm run build
npm run dist:win
```

`dist:win` compila el frontend, lo copia a backend/public, ejecuta electron-builder y comprueba la cabecera PE del instalador. El seed solo es para desarrollo y nunca se carga en el instalador.

Para desarrollar con recarga en caliente: `npm --prefix backend run start:demo` y, en otra terminal, `npm run dev`. Vite usa el puerto 5173 y redirige la API al 3002. En este entorno restringido se validó el build compilado servido por Express; el optimizador de dependencias del servidor Vite tiene restricciones de lectura de directorios del sistema.

## Android e iOS: conexión remota

Los proyectos nativos están en android/ e ios/. Ambos incluyen el mismo frontend, no una reescritura. Requieren un servidor público HTTPS para usar las mismas cuentas desde redes distintas. El login permite configurar esa dirección sin recompilar. También se puede predefinir con VITE_API_URL en frontend/.env.mobile.local. El build web no depende de esa variable móvil.

```powershell
npm run mobile:android
npm run open:android
```

Android requiere JDK 21, SDK Platform 36 y Build Tools compatibles con el proyecto. Configurar ANDROID_HOME o `sdk.dir` en android/local.properties. Desde android/ ejecutar `gradlew.bat assembleDebug` para un APK de prueba. El APK quedará en android/app/build/outputs/apk/debug/app-debug.apk. Para distribución, generar una compilación release firmada con una clave propia.

```sh
npm run mobile:ios
npm run open:ios
```

iOS requiere una Mac con Xcode 26 o posterior y la configuración de firma de Apple. El proyecto usa Swift Package Manager. La generación/sincronización del proyecto se realizó desde Windows, pero la compilación y pruebas nativas requieren esas herramientas.

Android bloquea tráfico HTTP sin cifrar; no contiene una IP LAN como backend fijo. iOS conserva las políticas HTTPS del sistema. No se garantiza funcionamiento offline: las operaciones necesitan conexión al servidor.

## Validación y límites actuales

- Login visual verificado como atleta, entrenador y administrador.
- Registro de dos series, finalización, historial y aumento de 900 kg·repeticiones comprobados en la interfaz.
- Diseño revisado en pantalla de celular.
- Backend: pruebas de permisos, integridad SQL, seed, clientes concurrentes y CORS.
- Runtime empaquetado Electron: frontend servido, Express embebido, SQLite/WASM, bcrypt y persistencia verificados.
- Ejecutable Windows: cabeceras MZ/PE verificadas. No se ejecutó una instalación completa del NSIS en el sistema del usuario.
- Android: proyecto generado; el intento de Gradle llegó a un bloqueo por SDK no encontrado/configurado. No se produjo un APK en esta máquina.
- iOS: proyecto generado; no se produjo un IPA en Windows.
- Servidor público: desplegado en Ubuntu con Caddy y systemd. Se verificaron HTTPS, login y respuesta después de reiniciar. La disponibilidad depende de la PC, la VM y la conexión.
- Las planchas están en el catálogo, pero la medición por duración sigue pendiente; se excluyen del selector de rutinas y sesiones libres para no contarlas como repeticiones.
- El CSV está comprobado en web/escritorio. La descarga de archivos en WebViews móviles deberá verificarse en dispositivos reales; si la WebView no maneja descargas blob, habrá que integrar Filesystem/Share de Capacitor.

Referencias de plataforma: [Capacitor](https://capacitorjs.com/docs/getting-started/environment-setup), [Electron Builder NSIS](https://www.electron.build/nsis/).
