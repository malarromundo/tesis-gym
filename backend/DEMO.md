# Demo del seed — etapa 2

La base `data-demo/rutinatrack.sqlite` está separada de `data/`, usada en la etapa anterior. El seed exige una base vacía y rechaza una segunda ejecución sin borrar ni duplicar datos. No ejecutarlo sobre una carpeta que tenga un servidor activo.

```powershell
npm run seed
npm run start:demo
```

La demo escucha en http://127.0.0.1:3002. En otra terminal, `npm run verify:demo` verifica los cuatro accesos, catálogo, rutinas, historial, progresión, reporte global y enlace público mediante HTTP. No agrega registros.

| Rol | Email | Contraseña de demo |
| --- | --- | --- |
| Administrador | admin@demo.local | Admin123! |
| Entrenador | entrenador@demo.local | Entrena123! |
| Atleta con historial | lucia@demo.local | Lucia123! |
| Atleta para empezar | diego@demo.local | Diego123! |

Son credenciales públicas de demostración, no de producción. Se muestran en consola al cargar el seed; los hashes se guardan con bcrypt y los tokens QR son aleatorios.

## Datos cargados

44 ejercicios: 10 piernas, 7 pecho, 8 espalda, 6 hombros, 7 brazos y 6 core. Cada uno tiene dos oraciones originales de instrucciones, sin imágenes. Las planchas están en el catálogo, pero no en las rutinas: la medición por duración sigue pendiente y no se simula con repeticiones.

4 usuarios, 2 rutinas con 4 ejercicios cada una, 27 sesiones completadas, 324 series y 18 registros de peso corporal. Ambos atletas están asignados al entrenador.

Lucía entrena lunes, miércoles y viernes durante las nueve semanas completas anteriores a la semana de ejecución del seed. Sentadilla progresa de 30 a 50 kg; press de banca de 25 a 35 kg; remo con barra de 30 a 40 kg. El peso corporal tiene una tendencia de 72 a 70,9 kg con pequeñas oscilaciones. Son datos sintéticos para demostrar el software, no una prescripción personalizada de entrenamiento.

Diego tiene su rutina asignada, sin historial, para probar cómo comienza un atleta nuevo. Cada ejecución en una carpeta vacía calcula las fechas respecto del día actual.

## Probar el ciclo de entrenamiento en PowerShell

Todavía no hay interfaz visual; se implementa en las siguientes etapas. Este ejemplo permite recorrer el flujo real de la API:

```powershell
$api = 'http://127.0.0.1:3002'
$login = Invoke-RestMethod "$api/api/auth/login" -Method Post -ContentType 'application/json' -Body (@{email='diego@demo.local';password='Diego123!'} | ConvertTo-Json)
$headers = @{Authorization="Bearer $($login.token)"}
$routines = Invoke-RestMethod "$api/api/routines" -Headers $headers
$routine = Invoke-RestMethod "$api/api/routines/$($routines[0].id)" -Headers $headers
$routine.exercises | Format-Table name,target_sets,target_reps,target_weight
$session = Invoke-RestMethod "$api/api/sessions" -Method Post -Headers $headers -ContentType 'application/json' -Body (@{routine_id=$routine.id} | ConvertTo-Json)
$exercise = $routine.exercises[0]
$body = @{exercise_id=$exercise.exercise_id;routine_exercise_id=$exercise.id;set_number=1;reps=12;weight=60} | ConvertTo-Json
Invoke-RestMethod "$api/api/sessions/$($session.id)/sets" -Method Post -Headers $headers -ContentType 'application/json' -Body $body
Invoke-RestMethod "$api/api/sessions/$($session.id)/complete" -Method Post -Headers $headers -ContentType 'application/json' -Body '{}'
Invoke-RestMethod "$api/api/sessions?status=COMPLETED" -Headers $headers
Invoke-RestMethod "$api/api/reports/progress" -Headers $headers | ConvertTo-Json -Depth 8
```

Este ejemplo agrega una sesión y una serie a Diego: el volumen esperado es 720 kg·repeticiones. Si se repite, agrega otra sesión. Con el entrenador se puede consultar `/api/reports/trainer`; con admin, `/api/reports/admin`. El resto de los contratos está en README.md.
