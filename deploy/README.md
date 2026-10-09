# Despliegue remoto de RutinaTrack

## Configuración del entorno

Los dominios, direcciones y usuarios de ejemplo deben reemplazarse por los del entorno propio. La instancia de pruebas no es parte del servicio entregado en este repositorio.

## Qué está preparado y qué falta

Preparado: imagen Docker del frontend y API, arranque automático, catálogo inicial de 44 ejercicios, administrador aleatorio, volumen persistente, proxy HTTPS y clientes Android/iOS/Windows configurables. No se incluyen cuentas ni historiales de demo en producción.

Falta proporcionar un servidor con Docker y Docker Compose, un dominio o subdominio y acceso administrativo al servidor/DNS. El servidor debe estar encendido y accesible desde Internet. No hay ningún servicio contratado ni un backend público desplegado en este momento.

Requisitos operativos: una sola instancia de la API por volumen, almacenamiento persistente y copias de seguridad. sql.js mantiene la base en memoria: esta configuración está orientada a la tesis y a una instalación pequeña, no a un clúster. Para múltiples instancias o crecimiento importante, migrar a PostgreSQL.

## Publicar en un servidor Linux

1. Copiar el proyecto al servidor, sin node_modules, datos locales ni ejecutables de release.
2. Crear un registro DNS A para el dominio que apunte a la IP pública del servidor. Si se publica un registro AAAA, también debe apuntar a un IPv6 funcional.
3. Permitir los puertos TCP 80 y 443. No publicar el puerto interno 3001.
4. En la carpeta deploy, copiar `.env.example` a `.env`, completar DOMAIN sin protocolo y ADMIN_EMAIL.
5. Ejecutar:

```sh
docker compose --env-file .env up -d --build
docker compose ps
docker compose exec api cat /data/admin-inicial.txt
```

Caddy solicita y renueva el certificado HTTPS automáticamente cuando el DNS y los puertos son correctos. Abrir `https://DOMINIO/login` e ingresar con las credenciales del archivo. Cambiar la contraseña desde Tu cuenta y eliminar el archivo:

```sh
docker compose exec api rm /data/admin-inicial.txt
```

El servidor inicializa un administrador y el catálogo; desde Usuarios se crean entrenadores y atletas. Las contraseñas y usuarios del seed local no sirven en esta instalación nueva.

## Conectar las apps desde cualquier red

En Android/iOS, abrir la app, desplegar Servidor, ingresar `https://DOMINIO` sin `/api`, guardar y luego iniciar sesión. No se necesita estar conectado al Wi-Fi del gimnasio; sirve Wi-Fi de otra red o datos móviles.

En Windows, el login también permite Conectar a un servidor remoto. Configurar el mismo dominio y usar las mismas cuentas para trabajar con los datos centrales. La base local de escritorio queda separada; no se migra ni se sincroniza automáticamente con la nube.

También puede definirse `VITE_API_URL=https://DOMINIO` en `frontend/.env.mobile.local` antes de compilar para preconfigurar la dirección. `VITE_PUBLIC_URL` es opcional si las páginas públicas tienen otro origen. Sin URL predefinida, el usuario configura el servidor desde la app. Se exige HTTPS para el acceso remoto.

La API permite los orígenes nativos `https://localhost` de Android, `capacitor://localhost` de iOS y `http://localhost:3131` de la app de Windows. Para un frontend alojado en otro dominio, agregar exactamente ese origen a CORS_ORIGINS en el servicio api. La autenticación sigue requiriendo JWT.

PUBLIC_ORIGIN fija los QR al dominio público: los enlaces también funcionan desde otra red. El teléfono no ejecuta Express ni guarda una copia de la base; requiere conectividad para consultar o registrar datos.

## Persistencia y copias

El volumen rutinatrack-data contiene la base SQLite y el secreto JWT. `docker compose down` conserva los volúmenes; no usar `down -v` salvo que se quiera eliminar toda la instalación.

Para respaldar, detener la API y copiar todo `/data` desde el contenedor, luego volver a iniciarla. Guardar el respaldo en un destino protegido; incluye datos personales y el secreto de firma. Restaurar con la API detenida y conservar el propietario node (UID 1000).

## Validación pendiente del servidor público

No se pudo probar un despliegue remoto real porque todavía no hay servidor ni dominio provistos. Después de publicarlo: comprobar HTTPS, registro/login, roles, entrenamiento completo, CSV, QR desde otra red, reinicio del contenedor y persistencia de datos. Probar las apps en dispositivos reales con Wi-Fi y datos móviles.

Referencias: https://caddyserver.com/docs/automatic-https y https://capacitorjs.com/docs/getting-started/environment-setup
