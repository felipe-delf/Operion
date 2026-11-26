"""
test_database_config.py — Valida configuração de conexão MariaDB, compilação DDL
e sincronização não destrutiva de schema.
"""
from sqlalchemy import Column, String, Text, create_engine, event, inspect, text
from sqlalchemy.dialects import mysql
from sqlalchemy.schema import CreateTable

from app.core.database import (
    _build_widen_column_sql,
    build_database_url,
    sync_database_schema,
)
from app.models.base import Base
import app.models.user          # noqa: F401
import app.models.user_group    # noqa: F401
import app.models.script        # noqa: F401
import app.models.audit         # noqa: F401
import app.models.agent         # noqa: F401
import app.models.execution_log # noqa: F401


def test_build_database_url_defaults_to_mariadb_without_sqlite_fallback(monkeypatch):
    for var in ("DATABASE_URL", "DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD"):
        monkeypatch.delenv(var, raising=False)

    url = build_database_url()
    assert url.drivername == "mysql+pymysql"
    assert url.host == "localhost"
    assert url.port == 3306
    assert url.database == "operion"
    assert url.username == "operion"


def test_build_database_url_mariadb_from_env(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.setenv("DB_HOST", "db.example.local")
    monkeypatch.setenv("DB_PORT", "3306")
    monkeypatch.setenv("DB_NAME", "OPERION")
    monkeypatch.setenv("DB_USER", "usuario.operion")
    monkeypatch.setenv("DB_PASSWORD", "S3nh@:Especial/#%")

    url = build_database_url()
    assert url.drivername == "mysql+pymysql"
    assert url.host == "db.example.local"
    assert url.port == 3306
    assert url.database == "OPERION"
    assert url.username == "usuario.operion"
    assert url.password == "S3nh@:Especial/#%"
    assert url.query.get("charset") == "utf8mb4"


def test_build_database_url_normalizes_mariadb_scheme(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "mariadb://usuario.operion:secret@db.example.local:3306/OPERION")
    url = build_database_url()
    assert url == "mariadb+pymysql://usuario.operion:secret@db.example.local:3306/OPERION"


def test_all_models_compile_for_mariadb():
    dialect = mysql.dialect()
    for table in Base.metadata.sorted_tables:
        ddl = str(CreateTable(table).compile(dialect=dialect))
        assert f"CREATE TABLE {table.name}" in ddl


def test_sync_schema_does_nothing_when_structure_matches():
    mem_engine = create_engine("sqlite:///:memory:")

    first = sync_database_schema(mem_engine)
    assert len(first["tables_created"]) == len(Base.metadata.sorted_tables)
    assert first["columns_added"] == []

    ddl_statements = []

    @event.listens_for(mem_engine, "before_cursor_execute")
    def _track_sql(conn, cursor, statement, parameters, context, executemany):
        upper = statement.strip().upper()
        if upper.startswith(("CREATE", "ALTER", "DROP", "INSERT", "UPDATE", "DELETE")):
            ddl_statements.append(statement)

    second = sync_database_schema(mem_engine)
    assert second == {"tables_created": [], "columns_added": [], "columns_adapted": []}
    assert ddl_statements == []


def test_sync_schema_adapts_existing_tables_without_losing_data():
    mem_engine = create_engine("sqlite:///:memory:")

    # Simula banco legado com tabelas parciais, colunas ausentes e dados existentes
    with mem_engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE audit_groups (
                id INTEGER PRIMARY KEY,
                nome VARCHAR(150) NOT NULL UNIQUE
            )
        """))
        conn.execute(text("INSERT INTO audit_groups (id, nome) VALUES (1, 'Grupo Legado')"))

        conn.execute(text("""
            CREATE TABLE usuarios (
                id INTEGER PRIMARY KEY,
                email VARCHAR(100) NOT NULL UNIQUE,
                senha_hash VARCHAR(255) NOT NULL,
                role VARCHAR(50),
                ativo BOOLEAN DEFAULT 1
            )
        """))
        conn.execute(text(
            "INSERT INTO usuarios (id, email, senha_hash, role, ativo) "
            "VALUES (1, 'legado@empresa.com', 'hash', 'Admin', 1)"
        ))

    report = sync_database_schema(mem_engine)

    # Apenas as tabelas que faltavam foram criadas
    assert "audit_groups" not in report["tables_created"]
    assert "usuarios" not in report["tables_created"]
    assert "scripts" in report["tables_created"]
    assert "execution_logs" in report["tables_created"]

    # Colunas ausentes foram adicionadas
    assert "audit_groups.descricao" in report["columns_added"]
    assert "usuarios.grupo_id" in report["columns_added"]
    assert "usuarios.exige_troca_senha" in report["columns_added"]

    # Dados existentes permaneceram intactos
    with mem_engine.connect() as conn:
        grupo_nome = conn.execute(text("SELECT nome FROM audit_groups WHERE id = 1")).scalar()
        email, exige_troca = conn.execute(
            text("SELECT email, exige_troca_senha FROM usuarios WHERE id = 1")
        ).fetchone()
        assert grupo_nome == "Grupo Legado"
        assert email == "legado@empresa.com"
        assert bool(exige_troca) is True

        # Todas as colunas do model agora existem
        cols = {c["name"] for c in inspect(conn).get_columns("audit_groups")}
        assert {"id", "nome", "descricao"}.issubset(cols)


def test_widen_column_sql_for_mariadb():
    class _FakeConn:
        dialect = mysql.dialect()

    conn = _FakeConn()
    col_text = Column("sql_query", Text)
    sql = _build_widen_column_sql(conn, "audit_rules", col_text, {"type": String(50), "nullable": True})
    assert sql == "ALTER TABLE audit_rules MODIFY COLUMN sql_query TEXT NULL"

    # Já é TEXT -> não faz nada
    assert _build_widen_column_sql(conn, "audit_rules", col_text, {"type": Text(), "nullable": True}) is None

    # VARCHAR já suficiente -> não faz nada
    col_v150 = Column("nome", String(150))
    assert _build_widen_column_sql(conn, "audit_rules", col_v150, {"type": String(200), "nullable": False}) is None

    # VARCHAR menor -> amplia preservando NOT NULL
    sql_widen = _build_widen_column_sql(conn, "audit_rules", col_v150, {"type": String(50), "nullable": False})
    assert sql_widen == "ALTER TABLE audit_rules MODIFY COLUMN nome VARCHAR(150) NOT NULL"
