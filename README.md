# VIOMAR

Aplicación web de VIOMAR.

## Desarrollo

### Instalar dependencias

```bash
pnpm install
```

### Ejecutar en modo desarrollo

```bash
pnpm dev
```

## PostgreSQL (Docker)

### 1) Levantar la base

En la raíz del proyecto:

```bash
docker compose up -d
```

Verifica:

```bash
docker ps
```

### 2) Variables de entorno (local)

Archivo `.env.local`:

```bash
DATABASE_URL=postgresql://biomar_user:biomar_pass@localhost:5432/biomar_db
```

## License

Ver [LICENSE](LICENSE).
