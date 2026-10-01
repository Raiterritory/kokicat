# Mejoras del bossfight, skins arcoíris y exportación APK

## Resultado
- El jefe seguirá la altura del personaje con suavidad, sin pegarse de forma injusta.
- Cada rayo fijará un objetivo cercano a Koki, mostrará una advertencia clara y luego disparará en esa posición, dejando tiempo suficiente para esquivarlo.
- Las variantes “Arcoíris” mostrarán simultáneamente morado, azul, verde, amarillo y rojo sobre la silueta real del personaje, tanto en el selector como durante la partida.
- La exportación offline quedará revisada y documentada para Capacitor.

## Implementación
1. Ajustar el movimiento vertical, frecuencia, anticipación y zona de impacto del jefe para un combate fácil pero activo.
2. Separar la lógica visual reutilizable de skins y jefe del archivo principal, reduciendo su complejidad sin cambiar las reglas existentes.
3. Sustituir el filtro monocromático de las skins arcoíris por una máscara multicolor animada que conserva la imagen del personaje.
4. Verificar el flujo principal en pantalla y generar el paquete estático offline; revisar que no haya errores ni solicitudes externas.
5. Actualizar las instrucciones de exportación APK solo si hace falta.

## Detalles técnicos
- El seguimiento tendrá interpolación y límites verticales; los disparos conservarán el punto fijado al terminar su aviso.
- El efecto arcoíris se dibujará con composición de Canvas y gradiente lineal; la vista del selector usará una superposición CSS equivalente.
- Se mantendrá `dist-static` como carpeta de entrada de Capacitor y no se cambiarán partidas, precios ni datos guardados.
