"""
test_scripts.py — Testes do Cofre SQL (Scripts).
Cobre: criação, listagem com RBAC, proteção por permissão GERENCIAR_COFRE,
       visibilidade de scripts publicados vs. rascunho.
"""
import pytest
from tests.conftest import auth_headers


@pytest.fixture()
def script_payload():
    return {
        "nome": "Script de Teste",
        "descricao": "Script criado nos testes automatizados",
        "conteudo": "SELECT 1 AS ok",
        "publicado": True,
        "linguagem": "SQL"
    }


class TestScripts:
    """Testes para o CRUD e controle de acesso do Cofre SQL."""

    def test_criar_script_como_admin(self, client, admin_token, script_payload):
        """Admin com permissão GERENCIAR_COFRE deve criar scripts com sucesso."""
        res = client.post(
            "/api/scripts/",
            headers=auth_headers(admin_token),
            json=script_payload
        )
        assert res.status_code == 200
        data = res.json()
        assert data["nome"] == "Script de Teste"
        assert data["publicado"] is True
        assert data["criado_por"] == "admin@teste.com"

    def test_criar_script_sem_permissao_retorna_403(self, client, suporte_token, script_payload):
        """Usuário sem GERENCIAR_COFRE não deve criar scripts."""
        res = client.post(
            "/api/scripts/",
            headers=auth_headers(suporte_token),
            json=script_payload
        )
        assert res.status_code == 403
        assert "permissão" in res.json()["detail"].lower()

    def test_criar_script_sem_autenticacao_retorna_401(self, client, script_payload):
        """Criação de script sem token deve retornar 401."""
        res = client.post("/api/scripts/", json=script_payload)
        assert res.status_code == 401

    def test_criar_script_nome_duplicado_retorna_400(self, client, admin_token, script_payload):
        """Não deve permitir dois scripts com o mesmo nome."""
        client.post("/api/scripts/", headers=auth_headers(admin_token), json=script_payload)
        res = client.post("/api/scripts/", headers=auth_headers(admin_token), json=script_payload)
        assert res.status_code == 400
        assert "já existe" in res.json()["detail"].lower()

    def test_listar_scripts_admin_ve_todos(self, client, admin_token, script_payload):
        """Admin deve ver todos os scripts, incluindo rascunhos."""
        # Cria um publicado
        client.post("/api/scripts/", headers=auth_headers(admin_token), json=script_payload)
        # Cria um rascunho
        rascunho = {**script_payload, "nome": "Rascunho Interno", "publicado": False}
        client.post("/api/scripts/", headers=auth_headers(admin_token), json=rascunho)

        res = client.get("/api/scripts/", headers=auth_headers(admin_token))
        assert res.status_code == 200
        nomes = [s["nome"] for s in res.json()]
        assert "Script de Teste" in nomes
        assert "Rascunho Interno" in nomes

    def test_listar_scripts_suporte_ve_apenas_permitidos(
        self, client, admin_token, suporte_token, suporte_user, script_payload, db_session
    ):
        """Suporte N1 deve ver apenas os scripts explicitamente liberados para ele."""
        # Admin cria um script
        res_create = client.post(
            "/api/scripts/",
            headers=auth_headers(admin_token),
            json=script_payload
        )
        script_id = res_create.json()["id"]

        # Sem permissão explícita: suporte vê lista vazia
        res_vazia = client.get("/api/scripts/", headers=auth_headers(suporte_token))
        assert res_vazia.status_code == 200
        assert res_vazia.json() == []

        # Admin concede acesso ao suporte
        client.post(
            f"/api/usuarios/{suporte_user.id}/permissoes",
            headers=auth_headers(admin_token),
            json={"script_ids": [script_id]}
        )

        # Agora suporte deve ver o script
        res_com_perm = client.get("/api/scripts/", headers=auth_headers(suporte_token))
        assert res_com_perm.status_code == 200
        assert any(s["id"] == script_id for s in res_com_perm.json())

    def test_buscar_script_por_id(self, client, admin_token, script_payload):
        """Deve retornar um script específico pelo ID."""
        res_create = client.post(
            "/api/scripts/",
            headers=auth_headers(admin_token),
            json=script_payload
        )
        script_id = res_create.json()["id"]

        res = client.get(f"/api/scripts/{script_id}", headers=auth_headers(admin_token))
        assert res.status_code == 200
        assert res.json()["id"] == script_id

    def test_buscar_script_inexistente_retorna_404(self, client, admin_token):
        """Buscar script com ID inválido deve retornar 404."""
        res = client.get("/api/scripts/999999", headers=auth_headers(admin_token))
        assert res.status_code == 404
