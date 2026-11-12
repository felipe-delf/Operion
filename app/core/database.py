from datetime import datetime, timezone
from pathlib import Path
import os
import shutil

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker
from app.models.base import Base

# Para começar rápido e simplificar testes, usaremos SQLite localmente.
# Em produção, aponte DATABASE_URL para um banco persistente e faça backup antes
# de atualizar o código.
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./parametrizacao.db")

engine_kwargs = {}
if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}
engine = create_engine(SQLALCHEMY_DATABASE_URL, **engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Migrações somente aditivas. Nunca usamos drop_all, DELETE ou recriação das
# tabelas durante a inicialização: scripts, usuários e logs existentes ficam
# preservados durante um deploy.
MIGRATIONS = {
    1: [
        ("pc_status_snapshots", "db_size_mb", "BIGINT"),
        ("pc_status_snapshots", "db_mdf_size_mb", "BIGINT"),
        ("pc_status_snapshots", "db_ldf_size_mb", "BIGINT"),
        ("pc_status_snapshots", "disco_total_gb", "INTEGER"),
        ("pc_status_snapshots", "disco_livre_gb", "INTEGER"),
        ("pc_status_snapshots", "backup_dias_atras", "INTEGER"),
        ("scripts", "criado_por", "VARCHAR(100)"),
        ("scripts", "modificado_por", "VARCHAR(100)"),
        ("scripts", "grupo", "VARCHAR(100)"),
        ("usuarios", "grupo_id", "INTEGER"),
        ("usuarios", "exige_troca_senha", "BOOLEAN DEFAULT 1"),
        ("user_grupos", "parent_id", "INTEGER"),
    ],
}


def _backup_sqlite_before_migration():
    if not SQLALCHEMY_DATABASE_URL.startswith("sqlite:///") or SQLALCHEMY_DATABASE_URL.endswith(":memory:"):
        return
    db_path = Path(SQLALCHEMY_DATABASE_URL.removeprefix("sqlite:///"))
    if not db_path.is_absolute():
        db_path = Path.cwd() / db_path
    if not db_path.exists() or db_path.stat().st_size == 0:
        return
    backup_dir = Path(os.getenv("DATABASE_BACKUP_DIR", str(db_path.parent / "backups")))
    backup_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    shutil.copy2(db_path, backup_dir / f"{db_path.stem}-{stamp}.db")


def _apply_migrations():
    with engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version INTEGER PRIMARY KEY,
                applied_at VARCHAR(40) NOT NULL
            )
        """))
        applied = {row[0] for row in conn.execute(text("SELECT version FROM schema_migrations"))}

        for version, changes in sorted(MIGRATIONS.items()):
            if version in applied:
                continue
            inspector = inspect(conn)
            for table, column, column_type in changes:
                if table not in inspector.get_table_names():
                    continue
                columns = {item["name"] for item in inspector.get_columns(table)}
                if column not in columns:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {column_type}"))
                    inspector = inspect(conn)
            conn.execute(
                text("INSERT INTO schema_migrations (version, applied_at) VALUES (:version, :applied_at)"),
                {"version": version, "applied_at": datetime.now(timezone.utc).isoformat()},
            )


def create_tables():
    Base.metadata.create_all(bind=engine)
    # O backup acontece apenas quando há migração pendente; não gera cópia a
    # cada restart do servidor.
    with engine.connect() as conn:
        conn.execute(text("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at VARCHAR(40) NOT NULL)"))
        applied = {row[0] for row in conn.execute(text("SELECT version FROM schema_migrations"))}
    if any(version not in applied for version in MIGRATIONS):
        _backup_sqlite_before_migration()
    _apply_migrations()
