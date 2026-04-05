# Argenbot

## ⚙️ Requisitos
- [Bun](https://bun.sh/docs/installation) (o superior) o tener [Docker](https://www.docker.com/)
- Base de datos MongoDB
- Un Token de Bot de Discord

## 🐳 Despliegue en Docker

El `Dockerfile` incluido prepara un entorno listo para producción, configurando automáticamente un entorno ligero de Chromium para la generación de imágenes en los comandos del bot (como las de _plantilla_ o _fixture_).

1. Construye la Imagen:
   ```bash
   docker build -t argenbot .
   ```

2. Lanza el Contenedor en segundo plano (leyendo tu `.env` actual):
   ```bash
   docker run -d --name argenbot-prod --env-file .env argenbot
   ```
