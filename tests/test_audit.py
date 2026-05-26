"""
test_audit.py — Testes de Auditoria.
Cobre: CRUD de grupos de auditoria, CRUD de regras de auditoria,
       proteção de acesso por permissão GERENCIAR_AUDITORIA.
"""
import pytest
from tests.conftest import auth_headers


class TestAuditGrupos:
    """Testes para gerenciamento dos grupos de auditoria."""

    def test_listar_grupos_auditoria(self, client, admin_token):
        """Admin deve conseguir listar os grupos de auditoria."""
        res = client.get("/api/auditoria/grupos/", headers=auth_headers(admin_token))
        assert res.status_code == 200
        assert isinstance(res.json(), list)

    def test_criar_grupo_auditoria(self, client, admin_token):
        """Admin deve conseguir criar um grupo de auditoria."""
        res = client.post(
            "/api/auditoria/grupos/",
            headers=auth_headers(admin_token),
            json={
                "nome": "Grupo Fiscal",
                "descricao": "Regras para auditoria fiscal"
            }
        )
        assert res.status_code == 200
        data = res.json()
        assert data["nome"] == "Grupo Fiscal"

    def test_suporte_nao_cria_grupo_auditoria(self, client, suporte_token):
        """Suporte N1 sem GERENCIAR_AUDITORIA não pode criar grupos de auditoria."""
        res = client.post(
            "/api/auditoria/grupos/",
            headers=auth_headers(suporte_token),
            json={
                "nome": "Tentativa Não Autorizada",
                "descricao": "..."
            }
        )
        # Deve ser 403 (sem permissão) ou 401 (sem token de auditoria)
        assert res.status_code in [403, 422]


class TestAuditRegras:
    """Testes para gerenciamento das regras de auditoria."""

    @pytest.fixture()
    def grupo_auditoria(self, client, admin_token):
        """Cria um grupo de auditoria para usar nos testes de regras."""
        res = client.post(
            "/api/auditoria/grupos/",
            headers=auth_headers(admin_token),
            json={"nome": "Grupo Base", "descricao": "Para testes de regras"}
        )
        return res.json()

    def test_criar_regra_auditoria(self, client, admin_token, grupo_auditoria):
        """Admin deve criar regras de auditoria vinculadas a um grupo."""
        res = client.post(
            "/api/auditoria/",
            headers=auth_headers(admin_token),
            json={
                "nome": "Verifica Margem",
                "sql_query": "SELECT COUNT(*) FROM ITENS WHERE MARGEM < 15",
                "valor_esperado": "0",
                "valor_esperado_is_query": False,
                "tipo_alvo": "PDV",
                "grupo_id": grupo_auditoria["id"]
            }
        )
        assert res.status_code == 200
        data = res.json()
        assert data["nome"] == "Verifica Margem"

    def test_listar_regras_auditoria(self, client, admin_token):
        """Admin deve listar todas as regras de auditoria."""
        res = client.get("/api/auditoria/", headers=auth_headers(admin_token))
        assert res.status_code == 200
        assert isinstance(res.json(), list)
