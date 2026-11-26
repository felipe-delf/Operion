import os

from dotenv import load_dotenv
from sqlalchemy import String, Text, create_engine, inspect, text
from sqlalchemy.engine import URL, make_url
from sqlalchemy.orm import sessionmaker
from app.models.base import Base

load_dotenv()


def _normalize_database_url(raw_url: str) -> str:
    """Garante que URLs MySQL/MariaDB sem driver explícito usem PyMySQL."""
    if raw_url.startswith("mariadb://"):
        return "mariadb+pymysql://" + raw_url.removeprefix("mariadb://")
    if raw_url.startswith("mysql://"):
        return "mysql+pymysql://" + raw_url.removeprefix("mysql://")
    return raw_url


def build_database_url() -> str | URL:
    """Resolve a URL do banco MariaDB via variáveis DB_* (ou DATABASE_URL explícita)."""
    explicit_url = os.getenv("DATABASE_URL", "").strip()
    if explicit_url:
        return _normalize_database_url(explicit_url)

    db_host = os.getenv("DB_HOST", "localhost").strip()
    db_port = int(os.getenv("DB_PORT", "3306"))
    db_name = os.getenv("DB_NAME", "operion").strip()
    db_user = os.getenv("DB_USER", "operion").strip()
    db_password = os.getenv("DB_PASSWORD", "")
    return URL.create(
        drivername="mysql+pymysql",
        username=db_user,
        password=db_password,
        host=db_host,
        port=db_port,
        database=db_name,
        query={"charset": "utf8mb4"},
    )


# Em produção, conecta ao MariaDB via DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD.
# DATABASE_URL pode sobrescrever a conexão (usado pelos testes automatizados).
SQLALCHEMY_DATABASE_URL = build_database_url()
_parsed_url = make_url(SQLALCHEMY_DATABASE_URL)

engine_kwargs = {}
if _parsed_url.get_backend_name() == "sqlite":
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    connect_args = {"connect_timeout": 10}
    if _parsed_url.get_backend_name() in ("mysql", "mariadb") and "charset" not in _parsed_url.query:
        connect_args["charset"] = "utf8mb4"
    engine_kwargs["connect_args"] = connect_args
    engine_kwargs["pool_pre_ping"] = True
    engine_kwargs["pool_recycle"] = 1800

engine = create_engine(SQLALCHEMY_DATABASE_URL, **engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _import_all_models() -> None:
    """Garante que todos os models estejam registrados no Base.metadata."""
    import app.models.user           # noqa: F401
    import app.models.user_group     # noqa: F401
    import app.models.script         # noqa: F401
    import app.models.audit          # noqa: F401
    import app.models.agent          # noqa: F401
    import app.models.execution_log  # noqa: F401


def _scalar_default_sql(column) -> str:
    """Retorna cláusula DEFAULT segura para valores escalares em ADD COLUMN."""
    if column.default is None or not column.default.is_scalar:
        return ""
    arg = column.default.arg
    if isinstance(arg, bool):
        return f" DEFAULT {1 if arg else 0}"
    if isinstance(arg, (int, float)):
        return f" DEFAULT {arg}"
    if isinstance(arg, str):
        escaped = arg.replace("'", "''")
        return f" DEFAULT '{escaped}'"
    return ""


def _build_add_column_sql(conn, table_name: str, column) -> str:
    preparer = conn.dialect.identifier_preparer
    quoted_table = preparer.quote(table_name)
    quoted_col = preparer.quote(column.name)
    col_type_sql = column.type.compile(dialect=conn.dialect)
    default_sql = _scalar_default_sql(column)
    return f"ALTER TABLE {quoted_table} ADD COLUMN {quoted_col} {col_type_sql}{default_sql}"


def _build_widen_column_sql(conn, table_name: str, column, db_col: dict) -> str | None:
    """
    Em MySQL/MariaDB, adapta colunas VARCHAR menores que o model sem perda de dados.
    Nunca reduz tamanho nem altera colunas compatíveis.
    """
    if conn.dialect.name not in ("mysql", "mariadb"):
        return None
    if column.index or column.unique:
        return None

    db_type = db_col.get("type")
    is_db_varchar = isinstance(db_type, String) and not isinstance(db_type, Text)
    if not is_db_varchar:
        return None

    target_type_sql = None
    if isinstance(column.type, Text):
        target_type_sql = "TEXT"
    elif isinstance(column.type, String) and column.type.length is not None:
        if db_type.length is not None and db_type.length < column.type.length:
            target_type_sql = f"VARCHAR({column.type.length})"

    if not target_type_sql:
        return None

    preparer = conn.dialect.identifier_preparer
    quoted_table = preparer.quote(table_name)
    quoted_col = preparer.quote(column.name)
    null_clause = "NULL" if db_col.get("nullable", True) else "NOT NULL"
    return f"ALTER TABLE {quoted_table} MODIFY COLUMN {quoted_col} {target_type_sql} {null_clause}"


def sync_database_schema(target_engine=None) -> dict:
    """
    Inspeciona o banco e sincroniza tabelas/colunas de forma não destrutiva:
    - Cria apenas tabelas ausentes.
    - Em tabelas existentes, adiciona apenas colunas ausentes (e amplia VARCHAR em MariaDB quando necessário).
    - Se tudo já estiver na estrutura esperada, não executa nenhuma alteração.
    """
    _import_all_models()
    target = target_engine or engine
    report = {"tables_created": [], "columns_added": [], "columns_adapted": []}

    with target.begin() as conn:
        inspector = inspect(conn)
        existing_tables = {name.lower(): name for name in inspector.get_table_names()}

        missing_tables = [
            table for table in Base.metadata.sorted_tables
            if table.name.lower() not in existing_tables
        ]

        pending_alters: list[tuple[str, str, str, str]] = []
        for table in Base.metadata.sorted_tables:
            actual_table_name = existing_tables.get(table.name.lower())
            if not actual_table_name:
                continue
            existing_cols = {
                col["name"].lower(): col for col in inspector.get_columns(actual_table_name)
            }
            for column in table.columns:
                existing_col = existing_cols.get(column.name.lower())
                if existing_col is None:
                    sql = _build_add_column_sql(conn, actual_table_name, column)
                    pending_alters.append(("add", actual_table_name, column.name, sql))
                else:
                    widen_sql = _build_widen_column_sql(conn, actual_table_name, column, existing_col)
                    if widen_sql:
                        pending_alters.append(("adapt", actual_table_name, column.name, widen_sql))

        if not missing_tables and not pending_alters:
            print("[DB] Estrutura verificada: todas as tabelas já estão corretas. Nenhuma alteração aplicada.")
            return report

        if missing_tables:
            Base.metadata.create_all(bind=conn, tables=missing_tables)
            report["tables_created"] = [t.name for t in missing_tables]
            print(f"[DB] Tabelas criadas: {', '.join(report['tables_created'])}")

        for kind, table_name, col_name, sql in pending_alters:
            conn.execute(text(sql))
            if kind == "add":
                report["columns_added"].append(f"{table_name}.{col_name}")
            else:
                report["columns_adapted"].append(f"{table_name}.{col_name}")

        if report["columns_added"]:
            print(f"[DB] Colunas adicionadas: {', '.join(report['columns_added'])}")
        if report["columns_adapted"]:
            print(f"[DB] Colunas adaptadas: {', '.join(report['columns_adapted'])}")

    return report


def create_tables():
    return sync_database_schema(engine)
