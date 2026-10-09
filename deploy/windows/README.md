# Preparación de un servidor

Los archivos de esta carpeta son ejemplos de configuración. No contienen el dominio ni la IP de una instalación particular.

Compilar la interfaz bajo /rutinatrack con node scripts/build-server.mjs. El backend local escucha en 127.0.0.1:3132 y usa backend/data-server. PUBLIC_ORIGIN debe configurarse con la URL pública real.

Para Ubuntu, usar deploy/rutinatrack.service, adaptar PUBLIC_ORIGIN y agregar el fragmento rutinatrack.caddy al proxy existente. El ejemplo deploy/Caddyfile.shared muestra cómo conservar otra aplicación en el puerto 8080. Validar la configuración antes de recargar Caddy.

Los datos persistentes y el administrador inicial deben permanecer fuera de la carpeta pública. Hacer copias con el servicio detenido.

El Caddyfile de esta carpeta es únicamente una vista previa local en 127.0.0.1:8088. No publica HTTPS. El script de firewall requiere permisos administrativos y solo corresponde si se decide alojar el proxy en Windows.

Los clientes usan una dirección como https://gym.example/rutinatrack, reemplazada por el dominio real.
