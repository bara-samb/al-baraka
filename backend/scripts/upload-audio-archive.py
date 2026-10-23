"""
Envoie les récitations (001.mp3 … 114.mp3) et l'azan sur Internet Archive (archive.org),
gratuit et sans carte bancaire, avec la même arborescence que le backend :
    audios/serigne-aboul-baraka-mbacke/NNN.mp3
    audios/azan/touba.mp3

Adresse publique obtenue (à mettre dans frontend/.env, EXPO_PUBLIC_AUDIO_BASE_URL) :
    https://archive.org/download/<identifiant>/audios/serigne-aboul-baraka-mbacke/

Prérequis (une seule fois) :
    python -m pip install --user internetarchive==5.11.1
    ia configure        (identifiants de votre compte archive.org, dans votre terminal)

Usage : python upload-audio-archive.py [identifiant]
Relançable sans risque : les fichiers déjà en ligne et identiques (même MD5) sont ignorés.
"""

import hashlib
import sys
from pathlib import Path

from internetarchive import get_item, upload

DEFAULT_IDENTIFIER = "al-baraka-serigne-aboul-baraka-mbacke-warsh"
AUDIO_ROOT = Path(__file__).resolve().parent.parent / "uploads" / "audios"

METADATA = {
    "mediatype": "audio",
    "collection": "opensource_audio",
    "title": "Le Saint Coran (riwaya Warsh) — Serigne Aboul Baraka Mbacké",
    "creator": "Serigne Aboul Baraka Mbacké",
    "language": "ara",
    "subject": ["Coran", "Quran", "Warsh", "récitation", "AL BARAKA"],
    "description": (
        "Récitation intégrale du Saint Coran en riwaya Warsh ʿan Nāfiʿ par Serigne Aboul Baraka "
        "Mbacké : une sourate par fichier (001.mp3 à 114.mp3). Audio de l'application AL BARAKA."
    ),
}


def md5_of(path: str) -> str:
    digest = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def collect_files() -> dict:
    files = {}
    for n in range(1, 115):
        name = f"{n:03d}.mp3"
        local = AUDIO_ROOT / "serigne-aboul-baraka-mbacke" / name
        if not local.exists():
            sys.exit(f"Fichier manquant : {local}")
        files[f"audios/serigne-aboul-baraka-mbacke/{name}"] = str(local)
    azan = AUDIO_ROOT / "azan" / "touba.mp3"
    if azan.exists():
        files["audios/azan/touba.mp3"] = str(azan)
    return files


def main() -> None:
    identifier = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_IDENTIFIER
    files = collect_files()
    # Seuls les fichiers absents ou modifiés (MD5 différent) sont envoyés.
    item = get_item(identifier)
    online_md5 = {f["name"]: f.get("md5") for f in item.files} if item.exists else {}
    todo = {remote: local for remote, local in files.items() if online_md5.get(remote) != md5_of(local)}
    print(f"Élément : https://archive.org/details/{identifier}")
    print(f"{len(files)} fichiers, {len(todo)} à envoyer.")

    for i, (remote, local) in enumerate(todo.items(), 1):
        size_mb = Path(local).stat().st_size / 1024 / 1024
        print(f"[{i}/{len(todo)}] ↑ {remote} ({size_mb:.1f} Mo)…", flush=True)
        responses = upload(
            identifier,
            files={remote: local},
            metadata=METADATA,
            checksum=True,  # ignore un fichier déjà présent et identique
            queue_derive=False,  # pas de conversions automatiques : seuls les MP3 d'origine
            retries=10,
            retries_sleep=30,
        )
        failed = [r for r in responses if getattr(r, "status_code", 200) >= 400]
        if failed:
            sys.exit(f"Échec ({failed[0].status_code}) : relancez la même commande pour reprendre.")

    print("\nTerminé. Adresse à mettre dans frontend/.env :")
    print(f"EXPO_PUBLIC_AUDIO_BASE_URL=https://archive.org/download/{identifier}/audios/serigne-aboul-baraka-mbacke/")


if __name__ == "__main__":
    main()
