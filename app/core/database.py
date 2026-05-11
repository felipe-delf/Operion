from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models.base import Base

import os

# Para começar rápido e simplificar testes, usaremos SQLite localmente.
# Depois podemos alterar essa URL para o PostgreSQL.
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./parametrizacao.db")

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def create_tables():
    Base.metadata.create_all(bind=engine)
