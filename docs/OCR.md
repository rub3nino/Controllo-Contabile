# OCR locale di Quadra

Quadra usa due livelli OCR locali:

1. **PP-OCRv6 italiano** per testo e moduli semplici.
2. **PaddleOCR-VL 1.6** per layout e tabelle complesse.

RapidOCR rimane come fallback se PaddleOCR non è installato o non riesce a
inizializzarsi. I risultati Paddle sono memorizzati in `output/.ocr-cache` usando
l'hash SHA-256 dell'immagine, così una pagina invariata non viene elaborata due
volte.

## Ambiente

PaddleOCR-VL supporta ufficialmente Python 3.9-3.13. Usare un virtual environment
separato; Python 3.14 non è al momento nella matrice verificata ufficialmente.
`start.sh` crea automaticamente `.venv-py313` e lascia intatto il precedente
ambiente Python 3.14.

Installare prima il runtime PaddlePaddle adatto al computer seguendo la guida
ufficiale, quindi:

```bash
python -m pip install -r requirements.txt
```

Su macOS `start.sh` installa automaticamente anche PaddlePaddle 3.2.1 dall'indice
ufficiale. RapidOCR è un fallback opzionale perché la sua vecchia distribuzione
ONNX non è compatibile con il Python 3.13 richiesto dal nuovo stack.

Al primo utilizzo PaddleOCR scarica i modelli. Dopo il download l'elaborazione è
locale.

## Configurazione

- `QUADRA_OCR_PROVIDER=paddle` (default): Paddle, poi RapidOCR come fallback.
- `QUADRA_OCR_PROVIDER=auto`: equivalente a `paddle`.
- `QUADRA_OCR_PROVIDER=rapid`: usa soltanto RapidOCR.
- `QUADRA_OCR_PROVIDER=none`: disabilita OCR.
- `QUADRA_OCR_DEVICE=cpu` (default), oppure il device supportato dal runtime.
- `QUADRA_OCR_CACHE=/percorso`: cambia la directory della cache.
- `QUADRA_OCR_VL_MAX_PIXELS=1200000`: limite memoria del VLM per regione.

I modelli Paddle scaricati sono salvati in `output/.paddlex`, evitando scritture
nella home dell'utente.

PP-OCR dei PDF viene eseguito a 300 DPI; il parser VL a 160 DPI con risoluzione
dinamica, per restare nei 16 GB del Mac. Entrambi elaborano fino a 40 pagine. Il
testo nativo PDF continua ad avere priorità quando è sufficiente.
