"""Download painting images from Wikimedia Commons into images/<id>.jpg.

Each entry in content/paintings.json has either "file" (exact Commons file
name) or "query" (search text). Existing images are skipped, so delete a file
to re-fetch it. Writes images/sources.json with where each image came from.
"""
import json, os, sys, time, urllib.parse, urllib.request

API = "https://commons.wikimedia.org/w/api.php"
UA = "ArtolingoImageFetcher/1.0 (personal learning app)"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WIDTH = 1200


def api(params):
    params = {**params, "format": "json", "formatversion": "2"}
    req = urllib.request.Request(API + "?" + urllib.parse.urlencode(params), headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def info_for(entry):
    common = {"action": "query", "prop": "imageinfo", "iiprop": "url|mime|size", "iiurlwidth": WIDTH}
    if entry.get("file"):
        data = api({**common, "titles": "File:" + entry["file"]})
        pages = data["query"]["pages"]
    else:
        data = api({**common, "generator": "search", "gsrnamespace": 6, "gsrlimit": 10,
                    "gsrsearch": entry["query"] + " filetype:bitmap"})
        pages = sorted(data.get("query", {}).get("pages", []), key=lambda p: p.get("index", 99))
    for p in pages:
        ii = (p.get("imageinfo") or [None])[0]
        if ii and ii.get("mime") in ("image/jpeg", "image/png", "image/tiff") and ii.get("width", 0) >= 600:
            return p["title"], ii.get("thumburl") or ii["url"]
    return None, None


def main():
    paintings = json.load(open(os.path.join(ROOT, "content/paintings.json")))
    src_path = os.path.join(ROOT, "images/sources.json")
    sources = json.load(open(src_path)) if os.path.exists(src_path) else {}
    failed = []
    for pid, entry in paintings.items():
        out = os.path.join(ROOT, "images", pid + ".jpg")
        if os.path.exists(out):
            continue
        try:
            title, url = info_for(entry)
            if not url:
                raise RuntimeError("no result")
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                data = r.read()
            with open(out, "wb") as f:
                f.write(data)
            sources[pid] = title
            print(f"OK   {pid}: {title}")
        except Exception as e:
            failed.append(pid)
            print(f"FAIL {pid}: {e}")
        time.sleep(1)
    json.dump(sources, open(src_path, "w"), indent=1, ensure_ascii=False, sort_keys=True)
    if failed:
        print("Failed:", ", ".join(failed))


if __name__ == "__main__":
    sys.exit(main())
