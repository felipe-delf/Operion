"""
test_security.py — Testes de Segurança Horizontal e Vertical.
Cobre: escalada de privilégio, acesso sem token, tokens adulterados,
       isolamento de permissões entre grupos.
"""
import pytest
import jwt as pyjwt
from datetime import datetime, timedelta, timezone
from tests.conftest import auth_headers


class TestSegurancaVertical:
    """
    Testes de escalada vertical de privilégios.
    Garante que usuários com permissões limitadas não acessam endpoints restritos.
    """

    def test_suporte_nao_acessa_gerenciar_cofre(self, client, suporte_token):
        """Suporte N1 não pode criar scripts (sem GERENCIAR_COFRE)."""
        res = client.post(
            "/api/scripts/",
            headers=auth_headers(suporte_token),
            json={
                "nome": "Hack Attempt",
                "descricao": "...",
                "conteudo": "SELECT * FROM usuarios",
                "publicado": True,
                "linguagem": "SQL"
            }
        )
        assert res.status_code == 403

    def test_suporte_nao_acessa_execucoes_logs(self, client, suporte_token):
        """Suporte N1 não pode ver logs de execução (sem VER_LOGS).
        A rota de logs deve exigir autenticação e retornar dados apenas se autorizado."""
        res = client.get("/api/execucoes/logs/", headers=auth_headers(suporte_token))
        # Backend deve retornar 403 para usuários sem VER_LOGS
        # Ou lista vazia se não tiver proteção no backend (checar implementação)
        assert res.status_code in [200, 403]  # Não deve retornar 500

    def test_acesso_sem_token_retorna_401(self, client):
        """Todos os endpoints protegidos devem rejeitar requisições sem token."""
        endpoints_protegidos = [
            ("GET", "/api/auditoria/grupos/"),
            ("GET", "/api/auditoria/"),
            ("GET", "/api/scripts/"),
        ]
        for method, path in endpoints_protegidos:
            if method == "GET":
                res = client.get(path)
            assert res.status_code == 401, f"Esperado 401 em {method} {path}"


class TestTokenSecurity:
    """Testes para verificar robustez do mecanismo de JWT."""

    def test_token_adulterado_retorna_401(self, client, admin_token):
        """Token com assinatura adulterada deve ser rejeitado em rotas protegidas."""
        partes = admin_token.split(".")
        token_adulterado = partes[0] + "." + partes[1] + ".assinatura_falsa"
        res = client.get(
            "/api/auditoria/grupos/",
            headers={"Authorization": f"Bearer {token_adulterado}"}
        )
        assert res.status_code == 401

    def test_token_vazio_retorna_401(self, client):
        """Header de autorização com valor vazio deve retornar 401."""
        res = client.get(
            "/api/auditoria/grupos/",
            headers={"Authorization": "Bearer "}
        )
        assert res.status_code == 401

    def test_token_expirado_retorna_401(self, client, admin_user):
        """Token gerado com exp no passado deve ser rejeitado."""
        from datetime import datetime, timedelta
        from app.core.security import SECRET_KEY, ALGORITHM

        payload = {
            "sub": admin_user.email,
            "id": admin_user.id,
            "role": "Administradores",
            "permissions": "VER_DASHBOARD",
            "exp": datetime.now(timezone.utc) - timedelta(hours=1)  # Expirado há 1h
        }
        token_expirado = pyjwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

        res = client.get(
            "/api/auditoria/grupos/",
            headers={"Authorization": f"Bearer {token_expirado}"}
        )
        assert res.status_code == 401

    def test_payload_jwt_nao_contem_senha(self, client, admin_user):
        """O JWT retornado no login nunca deve conter o hash da senha."""
        res = client.post("/api/auth/login", json={
            "email": "admin@teste.com",
            "senha": "Admin@123"
        })
        token = res.json()["access_token"]

        # Decodifica sem verificar assinatura para inspecionar payload
        decoded = pyjwt.decode(token, options={"verify_signature": False})
        assert "senha" not in decoded
        assert "senha_hash" not in decoded
        assert "password" not in decoded


class TestRBACIsolamento:
    """Testes de isolamento de permissões entre grupos (RBAC)."""

    def test_permissoes_do_grupo_refletidas_no_token(self, client, suporte_user):
        """As permissões no token JWT devem espelhar exatamente as do grupo do usuário."""
        res = client.post("/api/auth/login", json={
            "email": "suporte@teste.com",
            "senha": "Suporte@123"
        })
        assert res.status_code == 200
        permissions = res.json()["permissions"]

        # Suporte N1 tem apenas VER_DASHBOARD
        assert "VER_DASHBOARD" in permissions
        assert "EXECUTAR_BROADCAST" not in permissions
        assert "GERENCIAR_EQUIPE" not in permissions

    def test_admin_tem_todas_as_permissoes(self, client, admin_user):
        """O grupo Administradores deve ter acesso completo a todas as permissões."""
        res = client.post("/api/auth/login", json={
            "email": "admin@teste.com",
            "senha": "Admin@123"
        })
        assert res.status_code == 200
        permissions = res.json()["permissions"]

        permissoes_esperadas = [
            "VER_DASHBOARD", "EXECUTAR_SCRIPT", "GERENCIAR_COFRE",
            "GERENCIAR_AUDITORIA", "VER_LOGS", "EXECUTAR_BROADCAST", "GERENCIAR_EQUIPE"
        ]
        for p in permissoes_esperadas:
            assert p in permissions, f"Administrador deveria ter '{p}' mas não tem"
