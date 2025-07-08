from collections.abc import AsyncGenerator
from functools import lru_cache

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.ext.declarative import declarative_base

from src.app.config import config_service

# Create declarative base
Base = declarative_base()

# Global variables for engine and session factory
engine = None
AsyncSessionLocal = None


@lru_cache
def get_database_url() -> str:
    """Get database URL from config"""
    config = config_service.get_database()
    return config.get("database_url")


def init_database_engine():
    """Initialize database engine and session factory"""
    global engine, AsyncSessionLocal

    if engine is None:
        # Create async engine
        engine = create_async_engine(
            get_database_url(),
            echo=False,  # Set to True for SQL logging in development
            future=True,
            pool_pre_ping=True,
            pool_recycle=3600,  # Recycle connections every hour
        )

        # Create async session factory
        AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


# Dependency to get database session
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency to get database session"""
    if AsyncSessionLocal is None:
        init_database_engine()

    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# Initialize database (create tables)
async def init_db() -> None:
    """Initialize database - create all tables"""
    if engine is None:
        init_database_engine()

    # Import all models to ensure they are registered with Base

    async with engine.begin() as conn:
        # Create all tables
        await conn.run_sync(Base.metadata.create_all)


# Close database connections
async def close_db() -> None:
    """Close database connections"""
    if engine is not None:
        await engine.dispose()
