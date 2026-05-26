"""
test_users.py — Testes de Gerenciamento de Usuários e Grupos.
Cobre: CRUD de grupos, CRUD de usuários, failsafe de último admin, 
       proteção contra exclusão do grupo Administradores.
"""
import pytest
from tests.conftest import auth_headers


class TestGrupos:
    """Testes para o gerenciamento de grupos de permissões (RBAC)."""

    def test_listar_grupos(self, client, admin_token, admin_group):
        """Deve retornar a lista de grupos cadastrados."""
        res = client.get("/api/usuarios/grupos/", headers=auth_headers(admin_token))
        assert res.status_code == 200
        grupos = res.json()
        assert isinstance(grupos, list)
        assert any(g["nome"] == "Administradores" for g in grupos)

    def test_criar_grupo_novo(self, client, admin_token):
        """Admin deve conseguir criar um novo grupo com permissões específicas."""
        res = client.post("/api/usuarios/grupos/", headers=auth_headers(admin_token), json={
            "nome": "Financeiro",
            "descricao": "Equipe de análise financeira",
            "permissoes": "VER_DASHBOARD,EXECUTAR_SCRIPT"
        })
        assert res.status_code == 200
        data = res.json()
        assert data["nome"] == "Financeiro"
        assert "EXECUTAR_SCRIPT" in data["permissoes"]

    def test_criar_grupo_nome_duplicado_retorna_400(self, client, admin_token, admin_group):
        """Não deve permitir dois grupos com o mesmo nome."""
        res = client.post("/api/usuarios/grupos/", headers=auth_headers(admin_token), json={
            "nome": "Administradores",
            "descricao": "Tentativa de duplicata",
            "permissoes": "VER_DASHBOARD"
        })
        assert res.status_code == 400

    def test_editar_grupo(self, client, admin_token, suporte_group):
        """Admin deve conseguir editar um grupo existente."""
        res = client.put(
            f"/api/usuarios/grupos/{suporte_group.id}",
            headers=auth_headers(admin_token),
            json={
                "nome": "Suporte N1 Atualizado",
                "descricao": "Descrição nova",
                "permissoes": "VER_DASHBOARD,EXECUTAR_SCRIPT"
            }
        )
        assert res.status_code == 200
        assert res.json()["nome"] == "Suporte N1 Atualizado"
        assert "EXECUTAR_SCRIPT" in res.json()["permissoes"]

    def test_renomear_grupo_administradores_bloqueado(self, client, admin_token, admin_group):
        """Não deve ser permitido renomear o grupo raiz 'Administradores'."""
        res = client.put(
            f"/api/usuarios/grupos/{admin_group.id}",
            headers=auth_headers(admin_token),
            json={
                "nome": "Super Admin",
                "descricao": "Tentativa de renomear",
                "permissoes": "VER_DASHBOARD"
            }
        )
        assert res.status_code == 400
        assert "Administradores" in res.json()["detail"]

    def test_deletar_grupo_sem_membros(self, client, admin_token, db_session):
        """Deve permitir excluir grupo vazio."""
        from app.models.user_group import UserGroupModel
        grupo_temp = UserGroupModel(
            nome="Grupo Temporario",
            descricao="Para deletar",
            permissoes="VER_DASHBOARD"
        )
        db_session.add(grupo_temp)
        db_session.commit()
        db_session.refresh(grupo_temp)

        res = client.delete(
            f"/api/usuarios/grupos/{grupo_temp.id}",
            headers=auth_headers(admin_token)
        )
        assert res.status_code == 200

    def test_deletar_grupo_administradores_bloqueado(self, client, admin_token, admin_group):
        """O grupo raiz 'Administradores' nunca pode ser excluído."""
        res = client.delete(
            f"/api/usuarios/grupos/{admin_group.id}",
            headers=auth_headers(admin_token)
        )
        assert res.status_code == 400
        assert "Administradores" in res.json()["detail"]

    def test_deletar_grupo_com_membros_bloqueado(self, client, admin_token, suporte_group, suporte_user):
        """Não deve ser permitido excluir um grupo que possui membros."""
        res = client.delete(
            f"/api/usuarios/grupos/{suporte_group.id}",
            headers=auth_headers(admin_token)
        )
        assert res.status_code == 400
        assert "membros" in res.json()["detail"].lower()


class TestUsuarios:
    """Testes para criação, edição e segurança de usuários."""

    def test_listar_usuarios(self, client, admin_token, admin_user):
        """Admin deve ver todos os usuários cadastrados."""
        res = client.get("/api/usuarios/", headers=auth_headers(admin_token))
        assert res.status_code == 200
        assert isinstance(res.json(), list)
        assert any(u["email"] == "admin@teste.com" for u in res.json())

    def test_criar_usuario(self, client, admin_token, suporte_group):
        """Admin deve conseguir criar um novo usuário."""
        res = client.post("/api/usuarios/", headers=auth_headers(admin_token), json={
            "email": "novousuario@teste.com",
            "senha": "Senha@123",
            "role": "User",
            "grupo_id": suporte_group.id
        })
        assert res.status_code == 200
        data = res.json()
        assert data["email"] == "novousuario@teste.com"
        assert data["exige_troca_senha"] is True  # Deve exigir troca no primeiro login

    def test_criar_usuario_email_duplicado_retorna_400(self, client, admin_token, admin_user, suporte_group):
        """Não deve permitir dois usuários com o mesmo e-mail."""
        res = client.post("/api/usuarios/", headers=auth_headers(admin_token), json={
            "email": "admin@teste.com",
            "senha": "Outro@123",
            "role": "User",
            "grupo_id": suporte_group.id
        })
        assert res.status_code == 400
        assert "e-mail" in res.json()["detail"].lower()

    def test_resetar_senha_usuario(self, client, admin_token, suporte_user):
        """Admin deve conseguir resetar a senha de um usuário."""
        res = client.put(
            f"/api/usuarios/{suporte_user.id}/resetar_senha",
            headers=auth_headers(admin_token)
        )
        assert res.status_code == 200
        assert "resetada" in res.json()["message"].lower()

        # Após reset, usuário deve conseguir logar com senha padrão
        login_res = client.post("/api/auth/login", json={
            "email": "suporte@teste.com",
            "senha": "mudar123"
        })
        # Deve exigir troca de senha
        assert login_res.status_code == 200
        assert login_res.json().get("require_password_change") is True

    def test_failsafe_ultimo_admin_nao_pode_ser_desativado(
        self, client, admin_token, admin_user
    ):
        """O último administrador ativo não pode ser desativado ou ter sua role removida."""
        res = client.put(
            f"/api/usuarios/{admin_user.id}",
            headers=auth_headers(admin_token),
            json={
                "role": "User",
                "grupo_id": admin_user.grupo_id,
                "ativo": False
            }
        )
        assert res.status_code == 400
        assert "bloqueada" in res.json()["detail"].lower()

    def test_usuario_sem_token_retorna_401(self, client):
        """Acesso sem token deve retornar 401 em rotas que exigem autenticação."""
        res = client.get("/api/auditoria/grupos/")
        assert res.status_code == 401

    def test_token_invalido_retorna_401(self, client):
        """Token inválido ou malformado deve retornar 401 em rotas protegidas."""
        res = client.get(
            "/api/auditoria/grupos/",
            headers={"Authorization": "Bearer token_invalido_aqui"}
        )
        assert res.status_code == 401
