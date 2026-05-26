"""
test_health.py — Testes de Sanidade da API (Health Checks).
Verifica que a API está no ar e responde corretamente nos endpoints raiz.
"""


class TestHealth:
    """Suite de sanidade: a API deve responder sem erros nos endpoints básicos."""

    def test_root_endpoint(self, client):
        """Endpoint raiz deve retornar 200 com mensagem de status."""
        res = client.get("/")
        assert res.status_code == 200
        data = res.json()
        assert "message" in data
        assert "Online" in data["message"] or "v2" in data["message"]

    def test_docs_acessivel(self, client):
        """A documentação Swagger (OpenAPI) deve estar acessível."""
        res = client.get("/docs")
        assert res.status_code == 200

    def test_openapi_json_valido(self, client):
        """O schema OpenAPI deve ser um JSON válido com todos os endpoints documentados."""
        res = client.get("/openapi.json")
        assert res.status_code == 200
        schema = res.json()
        assert "paths" in schema
        assert "/api/auth/login" in schema["paths"]
        assert "/api/scripts/" in schema["paths"]
        assert "/api/usuarios/" in schema["paths"]
