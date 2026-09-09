"""Security headers middleware."""

from __future__ import annotations

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

from backend.enterprise.config import settings


class SecurityHeaders:
    """Headers di sicurezza da applicare a tutte le risposte."""
    
    # Content Security Policy
    CSP = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "  # Per React
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: https:; "
        "font-src 'self' data:; "
        "connect-src 'self' https://login.microsoftonline.com https://graph.microsoft.com; "
        "frame-ancestors 'none'; "
        "base-uri 'self'; "
        "form-action 'self';"
    )
    
    # Altri headers
    HEADERS = {
        # Previene clickjacking
        "X-Frame-Options": "DENY",
        
        # Previene MIME sniffing
        "X-Content-Type-Options": "nosniff",
        
        # XSS protection (legacy, ma utile per browser vecchi)
        "X-XSS-Protection": "1; mode=block",
        
        # Referrer policy
        "Referrer-Policy": "strict-origin-when-cross-origin",
        
        # Permissions policy (ex Feature-Policy)
        "Permissions-Policy": (
            "accelerometer=(), "
            "camera=(), "
            "geolocation=(), "
            "gyroscope=(), "
            "magnetometer=(), "
            "microphone=(), "
            "payment=(), "
            "usb=()"
        ),
    }
    
    @classmethod
    def get_headers(cls, include_csp: bool = True) -> dict[str, str]:
        """Ritorna tutti gli headers di sicurezza."""
        headers = cls.HEADERS.copy()
        
        if include_csp:
            headers["Content-Security-Policy"] = cls.CSP
        
        # HSTS solo in produzione
        if settings.environment == "production":
            headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains; preload"
            )
        
        return headers


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Middleware che aggiunge security headers a tutte le risposte."""
    
    def __init__(self, app, include_csp: bool = True):
        super().__init__(app)
        self.include_csp = include_csp
    
    async def dispatch(
        self,
        request: Request,
        call_next: RequestResponseEndpoint,
    ) -> Response:
        response = await call_next(request)
        
        # Aggiungi headers
        for name, value in SecurityHeaders.get_headers(self.include_csp).items():
            response.headers[name] = value
        
        # Aggiungi rate limit headers se presenti
        if hasattr(request.state, "rate_limit_remaining"):
            response.headers["X-RateLimit-Remaining"] = str(
                request.state.rate_limit_remaining
            )
        if hasattr(request.state, "rate_limit_reset"):
            response.headers["X-RateLimit-Reset"] = str(
                request.state.rate_limit_reset
            )
        
        return response


# Alias
security_headers_middleware = SecurityHeadersMiddleware
