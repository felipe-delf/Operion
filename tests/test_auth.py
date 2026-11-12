"""
test_auth.py — Testes de Autenticação e Controle de Sessão.
Cobre: login, credenciais inválidas, usuário inativo, troca de senha obrigatória.
"""
import pytest
from tests.conftest import auth_headers
from app.core.rate_limit import reset_login_limits


@pytest.fixture(autouse=True)
def clear_rate_limits():
    reset_login_limits()
    yield
    reset_login_limits()


class TestLogin:
    """Suite de testes para o endpoint POST /api/auth/login"""

    def test_login_admin_sucesso(self, client, admin_user):
        """Admin com credenciais corretas deve receber token e permissões completas."""
        res = client.post("/api/auth/login", json={
            "email": "admin@teste.com",
            "senha": "Admin@123"
        })
        assert res.status_code == 200
        data = res.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["role"] == "Administradores"
        assert "GERENCIAR_EQUIPE" in data["permissions"]
        assert "GERENCIAR_COFRE" in data["permissions"]
        assert "VER_LOGS" in data["permissions"]
        assert "EXECUTAR_BROADCAST" in data["permissions"]

    def test_login_suporte_recebe_permissoes_limitadas(self, client, suporte_user):
        """Usuário Suporte N1 deve receber apenas as permissões do seu grupo."""
        res = client.post("/api/auth/login", json={
            "email": "suporte@teste.com",
            "senha": "Suporte@123"
        })
        assert res.status_code == 200
        data = res.json()
        assert data["role"] == "Suporte N1"
        assert "VER_DASHBOARD" in data["permissions"]
        # Suporte N1 NÃO deve ter estas permissões
        assert "GERENCIAR_COFRE" not in data["permissions"]
        assert "VER_LOGS" not in data["permissions"]
        assert "GERENCIAR_EQUIPE" not in data["permissions"]

    def test_login_senha_errada_retorna_401(self, client, admin_user):
        """Senha incorreta deve retornar 401."""
        res = client.post("/api/auth/login", json={
            "email": "admin@teste.com",
            "senha": "SenhaErrada"
        })
        assert res.status_code == 401
        assert "inválidos" in res.json()["detail"].lower()

    def test_login_email_inexistente_retorna_401(self, client):
        """Email não cadastrado deve retornar 401 (não 404 - segurança por enumeração)."""
        res = client.post("/api/auth/login", json={
            "email": "naoexiste@teste.com",
            "senha": "qualquer"
        })
        assert res.status_code == 401

    def test_login_bloqueia_tentativas_repetidas(self, client, admin_user):
        for _ in range(5):
            res = client.post("/api/auth/login", json={"email": "admin@teste.com", "senha": "errada"})
            assert res.status_code == 401
        blocked = client.post("/api/auth/login", json={"email": "admin@teste.com", "senha": "Admin@123"})
        assert blocked.status_code == 429
        assert "Retry-After" in blocked.headers

    def test_login_usuario_inativo_retorna_403(self, client, db_session, admin_group):
        """Usuário inativo deve ser bloqueado com 403."""
        from app.models.user import UserModel
        from app.core.security import get_password_hash

        user = UserModel(
            email="inativo@teste.com",
            senha_hash=get_password_hash("Senha@123"),
            role="User",
            grupo_id=admin_group.id,
            ativo=False,
            exige_troca_senha=False
        )
        db_session.add(user)
        db_session.commit()

        res = client.post("/api/auth/login", json={
            "email": "inativo@teste.com",
            "senha": "Senha@123"
        })
        assert res.status_code == 403
        assert "inativo" in res.json()["detail"].lower()

    def test_admin_padrao_exige_troca_na_primeira_senha(self, client, db_session, admin_group):
        from app.models.user import UserModel
        from app.core.security import get_password_hash

        user = UserModel(
            email="admin-inicial@teste.com",
            senha_hash=get_password_hash("Admin@123"),
            role="Admin",
            grupo_id=admin_group.id,
            exige_troca_senha=True,
            ativo=True,
        )
        db_session.add(user)
        db_session.commit()

        res = client.post("/api/auth/login", json={"email": user.email, "senha": "Admin@123"})
        assert res.status_code == 200
        assert res.json()["require_password_change"] is True

    def test_login_exige_troca_senha(self, client, db_session, admin_group):
        """Usuário com troca de senha obrigatória deve receber flag especial, sem token."""
        from app.models.user import UserModel
        from app.core.security import get_password_hash

        user = UserModel(
            email="novato@teste.com",
            senha_hash=get_password_hash("Senha@123"),
            role="User",
            grupo_id=admin_group.id,
            ativo=True,
            exige_troca_senha=True
        )
        db_session.add(user)
        db_session.commit()

        res = client.post("/api/auth/login", json={
            "email": "novato@teste.com",
            "senha": "Senha@123"
        })
        assert res.status_code == 200
        data = res.json()
        assert data.get("require_password_change") is True
        assert "access_token" not in data  # Não deve emitir token ainda

    def test_login_sem_email_retorna_422(self, client):
        """Payload inválido (sem email) deve retornar 422 Unprocessable Entity."""
        res = client.post("/api/auth/login", json={"senha": "qualquer"})
        assert res.status_code == 422
