# YouTube Instagram Bot

Instagram'dan video indiren, birleştiren ve YouTube'a yükleyen otomasyon botu. Node.js, MongoDB ve Docker üzerinde çalışır.

## Mimari

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Instagram  │────▶│  Node.js App │────▶│   YouTube   │
│  (yt-dlp)   │     │  + ffmpeg    │     │  (OAuth2)   │
└─────────────┘     └──────┬───────┘     └─────────────┘
                           │
                    ┌──────▼───────┐
                    │   MongoDB    │
                    └──────────────┘
```

## Gereksinimler

- Docker & Docker Compose
- Google Cloud Console'da YouTube Data API v3 etkinleştirilmiş OAuth2 kimlik bilgileri

## Kurulum

### 1. Ortam değişkenlerini ayarlayın

```bash
cp .env.example .env
```

`.env` dosyasını düzenleyin:

| Değişken | Açıklama |
|----------|----------|
| `INSTAGRAM_SOURCES` | Virgülle ayrılmış Instagram profil veya post URL'leri |
| `YOUTUBE_CLIENT_ID` | Google OAuth2 Client ID |
| `YOUTUBE_CLIENT_SECRET` | Google OAuth2 Client Secret |
| `YOUTUBE_REFRESH_TOKEN` | OAuth2 refresh token (aşağıdaki adımlarla alınır) |
| `CRON_SCHEDULE` | Otomatik çalışma zamanı (varsayılan: her 30 dakika) |

### 2. YouTube OAuth2 yetkilendirmesi

1. [Google Cloud Console](https://console.cloud.google.com/) üzerinde proje oluşturun
2. YouTube Data API v3'ü etkinleştirin
3. OAuth2 kimlik bilgileri oluşturun (Web application)
4. Uygulamayı başlatın: `docker compose up -d`
5. Yetkilendirme URL'sini alın:

```bash
curl http://localhost:3000/auth/youtube
```

6. Dönen `authUrl`'yi tarayıcıda açın ve izin verin
7. Yönlendirme sonrası aldığınız `refresh_token` değerini `.env` dosyasına `YOUTUBE_REFRESH_TOKEN` olarak ekleyin
8. Uygulamayı yeniden başlatın: `docker compose restart app`

### 3. Docker ile çalıştırma

```bash
docker compose up -d --build
```

Logları izlemek için:

```bash
docker compose logs -f app
```

## API Endpoints

| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/health` | Sağlık kontrolü |
| POST | `/pipeline/run` | Tam pipeline: indir → birleştir → yükle |
| POST | `/download` | Sadece Instagram'dan indir |
| POST | `/upload` | Mevcut videoları birleştirip YouTube'a yükle |
| GET | `/jobs` | Son işleri listele |
| GET | `/jobs/:id` | İş detayı |
| GET | `/videos` | İndirilen videolar |
| GET | `/uploads` | YouTube yüklemeleri |
| GET | `/auth/youtube` | OAuth2 yetkilendirme URL'si |
| GET | `/youtube/channel` | Bağlı YouTube kanal bilgisi |

### Örnek: Manuel pipeline çalıştırma

```bash
curl -X POST http://localhost:3000/pipeline/run \
  -H "Content-Type: application/json" \
  -d '{
    "sources": ["https://www.instagram.com/example_user/"],
    "limitPerSource": 3,
    "title": "Günlük Instagram Derlemesi",
    "privacyStatus": "private"
  }'
```

### Örnek: Belirli videoları yükleme

```bash
curl -X POST http://localhost:3000/upload \
  -H "Content-Type: application/json" \
  -d '{
    "videoIds": ["mongoId1", "mongoId2"],
    "title": "Özel Derleme",
    "privacyStatus": "unlisted"
  }'
```

## Otomatik Zamanlayıcı

`CRON_SCHEDULE` ortam değişkeni ile pipeline otomatik çalışır. Varsayılan: `*/30 * * * *` (her 30 dakikada bir).

Örnek cron ifadeleri:
- `0 */6 * * *` — Her 6 saatte bir
- `0 9 * * *` — Her gün saat 09:00
- `0 9 * * 1` — Her Pazartesi saat 09:00

## Proje Yapısı

```
├── docker-compose.yml
├── Dockerfile
├── package.json
├── .env.example
├── src/
│   ├── index.js              # Giriş noktası
│   ├── config/               # Yapılandırma
│   ├── api/                  # REST API rotaları
│   ├── database/             # MongoDB bağlantısı
│   ├── models/               # Mongoose modelleri
│   ├── services/
│   │   ├── instagram.js      # yt-dlp ile indirme
│   │   ├── merger.js         # ffmpeg ile birleştirme
│   │   ├── youtube.js        # YouTube API yükleme
│   │   └── pipeline.js       # Tam iş akışı
│   ├── workers/
│   │   └── scheduler.js      # Cron zamanlayıcı
│   └── utils/
├── downloads/                # İndirilen videolar (volume)
├── merged/                   # Birleştirilmiş videolar (volume)
└── logs/                     # Uygulama logları (volume)
```

## MongoDB Koleksiyonları

- **InstagramVideo** — İndirilen Instagram videoları ve durumları
- **Job** — İş akışı kayıtları (indirme, birleştirme, yükleme)
- **Upload** — YouTube yükleme geçmişi

## Notlar

- Instagram içeriklerini indirirken telif haklarına ve platform kullanım şartlarına dikkat edin
- YouTube API günlük kota limitleri vardır; büyük dosyalar için yükleme süresi uzayabilir
- İlk çalıştırmada videolar `private` olarak yüklenir; `.env` ile değiştirilebilir
- Eski indirilen dosyalar 7 gün sonra otomatik temizlenir
