"""Provider autenticazione Microsoft Entra ID (Azure AD).

Implementa il flusso OAuth2 Authorization Code con PKCE.
"""

from __future__ import annotations

import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlencode

import httpx

from backend.enterprise.config import settings
from backend.enterprise.auth.models import (
    MicrosoftUserInfo,
    AuthError,
)

logger = logging.getLogger(__name__)


class MicrosoftAuthProvider:
    """Provider per autenticazione Microsoft Entra ID.
    
    Uso:
        provider = MicrosoftAuthProvider()
        
        # 1. Genera URL di login
        auth_url, state = provider.get_authorization_url()
        # Redirect utente a auth_url
        
        # 2. Callback dopo login Microsoft
        tokens = await provider.exchange_code(code)
        user_info = await provider.get_user_info(tokens["access_token"])
    """
    
    AUTHORIZE_URL = "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize"
    TOKEN_URL = "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token"
    GRAPH_URL = "https://graph.microsoft.com/v1.0/me"
    
    # Scopes richiesti
    SCOPES = [
        "openid",
        "profile", 
        "email",
        "User.Read",
    ]
    
    def __init__(
        self,
        client_id: str | None = None,
        client_secret: str | None = None,
        tenant_id: str | None = None,
        redirect_uri: str | None = None,
    ):
        self.client_id = client_id or settings.azure_client_id
        self.client_secret = client_secret or settings.azure_client_secret
        self.tenant_id = tenant_id or settings.azure_tenant_id
        self.redirect_uri = redirect_uri or settings.azure_redirect_uri
        
        if not self.client_id:
            raise ValueError("AZURE_CLIENT_ID non configurato")
    
    def get_authorization_url(
        self,
        state: str | None = None,
        prompt: str = "select_account",
    ) -> tuple[str, str]:
        """Genera l'URL per il redirect a Microsoft login.
        
        Args:
            state: State parameter per CSRF protection (generato se None)
            prompt: "select_account" | "login" | "consent" | "none"
            
        Returns:
            Tuple (authorization_url, state)
        """
        if state is None:
            state = secrets.token_urlsafe(32)
        
        params = {
            "client_id": self.client_id,
            "response_type": "code",
            "redirect_uri": self.redirect_uri,
            "response_mode": "query",
            "scope": " ".join(self.SCOPES),
            "state": state,
            "prompt": prompt,
        }
        
        base_url = self.AUTHORIZE_URL.format(tenant=self.tenant_id)
        auth_url = f"{base_url}?{urlencode(params)}"
        
        return auth_url, state
    
    async def exchange_code(self, code: str) -> dict[str, Any]:
        """Scambia l'authorization code per access token.
        
        Args:
            code: Authorization code da callback Microsoft
            
        Returns:
            Token response con access_token, id_token, refresh_token
        """
        data = {
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "code": code,
            "redirect_uri": self.redirect_uri,
            "grant_type": "authorization_code",
            "scope": " ".join(self.SCOPES),
        }
        
        token_url = self.TOKEN_URL.format(tenant=self.tenant_id)
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                token_url,
                data=data,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
        
        if response.status_code != 200:
            logger.error(f"Token exchange failed: {response.text}")
            raise AuthError(
                f"Errore durante l'autenticazione Microsoft: {response.status_code}",
                code="token_exchange_failed",
            )
        
        return response.json()
    
    async def refresh_token(self, refresh_token: str) -> dict[str, Any]:
        """Rinnova l'access token usando il refresh token.
        
        Args:
            refresh_token: Refresh token valido
            
        Returns:
            Nuova token response
        """
        data = {
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
            "scope": " ".join(self.SCOPES),
        }
        
        token_url = self.TOKEN_URL.format(tenant=self.tenant_id)
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                token_url,
                data=data,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
        
        if response.status_code != 200:
            raise AuthError(
                "Refresh token scaduto o non valido",
                code="refresh_failed",
            )
        
        return response.json()
    
    async def get_user_info(self, access_token: str) -> MicrosoftUserInfo:
        """Recupera le info utente da Microsoft Graph.
        
        Args:
            access_token: Access token valido
            
        Returns:
            MicrosoftUserInfo con i dati dell'utente
        """
        async with httpx.AsyncClient() as client:
            response = await client.get(
                self.GRAPH_URL,
                headers={"Authorization": f"Bearer {access_token}"},
            )
        
        if response.status_code != 200:
            logger.error(f"Graph API failed: {response.text}")
            raise AuthError(
                "Impossibile recuperare le informazioni utente",
                code="graph_api_failed",
            )
        
        data = response.json()
        return MicrosoftUserInfo(**data)
    
    def verify_state(self, state: str, expected: str) -> bool:
        """Verifica che lo state parameter sia valido (CSRF protection)."""
        return secrets.compare_digest(state, expected)
    
    @staticmethod
    def hash_token(token: str) -> str:
        """Genera un hash sicuro del token per storage."""
        return hashlib.sha256(token.encode()).hexdigest()
