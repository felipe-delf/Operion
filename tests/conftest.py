"""
conftest.py — Fixtures globais para os testes da API.
Cria um banco SQLite em memória isolado por sessão de testes,
nunca tocando no banco de produção parametrizacao.db.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.base import Base

# Importa TODOS os modelos para garantir que o Base.metadata conheça todas as tabelas
# antes de executar create_all. Sem isso, FKs cruzadas quebram no SQLite em memória.
import app.models.user          # noqa: F401 — registra 'usuarios' e 'user_script_access'
import app.models.user_group    # noqa: F401 — registra 'user_grupos'
import app.models.script        # noqa: F401 — registra 'scripts'
import app.models.audit         # noqa: F401 — registra 'audit_rules' e 'audit_groups'
import app.models.agent         # noqa: F401 — registra 'pc_status_snapshots'
import app.models.execution_log # noqa: F401 — registra 'execution_logs'

from app.core.database import get_db
from app.core.security import get_password_hash
from app.models.user import UserModel
from app.models.user_group import UserGroupModel

# ── Banco em memória isolado ──────────────────────────────────────────────────
TEST_DATABASE_URL = "sqlite:///:memory:"

engine_test = create_engine(
    TEST_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine_test)


@pytest.fixture(scope="session", autouse=True)
def create_test_tables():
    """Cria todas as tabelas no banco de teste antes dos testes."""
    Base.metadata.create_all(bind=engine_test)
    yield
    Base.metadata.drop_all(bind=engine_test)


@pytest.fixture()
def db_session():
    """
    Retorna uma sessão de banco de dados com rollback automático após cada teste.
    Garante isolamento total entre os testes.
    """
    connection = engine_test.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture()
def client(db_session):
    """
    Retorna um TestClient da FastAPI com a dependência de banco substituída
    pelo banco de teste em memória.
    """
    # Import aqui para evitar que o main.py faça seed no banco de produção
    from app.main import app

    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture()
def admin_group(db_session):
    """Cria e retorna o grupo Administradores no banco de teste."""
    grupo = UserGroupModel(
        nome="Administradores",
        descricao="Grupo de TI com acesso total",
        permissoes="VER_DASHBOARD,EXECUTAR_SCRIPT,GERENCIAR_COFRE,GERENCIAR_AUDITORIA,VER_LOGS,EXECUTAR_BROADCAST,GERENCIAR_EQUIPE"
    )
    db_session.add(grupo)
    db_session.commit()
    db_session.refresh(grupo)
    return grupo


@pytest.fixture()
def suporte_group(db_session):
    """Cria e retorna o grupo Suporte N1 com permissões básicas."""
    grupo = UserGroupModel(
        nome="Suporte N1",
        descricao="Grupo de suporte básico",
        permissoes="VER_DASHBOARD"
    )
    db_session.add(grupo)
    db_session.commit()
    db_session.refresh(grupo)
    return grupo


@pytest.fixture()
def admin_user(db_session, admin_group):
    """Cria e retorna um usuário administrador."""
    user = UserModel(
        email="admin@teste.com",
        senha_hash=get_password_hash("Admin@123"),
        role="Admin",
        grupo_id=admin_group.id,
        ativo=True,
        exige_troca_senha=False
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture()
def suporte_user(db_session, suporte_group):
    """Cria e retorna um usuário de suporte N1 com permissões limitadas."""
    user = UserModel(
        email="suporte@teste.com",
        senha_hash=get_password_hash("Suporte@123"),
        role="User",
        grupo_id=suporte_group.id,
        ativo=True,
        exige_troca_senha=False
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture()
def admin_token(client, admin_user):
    """Faz login como admin e retorna o token JWT."""
    res = client.post("/api/auth/login", json={
        "email": "admin@teste.com",
        "senha": "Admin@123"
    })
    assert res.status_code == 200
    return res.json()["access_token"]


@pytest.fixture()
def suporte_token(client, suporte_user):
    """Faz login como suporte N1 e retorna o token JWT."""
    res = client.post("/api/auth/login", json={
        "email": "suporte@teste.com",
        "senha": "Suporte@123"
    })
    assert res.status_code == 200
    return res.json()["access_token"]


def auth_headers(token: str) -> dict:
    """Helper para gerar headers de autorização."""
    return {"Authorization": f"Bearer {token}"}
