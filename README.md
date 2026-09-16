# SignaFree Frontend

Aplicación web de **SignaFree**, plataforma para el aprendizaje de la Lengua de Señas Peruana. Este frontend, construido en Angular, permite a los usuarios acceder a lecciones, practicar señas mediante reconocimiento con la cámara, gestionar el dataset de videos de entrenamiento y hacer seguimiento de su progreso de aprendizaje.

## Tecnologías principales

- **Angular 19** (standalone application builder)
- **Angular Material** y **Bootstrap 5** para la interfaz
- **MediaPipe** (`camera_utils`, `drawing_utils`, `hands`, `selfie_segmentation`) para el procesamiento de video en tiempo real
- **TensorFlow.js** (`handpose`) para el reconocimiento de manos
- **Chart.js** para estadísticas y gráficos de progreso
- **jsPDF** / **jspdf-autotable** para generación de reportes en PDF
- **SweetAlert2** y **ngx-toastr** para notificaciones
- **xlsx** para exportación de datos a Excel
- **Flatpickr** para selección de fechas

## Requisitos

- Node.js 18 o superior (recomendado 20 LTS)
- npm 9 o superior
- Angular CLI 19 (`npm install -g @angular/cli@19`)

## Instalación

```bash
git clone <url-del-repositorio>
cd signa-free-frontend-v2
npm install
```

## Configuración

El proyecto consume la API del backend de SignaFree. Verifica y ajusta la URL base de la API en los archivos de entorno de Angular (`src/environments/environment.ts` y `environment.prod.ts`), por ejemplo:

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8000/api/v1'
};
```

## Ejecución en desarrollo

```bash
npm start
```

Esto ejecuta `ng serve` y levanta la aplicación en `http://localhost:4200/`. La app se recarga automáticamente al detectar cambios en el código fuente.

## Compilación para producción

```bash
npm run build
```

Los artefactos compilados se generan en `dist/signaFree-frontend-v2/browser`, listos para ser servidos por cualquier servidor web estático (Nginx, Apache, etc.).

Compilación en modo desarrollo (sin optimizaciones):

```bash
ng build --configuration development
```

## Pruebas

```bash
npm test
```

Ejecuta las pruebas unitarias con [Karma](https://karma-runner.github.io) sobre el framework [Jasmine](https://jasmine.github.io/).

## Estructura del proyecto

```text
src/
├── app/              # Componentes, servicios, módulos y rutas de Angular
├── assets/           # Imágenes, íconos y recursos estáticos
├── environments/      # Configuración por entorno (desarrollo/producción)
├── index.html
├── main.ts
└── styles.scss       # Estilos globales
angular.json          # Configuración del workspace de Angular CLI
package.json          # Dependencias y scripts del proyecto
tsconfig*.json        # Configuración de TypeScript
```

## Funcionalidades principales

- Autenticación e inicio de sesión de usuarios.
- Visualización de lecciones y clases organizadas por categorías.
- Prácticas de señas con reconocimiento por cámara en tiempo real (MediaPipe + TensorFlow.js).
- Exámenes y seguimiento de resultados.
- Panel de progreso, estadísticas y gamificación.
- Gestión de dataset de videos de entrenamiento (carga, revisión y administración de imágenes/videos).
- Generación de reportes en PDF y exportación de datos a Excel.
- Panel de administración de contenido, usuarios y modelos de IA.

## Despliegue con Docker

El proyecto incluye un `Dockerfile` multi-stage (build con Node, servido con Nginx) y un `nginx.conf` con soporte de rutas SPA. Para construir la imagen:

```bash
docker build -t signafree-frontend .
```

Para ejecutarlo junto al backend y la base de datos, consulta el `docker-compose.yml` de la raíz del proyecto.

## Notas de compatibilidad

- El acceso a la cámara para las prácticas de reconocimiento de señas requiere un contexto seguro (HTTPS o `localhost`); en producción, sirve la aplicación siempre bajo HTTPS.
- Las librerías de MediaPipe y TensorFlow.js se cargan y ejecutan en el navegador del usuario; equipos con hardware limitado pueden experimentar menor fluidez en el reconocimiento en tiempo real.
