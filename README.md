# Photo Download Portal

Een beveiligde download portal voor fotografie bestanden gebouwd met Next.js 15 en Cloudflare R2.

## ✨ Features

- 📤 **Admin upload panel** - Drag & drop interface voor snel uploaden
- 🔗 **Custom URLs** - Bijvoorbeeld: `download.wouter.photo/klant-bruiloft`
- 📱 **Responsive galerij** - Mooie grid layout voor alle apparaten
- 📧 **Email notificaties** - Krijg een email bij elke download
- ⏰ **Auto-expiry** - Links vervallen automatisch na 60 dagen
- 💰 **Goedkoop** - €0-5/maand met Cloudflare R2
- 🚀 **Vercel hosting** - Gratis tier

## 🛠 Technologie

- **Next.js 15** - React framework met App Router
- **Cloudflare R2** - S3-compatible object storage (geen egress kosten!)
- **Resend** - Email service voor notificaties
- **Tailwind CSS + shadcn/ui** - Mooie, moderne UI components
- **TypeScript** - Type-safe development

## 📦 Installatie

### 1. Dependencies installeren

\`\`\`bash
npm install
\`\`\`

### 2. Cloudflare R2 Setup

1. Ga naar [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Klik op **R2** in het menu
3. Klik op **Create bucket**
   - Naam: `photo-downloads` (of een andere naam)
4. Ga naar **Manage R2 API Tokens**
5. Klik op **Create API token**
   - Permission: **Object Read & Write**
   - Kies je bucket
6. Kopieer de credentials:
   - Account ID
   - Access Key ID
   - Secret Access Key

### 3. Resend Setup (voor emails)

1. Ga naar [Resend](https://resend.com)
2. Maak een gratis account aan
3. Ga naar **API Keys**
4. Klik op **Create API Key**
5. Kopieer de key

### 4. Environment Variables

Kopieer `.env.example` naar `.env`:

\`\`\`bash
cp .env.example .env
\`\`\`

Vul je credentials in:

\`\`\`env
ADMIN_PASSWORD=1234
ADMIN_EMAIL=info@woutervellekoop.nl

R2_ACCOUNT_ID=jouw_account_id
R2_ACCESS_KEY_ID=jouw_access_key
R2_SECRET_ACCESS_KEY=jouw_secret_key
R2_BUCKET_NAME=photo-downloads

RESEND_API_KEY=re_jouw_key
\`\`\`

### 5. Development server starten

\`\`\`bash
npm run dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) in je browser.

## 🚀 Deployen naar Vercel

### 1. GitHub Repository

Push je code naar GitHub:

\`\`\`bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/jouwnaam/repo-naam.git
git push -u origin main
\`\`\`

### 2. Vercel Project

1. Ga naar [Vercel](https://vercel.com)
2. Klik op **Add New Project**
3. Importeer je GitHub repository
4. Voeg je environment variables toe in de settings
5. Deploy!

### 3. Custom Domain Setup

1. Ga naar je Vercel project settings
2. Klik op **Domains**
3. Voeg `download.wouter.photo` toe
4. Volg de instructies om je DNS in te stellen bij je domain provider

## 📖 Gebruik

### Admin Panel

1. Ga naar `/admin`
2. Log in met je wachtwoord (standaard: `1234`)
3. Upload foto's:
   - Vul een custom slug in (bijv. `johndoe-bruiloft`)
   - Sleep foto's naar het upload veld
   - Klik op **Upload Bestanden**
4. Kopieer de download link en stuur naar je klant!

### Download Portal

Klanten gaan naar hun unieke link (bijv. `download.wouter.photo/johndoe-bruiloft`) en kunnen:
- Alle foto's in één keer downloaden als ZIP
- Individuele foto's downloaden
- Downloads zijn 60 dagen geldig

## 🔒 Beveiliging

- Admin panel is beveiligd met wachtwoord
- HTTP-only cookies voor authenticatie
- Expiry dates op downloads
- Custom slugs (niet raadbaar)

**Let op:** Voor productie, wijzig `ADMIN_PASSWORD` naar iets sterkers!

## 💰 Kosten (indicatief)

- **Vercel**: Gratis (Hobby tier)
- **Cloudflare R2**: €0-2/maand
  - 10GB storage gratis
  - Geen egress kosten
- **Resend**: Gratis (3000 emails/maand)

**Totaal: €0-5/maand** 🎉

## 🔧 Aanpassingen

### Expiry tijd wijzigen

In [app/api/admin/upload/route.ts](app/api/admin/upload/route.ts#L35):

\`\`\`typescript
const expiresAt = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000); // 60 dagen
\`\`\`

### Wachtwoord wijzigen

Wijzig `ADMIN_PASSWORD` in je `.env` bestand.

### Email template aanpassen

In [lib/email.ts](lib/email.ts) kun je de email template wijzigen.

## 📝 License

MIT - Vrij te gebruiken voor persoonlijke en commerciële projecten.

## 🤝 Support

Vragen? Open een issue of stuur een email naar info@woutervellekoop.nl

---

Gemaakt met ❤️ voor Wouter Vellekoop Photography
